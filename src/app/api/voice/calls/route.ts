import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  isVoiceOperationsSchemaMissingError,
  listVoiceCallsSnapshot,
  reassignVoiceWork,
  resolveVoiceViewer,
} from "@/lib/voiceOperations";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const viewer = await resolveVoiceViewer({
      impersonateId: url.searchParams.get("impersonateId"),
    });

    if (!viewer) {
      return NextResponse.json({ error: "not_authorized" }, { status: 401 });
    }

    const snapshot = await listVoiceCallsSnapshot({
      viewer,
      selectedCallId: url.searchParams.get("selectedCallId"),
      selectedPhone: url.searchParams.get("selectedPhone"),
    });

    return NextResponse.json(snapshot, { status: 200 });
  } catch (error) {
    console.error("[voice.calls.failed]", error);
    if (isVoiceOperationsSchemaMissingError(error)) {
      return NextResponse.json(
        {
          error: "voice_operations_migration_missing",
          message: "Voice operations migration is not applied yet.",
        },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: "voice_calls_failed" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const viewer = await resolveVoiceViewer({
      impersonateId: url.searchParams.get("impersonateId"),
    });

    if (!viewer) {
      return NextResponse.json({ error: "not_authorized" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      callId?: string | null;
      queueId?: string | null;
      queueType?: "task" | "lead" | null;
      assignedToId?: string | null;
    };

    if (!body.assignedToId) {
      return NextResponse.json({ error: "assigned_to_id_required" }, { status: 400 });
    }

    if (!viewer.isAdmin) {
      if (body.callId) {
        const call = await prisma.voiceCall.findUnique({
          where: { id: body.callId },
          select: { id: true, assignedToId: true },
        });
        if (!call) {
          return NextResponse.json({ error: "voice_call_not_found" }, { status: 404 });
        }
        if (call.assignedToId !== viewer.targetUserId) {
          return NextResponse.json({ error: "not_authorized" }, { status: 403 });
        }
      } else if (body.queueId && body.queueType === "task") {
        const followUp = await prisma.voiceFollowUp.findUnique({
          where: { id: body.queueId },
          select: { id: true, assignedToId: true },
        });
        if (!followUp) {
          return NextResponse.json({ error: "voice_follow_up_not_found" }, { status: 404 });
        }
        if (followUp.assignedToId !== viewer.targetUserId) {
          return NextResponse.json({ error: "not_authorized" }, { status: 403 });
        }
      } else if (body.queueId && body.queueType === "lead") {
        const lead = await prisma.voiceLead.findUnique({
          where: { id: body.queueId },
          select: { id: true, assignedToId: true },
        });
        if (!lead) {
          return NextResponse.json({ error: "voice_lead_not_found" }, { status: 404 });
        }
        if (lead.assignedToId !== viewer.targetUserId) {
          return NextResponse.json({ error: "not_authorized" }, { status: 403 });
        }
      }
    }

    const result = await reassignVoiceWork({
      callId: body.callId ?? null,
      queueId: body.queueId ?? null,
      queueType: body.queueType ?? null,
      assignedToId: body.assignedToId,
    });

    return NextResponse.json({ ok: true, result }, { status: 200 });
  } catch (error) {
    console.error("[voice.calls.reassign_failed]", error);
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
      { error: error instanceof Error ? error.message : "voice_reassign_failed" },
      { status: 400 },
    );
  }
}
