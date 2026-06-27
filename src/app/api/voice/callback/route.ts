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

const VOICE_HOP_MAX_DURATION_SECONDS = 15;

type VoiceRouteHop = {
  label: string;
  dialValue: string;
};

type VoiceRoutePlan = {
  hops: VoiceRouteHop[];
  primaryTargetUserId: string | null;
  routeType: string | null;
  routedTo: string;
};

function xmlResponse(body: string) {
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "no-store",
    },
  });
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildDialAttemptXml(input: {
  phoneNumber: string;
  redirectUrl?: string | null;
  preDialMessage?: string | null;
  maxDurationSeconds?: number;
}) {
  const sayPart = input.preDialMessage ? `<Say>${escapeXml(input.preDialMessage)}</Say>` : "";
  const maxDurationPart = input.maxDurationSeconds ? ` maxDuration="${input.maxDurationSeconds}"` : "";
  const redirectPart = input.redirectUrl ? `<Redirect>${escapeXml(input.redirectUrl)}</Redirect>` : "";
  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<Response>${sayPart}<Dial record="true" phoneNumbers="${escapeXml(input.phoneNumber)}"${maxDurationPart} />${redirectPart}</Response>`
  );
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

function encodeRoutePlan(plan: VoiceRoutePlan) {
  return Buffer.from(JSON.stringify(plan), "utf8").toString("base64url");
}

function decodeRoutePlan(serialized: string | null) {
  if (!serialized) return null;
  try {
    const parsed = JSON.parse(Buffer.from(serialized, "base64url").toString("utf8")) as Partial<VoiceRoutePlan>;
    if (!Array.isArray(parsed.hops) || !parsed.hops.length) return null;
    return {
      hops: parsed.hops
        .map((hop) => ({
          label: safeString(hop?.label),
          dialValue: safeString(hop?.dialValue),
        }))
        .filter((hop) => hop.label && hop.dialValue),
      primaryTargetUserId: safeString(parsed.primaryTargetUserId || "") || null,
      routeType: safeString(parsed.routeType || "") || null,
      routedTo: safeString(parsed.routedTo || ""),
    } satisfies VoiceRoutePlan;
  } catch {
    return null;
  }
}

function buildRedirectUrl(requestUrl: URL, plan: VoiceRoutePlan, hopIndex: number) {
  const redirectUrl = new URL(requestUrl.pathname, requestUrl.origin);
  redirectUrl.searchParams.set("hop", String(hopIndex));
  redirectUrl.searchParams.set("routePlan", encodeRoutePlan(plan));
  return redirectUrl.toString();
}

function inferTerminalStatus(payload: Record<string, string>, plan: VoiceRoutePlan | null) {
  const cause = safeString(payload.lastBridgeHangupCause || payload.bridgeHangupCause || payload.hangupCause).toUpperCase();
  if (cause === "USER_BUSY" || cause === "BUSY") return "busy";
  if (cause === "NO_ANSWER" || cause === "NO ANSWER") return "no_answer";

  const rawStatus = safeString(payload.status).toLowerCase();
  const duration = Number(safeString(payload.durationInSeconds || payload.duration || "0"));
  if (plan?.hops.length && rawStatus === "success" && (!Number.isFinite(duration) || duration <= 0)) {
    return "no_answer";
  }

  return normalizeVoiceStatus(payload);
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

    return xmlResponse(
      buildDialAttemptXml({
        preDialMessage:
          hopIndex === 0 && effectiveRoutePlan.routeType === "AFTER_HOURS"
            ? "Thank you for calling Betech Solar Solutions. Our sales team is currently outside working hours. Please hold as we connect you to the admin line."
            : hopIndex === 0
              ? "Thank you for calling Betech Solar Solutions. Please hold as we connect your call."
              : null,
        phoneNumber: currentHop.dialValue,
        maxDurationSeconds: VOICE_HOP_MAX_DURATION_SECONDS,
        redirectUrl:
          hopIndex + 1 < effectiveRoutePlan.hops.length
            ? buildRedirectUrl(requestUrl, effectiveRoutePlan, hopIndex + 1)
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
