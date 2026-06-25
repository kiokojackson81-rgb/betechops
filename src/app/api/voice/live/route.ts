import { NextResponse } from "next/server";
import { getVoiceLiveSnapshot, resolveVoiceViewer } from "@/lib/voiceOperations";

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

    const snapshot = await getVoiceLiveSnapshot({
      viewer,
      selectedCallId: url.searchParams.get("selectedCallId"),
      selectedPhone: url.searchParams.get("selectedPhone"),
    });

    return NextResponse.json(snapshot, { status: 200 });
  } catch (error) {
    console.error("[voice.live.failed]", error);
    return NextResponse.json({ error: "voice_live_failed" }, { status: 500 });
  }
}

