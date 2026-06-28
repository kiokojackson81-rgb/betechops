import { NextResponse } from "next/server";
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
      return NextResponse.json({ error: "admin_reassign_required" }, { status: 403 });
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
