import { NextResponse } from "next/server";
import {
  isVoiceOperationsSchemaMissingError,
  resolveVoiceViewer,
  saveVoiceFollowUp,
  updateVoiceQueueStatus,
} from "@/lib/voiceOperations";

export const dynamic = "force-dynamic";

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
      id?: string | null;
      voiceCallId?: string | null;
      voiceLeadId?: string | null;
      customerId?: string | null;
      assignedToId?: string | null;
      phone?: string | null;
      title?: string | null;
      status?: string | null;
      dueAt?: string | null;
      notes?: string | null;
      queueType?: "task" | "lead" | null;
    };

    if (body.status && ((body.id && body.queueType === "task") || (body.voiceLeadId && body.queueType === "lead"))) {
      const result = await updateVoiceQueueStatus({
        followUpId: body.queueType === "task" ? body.id ?? null : null,
        voiceLeadId: body.queueType === "lead" ? body.voiceLeadId ?? null : null,
        status: body.status,
      });

      return NextResponse.json({ ok: true, result });
    }

    const followUp = await saveVoiceFollowUp({
      ...body,
      assignedToId: body.assignedToId ?? viewer.targetUserId,
    });

    return NextResponse.json({
      ok: true,
      followUp: {
        id: followUp.id,
        voiceCallId: followUp.voiceCallId,
        voiceLeadId: followUp.voiceLeadId,
        customerId: followUp.customerId,
        assignedToId: followUp.assignedToId,
        phone: followUp.phone,
        title: followUp.title,
        status: followUp.status,
        dueAt: followUp.dueAt?.toISOString() ?? null,
        notes: followUp.notes,
        createdAt: followUp.createdAt.toISOString(),
        updatedAt: followUp.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("[voice.followups.failed]", error);
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
      { error: error instanceof Error ? error.message : "voice_followups_failed" },
      { status: 400 },
    );
  }
}
