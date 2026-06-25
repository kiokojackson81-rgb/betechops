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
  const payload = await parseVoicePayloadFromRequest(request);
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
}
