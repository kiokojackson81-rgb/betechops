import { NextResponse } from "next/server";
import {
  isVoiceOperationsSchemaMissingError,
  listVoiceCallsSnapshot,
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
