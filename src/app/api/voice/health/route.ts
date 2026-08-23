import { NextResponse } from "next/server";
import { getVoiceHealthSnapshot } from "@/lib/voiceHealth";
import { getCallCentreHealthSnapshot } from "@/lib/voiceCallCentreHealth";
import { resolveVoiceViewer } from "@/lib/voiceOperations";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const viewer = await resolveVoiceViewer();
    if (!viewer?.isAdmin) {
      return NextResponse.json({ ok: false, error: "not_authorized" }, { status: 401 });
    }
    const [operations, callCentre] = await Promise.all([
      getVoiceHealthSnapshot(),
      getCallCentreHealthSnapshot(),
    ]);
    return NextResponse.json({ ...operations, callCentre }, { status: 200 });
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
