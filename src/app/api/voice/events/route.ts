import { NextResponse } from "next/server";
import {
  createOrUpdateMissedVoiceLead,
  createVoiceEventFromPayload,
  normalizeVoiceStatus,
  parseVoicePayloadFromRequest,
  upsertVoiceCallFromPayload,
} from "@/lib/voice";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let payload: Record<string, string> = {};
  try {
    payload = await parseVoicePayloadFromRequest(request);
    console.info("[voice.events] inbound", payload);

    const voiceCall = await upsertVoiceCallFromPayload(payload);
    await createVoiceEventFromPayload(payload, voiceCall.id);

    await createOrUpdateMissedVoiceLead({
      callerNumber: voiceCall.callerNumber,
      status: normalizeVoiceStatus(payload),
      startedAt: voiceCall.startedAt,
      assignedToId: voiceCall.assignedToId,
    });

    return NextResponse.json({
      ok: true,
      sessionId: voiceCall.sessionId,
      status: voiceCall.status,
    });
  } catch (error) {
    console.error("[voice.events.failed]", {
      error: error instanceof Error ? error.message : String(error),
      payload,
    });

    return NextResponse.json(
      {
        ok: false,
        error: "voice_events_failed",
      },
      { status: 200 },
    );
  }
}
