import { NextResponse } from "next/server";
import {
  createVoiceEventFromPayload,
  ensureVoiceLeadForCaller,
  inferVoiceCompletionStatus,
  normalizeVoiceStatus,
  parseVoicePayloadFromRequest,
  syncVoiceCallAutomation,
  upsertVoiceCallFromPayload,
} from "@/lib/voice";
import { publishVoiceLiveEvent } from "@/lib/voiceLiveEvents";
import { safelyProcessInboundCallCentreHealth } from "@/lib/voiceCallCentreHealth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isTrustedVoiceEvent(payload: Record<string, string>) {
  const configuredUsername = String(process.env.AFRICASTALKING_USERNAME || "").trim().toLowerCase();
  if (!configuredUsername) return true;
  const payloadUsername = String(payload.username || payload.userName || payload.Username || "").trim().toLowerCase();
  if (!payloadUsername) return true;
  return payloadUsername === configuredUsername;
}

export async function POST(request: Request) {
  let payload: Record<string, string> = {};
  try {
    payload = await parseVoicePayloadFromRequest(request);
    console.info("[voice.events] inbound", payload);
    if (!isTrustedVoiceEvent(payload)) {
      console.warn("[voice.events.untrusted_username]", payload.username || payload.userName || payload.Username || null);
    }

    const browserDialedNumber = String(
      payload.clientDialedNumber || payload.ClientDialedNumber || payload.dialedNumber || payload.DialedNumber || "",
    ).trim();
    const normalizedPayload = browserDialedNumber
      ? {
          ...payload,
          direction: "OUTBOUND",
          destinationNumber: browserDialedNumber,
        }
      : payload;

    const resolvedStatus = inferVoiceCompletionStatus(normalizedPayload);
    const resolvedPayload =
      resolvedStatus === normalizeVoiceStatus(normalizedPayload)
        ? normalizedPayload
        : { ...normalizedPayload, status: resolvedStatus };

    const voiceCall = await upsertVoiceCallFromPayload(resolvedPayload);
    const voiceEvent = await createVoiceEventFromPayload(resolvedPayload, voiceCall.id);
    await ensureVoiceLeadForCaller({
      callerNumber: voiceCall.callerNumber,
      startedAt: voiceCall.startedAt,
      assignedToId: voiceCall.assignedToId,
      customerId: voiceCall.customerId,
    });
    await syncVoiceCallAutomation({
      id: voiceCall.id,
      direction: voiceCall.direction,
      callerNumber: voiceCall.callerNumber,
      destinationNumber: voiceCall.destinationNumber,
      status: resolvedStatus,
      startedAt: voiceCall.startedAt,
      endedAt: voiceCall.endedAt,
      assignedToId: voiceCall.assignedToId,
      durationInSeconds: voiceCall.durationInSeconds,
    });
    await safelyProcessInboundCallCentreHealth(voiceCall);

    publishVoiceLiveEvent({
      type: voiceCall.recordingUrl ? "recording" : "call",
      reason: `voice_event_route_${voiceEvent.eventType}`,
      callId: voiceCall.id,
      sessionId: voiceCall.sessionId,
      userId: voiceCall.assignedToId,
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
