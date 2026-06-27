import { NextResponse } from "next/server";
import { normalizeKenyanPhone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import {
  addVoiceCallNote,
  isVoiceOperationsSchemaMissingError,
  reassignVoiceWork,
  resolveVoiceViewer,
} from "@/lib/voiceOperations";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const viewer = await resolveVoiceViewer({
      impersonateId: url.searchParams.get("impersonateId"),
    });

    if (!viewer) {
      return NextResponse.json({ ok: false, error: "not_authorized" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      callId?: string | null;
      targetUserId?: string | null;
      targetPhone?: string | null;
      targetLabel?: string | null;
    };

    if (!body.callId) {
      return NextResponse.json({ ok: false, error: "call_id_required" }, { status: 400 });
    }

    const call = await prisma.voiceCall.findUnique({
      where: { id: body.callId },
      select: {
        id: true,
        assignedToId: true,
      },
    });

    if (!call) {
      return NextResponse.json({ ok: false, error: "voice_call_not_found" }, { status: 404 });
    }

    if (!viewer.isAdmin && call.assignedToId && call.assignedToId !== viewer.targetUserId) {
      return NextResponse.json({ ok: false, error: "not_authorized_for_call" }, { status: 403 });
    }

    const normalizedTargetPhone = normalizeKenyanPhone(body.targetPhone || "");
    let targetUserId = String(body.targetUserId || "").trim() || null;
    let targetLabel = String(body.targetLabel || "").trim() || normalizedTargetPhone || "transfer target";

    if (!targetUserId && normalizedTargetPhone) {
      const matchedUser = await prisma.user.findFirst({
        where: {
          isActive: true,
          OR: [{ phone: normalizedTargetPhone }, { phone: String(body.targetPhone || "").trim() }],
        },
        select: {
          id: true,
          name: true,
          phone: true,
        },
      });
      if (matchedUser) {
        targetUserId = matchedUser.id;
        targetLabel = matchedUser.name || matchedUser.phone || targetLabel;
      }
    }

    let reassignmentResult: Awaited<ReturnType<typeof reassignVoiceWork>> | null = null;
    if (targetUserId) {
      reassignmentResult = await reassignVoiceWork({
        callId: call.id,
        assignedToId: targetUserId,
      });
    }

    await addVoiceCallNote({
      voiceCallId: call.id,
      authorId: viewer.actorUserId,
      note: targetUserId
        ? `Call transferred to ${targetLabel}.`
        : `External transfer requested to ${targetLabel}.`,
    });

    return NextResponse.json(
      {
        ok: true,
        transfer: {
          callId: call.id,
          targetUserId,
          targetPhone: normalizedTargetPhone || null,
          targetLabel,
          reassigned: Boolean(reassignmentResult),
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[voice.transfer.failed]", error);
    if (isVoiceOperationsSchemaMissingError(error)) {
      return NextResponse.json(
        {
          error: "voice_operations_migration_missing",
          message: "Voice operations migration is not applied yet.",
        },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "voice_transfer_failed" },
      { status: 400 },
    );
  }
}
