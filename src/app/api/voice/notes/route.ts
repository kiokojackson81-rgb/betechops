import { NextResponse } from "next/server";
import {
  addVoiceCallNote,
  isVoiceOperationsSchemaMissingError,
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
      return NextResponse.json({ error: "not_authorized" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      voiceCallId?: string | null;
      note?: string | null;
    };

    if (!body.voiceCallId) {
      return NextResponse.json({ error: "voice_call_id_required" }, { status: 400 });
    }

    const note = await addVoiceCallNote({
      voiceCallId: body.voiceCallId,
      authorId: viewer.actorUserId,
      note: String(body.note || ""),
    });

    return NextResponse.json({
      ok: true,
      note: {
        id: note.id,
        voiceCallId: note.voiceCallId,
        customerId: note.customerId,
        note: note.note,
        createdAt: note.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("[voice.notes.failed]", error);
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
      { error: error instanceof Error ? error.message : "voice_notes_failed" },
      { status: 400 },
    );
  }
}
