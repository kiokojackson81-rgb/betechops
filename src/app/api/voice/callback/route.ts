import { NextResponse } from "next/server";
import {
  buildEmptyVoiceXmlResponse,
  buildVoiceMessageXmlResponse,
  buildVoiceXmlResponse,
  createOrUpdateMissedVoiceLead,
  createVoiceEventFromPayload,
  ensureVoiceLeadForCaller,
  getVoiceRouteTargets,
  inferVoiceCompletionStatus,
  isVoiceCallActive,
  parseVoicePayloadFromRequest,
  safeString,
  upsertVoiceCallFromPayload,
} from "@/lib/voice";
import {
  BETECH_AFTER_HOURS_WELCOME_MESSAGE,
  BETECH_CONNECTING_PROMPT,
  VOICE_HOP_MAX_DURATION_SECONDS,
  type VoiceRoutePlan,
  buildDialAttemptXml,
  buildRoutePlanRedirectUrl,
  buildWorkingHoursIvrXml,
  decodeRoutePlan,
  encodeRoutePlan,
} from "@/lib/voiceIvr";
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
    preDialMessage: BETECH_CONNECTING_PROMPT,
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

function inferTerminalStatus(payload: Record<string, string>, plan: VoiceRoutePlan | null) {
  return inferVoiceCompletionStatus(payload, {
    treatZeroDurationSuccessAsNoAnswer: Boolean(plan?.hops.length),
  });
}

export async function POST(request: Request) {
  let payload: Record<string, string> = {};
  try {
    const requestUrl = new URL(request.url);
    const hopIndex = Math.max(0, Number.parseInt(requestUrl.searchParams.get("hop") || "0", 10) || 0);
    const routePlanFromQuery = decodeRoutePlan(requestUrl.searchParams.get("routePlan"));
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

    const status = inferTerminalStatus(normalizedPayload, routePlanFromQuery);
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

    const effectiveRoutePlan: VoiceRoutePlan =
      routePlanFromQuery ??
      (await (async () => {
        const resolvedRoute = await getVoiceRouteTargets({
          date: new Date(),
          callerNumber:
            normalizedPayload.callerNumber || normalizedPayload.caller || normalizedPayload.from || "",
        });
        return {
          hops: resolvedRoute.orderedTargets.flatMap((target) =>
            (target.dialValues?.length ? target.dialValues : [target.dialValue || target.phoneNumber])
              .filter(Boolean)
              .map((dialValue) => ({
                label: target.label,
                dialValue,
              })),
          ),
          primaryTargetUserId: resolvedRoute.primaryTarget?.userId ?? null,
          routeType: resolvedRoute.routeType,
          routedTo: resolvedRoute.orderedTargets
            .flatMap((target) => target.dialValues?.length ? target.dialValues : [target.dialValue || target.phoneNumber])
            .filter(Boolean)
            .join(","),
        } satisfies VoiceRoutePlan;
      })());
    const currentHop = effectiveRoutePlan.hops[hopIndex] ?? null;
    const hasRoutableTarget = effectiveRoutePlan.hops.length > 0;

    const voiceCall = await upsertVoiceCallFromPayload(normalizedPayload, {
      routeType: effectiveRoutePlan.routeType,
      routedTo: effectiveRoutePlan.routedTo,
      assignedToId: effectiveRoutePlan.primaryTargetUserId,
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

    if (!hasRoutableTarget || !currentHop) {
      await createVoiceEventFromPayload(
        {
          ...normalizedPayload,
          eventType: "NO_AGENT_AVAILABLE",
        },
        voiceCall.id,
      );
      return xmlResponse(buildVoiceMessageXmlResponse("No agents are currently available. Please try again shortly."));
    }

    if (effectiveRoutePlan.hops.length > 1) {
      console.warn("[voice.callback.mobile_fallback]", {
        sessionId: voiceCall.sessionId,
        callerNumber: voiceCall.callerNumber,
        routedTo: effectiveRoutePlan.routedTo,
        currentHop: currentHop.label,
        hopIndex,
      });
    }

    publishVoiceLiveEvent({
      type: "call",
      reason: "voice_callback_active",
      callId: voiceCall.id,
      sessionId: voiceCall.sessionId,
      userId: voiceCall.assignedToId,
    });

    if (!routePlanFromQuery && hopIndex === 0 && effectiveRoutePlan.routeType !== "AFTER_HOURS") {
      const ivrUrl = new URL("/api/voice/ivr", requestUrl.origin);
      ivrUrl.searchParams.set("routePlan", encodeRoutePlan(effectiveRoutePlan));
      return xmlResponse(buildWorkingHoursIvrXml(ivrUrl.toString()));
    }

    return xmlResponse(
      buildDialAttemptXml({
        preDialMessage:
          hopIndex === 0 && effectiveRoutePlan.routeType === "AFTER_HOURS"
            ? `${BETECH_AFTER_HOURS_WELCOME_MESSAGE} ${BETECH_CONNECTING_PROMPT}`
            : hopIndex === 0
              ? BETECH_CONNECTING_PROMPT
              : null,
        phoneNumber: currentHop.dialValue,
        maxDurationSeconds: VOICE_HOP_MAX_DURATION_SECONDS,
        redirectUrl:
          hopIndex + 1 < effectiveRoutePlan.hops.length
            ? buildRoutePlanRedirectUrl(requestUrl, effectiveRoutePlan, hopIndex + 1)
            : null,
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
