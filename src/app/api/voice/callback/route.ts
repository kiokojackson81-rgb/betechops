import { NextResponse } from "next/server";
import {
  buildEmptyVoiceXmlResponse,
  buildVoiceMessageXmlResponse,
  buildVoiceXmlResponse,
  createOrUpdateMissedVoiceLead,
  createVoiceEventFromPayload,
  ensureVoiceLeadForCaller,
  getVoiceRouteTargets,
  isVoiceCallActive,
  normalizeVoiceStatus,
  parseVoicePayloadFromRequest,
  safeString,
  upsertVoiceCallFromPayload,
} from "@/lib/voice";
import { publishVoiceLiveEvent } from "@/lib/voiceLiveEvents";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function xmlResponse(body: string) {
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "no-store",
    },
  });
}

function buildAdminFallbackXml() {
  const adminNumber = safeString(process.env.BETECH_VOICE_ADMIN_NUMBER) || "+254705663175";
  return buildVoiceXmlResponse({
    preDialMessage: "Thank you for calling Betech Solar Solutions. Please hold as we connect your call.",
    phoneNumbers: [adminNumber],
  });
}

function getBrowserDialedNumber(payload: Record<string, string>) {
  return safeString(payload.clientDialedNumber || payload.ClientDialedNumber || payload.dialedNumber || payload.DialedNumber);
}

function isTrustedVoiceCallback(payload: Record<string, string>) {
  const configuredUsername = safeString(process.env.AFRICASTALKING_USERNAME).toLowerCase();
  if (!configuredUsername) return true;
  const payloadUsername = safeString(payload.username || payload.userName || payload.Username).toLowerCase();
  if (!payloadUsername) return true;
  return payloadUsername === configuredUsername;
}

export async function POST(request: Request) {
  let payload: Record<string, string> = {};
  try {
    payload = await parseVoicePayloadFromRequest(request);
    console.info("[voice.callback] inbound", payload);
    if (!isTrustedVoiceCallback(payload)) {
      console.warn("[voice.callback.untrusted_username]", {
        configured: safeString(process.env.AFRICASTALKING_USERNAME),
        payloadUsername: safeString(payload.username || payload.userName || payload.Username),
      });
    }

    const browserDialedNumber = getBrowserDialedNumber(payload);
    const normalizedPayload =
      browserDialedNumber
        ? {
            ...payload,
            direction: "OUTBOUND",
            destinationNumber: browserDialedNumber,
          }
        : payload;

    const status = normalizeVoiceStatus(normalizedPayload);
    const isActive = isVoiceCallActive(normalizedPayload);

    if (browserDialedNumber) {
      const voiceCall = await upsertVoiceCallFromPayload(normalizedPayload, {
        routeType: "WEBRTC_OUTBOUND",
        routedTo: browserDialedNumber,
        assignedToId: null,
      });
      await createVoiceEventFromPayload(
        {
          ...normalizedPayload,
          eventType: isActive ? "WEBRTC_OUTBOUND_CREATED" : "WEBRTC_OUTBOUND_COMPLETED",
        },
        voiceCall.id,
      );

      if (!isActive) {
        return xmlResponse(buildEmptyVoiceXmlResponse());
      }

      return xmlResponse(
        buildVoiceXmlResponse({
          phoneNumbers: [browserDialedNumber],
        }),
      );
    }

    const route = await getVoiceRouteTargets({
      date: new Date(),
      callerNumber:
        normalizedPayload.callerNumber || normalizedPayload.caller || normalizedPayload.from || "",
    });
    const routeDialValues = route.orderedTargets.flatMap((target) =>
      target.dialValues?.length ? target.dialValues : [target.dialValue || target.phoneNumber],
    );
    const routedTo = routeDialValues.join(",");
    const primaryTarget = route.primaryTarget;

    const voiceCall = await upsertVoiceCallFromPayload(normalizedPayload, {
      routeType: route.routeType,
      routedTo,
      assignedToId: primaryTarget?.userId ?? null,
    });
    await createVoiceEventFromPayload(
      {
        ...normalizedPayload,
        eventType: isActive ? "CALL_CREATED" : "CALL_COMPLETED",
      },
      voiceCall.id,
    );

    await ensureVoiceLeadForCaller({
      callerNumber: voiceCall.callerNumber,
      startedAt: voiceCall.startedAt,
      assignedToId: voiceCall.assignedToId,
      customerId: voiceCall.customerId,
    });

    if (!isActive) {
      await createOrUpdateMissedVoiceLead({
        callerNumber: voiceCall.callerNumber,
        status,
        startedAt: voiceCall.startedAt,
        assignedToId: voiceCall.assignedToId,
      });
      return xmlResponse(buildEmptyVoiceXmlResponse());
    }

    if (!route.hasRoutableTarget) {
      await createVoiceEventFromPayload(
        {
          ...normalizedPayload,
          eventType: "NO_AGENT_AVAILABLE",
        },
        voiceCall.id,
      );
      return xmlResponse(buildVoiceMessageXmlResponse("No agents are currently available. Please try again shortly."));
    }

    if (route.usedMobileFallback) {
      console.warn("[voice.callback.mobile_fallback]", {
        sessionId: voiceCall.sessionId,
        callerNumber: voiceCall.callerNumber,
        routedTo,
      });
    }

    if (route.routeType === "AFTER_HOURS") {
      return xmlResponse(
        buildVoiceXmlResponse({
          preDialMessage:
            "Thank you for calling Betech Solar Solutions. Our sales team is currently outside working hours. Please hold as we connect you to the admin line.",
          phoneNumbers: route.orderedTargets.flatMap((target) =>
            target.dialValues?.length ? target.dialValues : [target.dialValue || target.phoneNumber],
          ),
        }),
      );
    }

    publishVoiceLiveEvent({
      type: "call",
      reason: "voice_callback_active",
      callId: voiceCall.id,
      sessionId: voiceCall.sessionId,
      userId: voiceCall.assignedToId,
    });

    return xmlResponse(
      buildVoiceXmlResponse({
        phoneNumbers: route.orderedTargets.flatMap((target) =>
          target.dialValues?.length ? target.dialValues : [target.dialValue || target.phoneNumber],
        ),
      }),
    );
  } catch (error) {
    console.error("[voice.callback.failed]", {
      error: error instanceof Error ? error.message : String(error),
      payload,
    });

    if (!isVoiceCallActive(payload)) {
      return xmlResponse(buildEmptyVoiceXmlResponse());
    }

    return xmlResponse(buildAdminFallbackXml());
  }
}
