import { NextResponse } from "next/server";
import { getVoiceHealthSnapshot } from "@/lib/voiceHealth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const snapshot = await getVoiceHealthSnapshot();
    return NextResponse.json(snapshot, { status: 200 });
  } catch (error) {
    console.error("[voice.health.failed]", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "voice_health_failed",
      },
      { status: 500 },
    );
  }
}
