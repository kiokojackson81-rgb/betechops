import { NextResponse } from "next/server";
import {
  buildEmptyVoiceXmlResponse,
  buildVoiceXmlResponse,
  createOrUpdateMissedVoiceLead,
  ensureVoiceLeadForCaller,
  getVoiceRouteTargets,
  isVoiceCallActive,
  normalizeVoiceStatus,
  parseVoicePayloadFromRequest,
  safeString,
  upsertVoiceCallFromPayload,
} from "@/lib/voice";

export const dynamic = "force-dynamic";

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

export async function POST(request: Request) {
  let payload: Record<string, string> = {};
  try {
    payload = await parseVoicePayloadFromRequest(request);
    console.info("[voice.callback] inbound", payload);

    const status = normalizeVoiceStatus(payload);
    const isActive = isVoiceCallActive(payload);

    const route = await getVoiceRouteTargets(new Date());
    const routedTo = route.orderedTargets.map((target) => target.phoneNumber).join(",");
    const primaryTarget = route.primaryTarget;

    const voiceCall = await upsertVoiceCallFromPayload(payload, {
      routeType: route.routeType,
      routedTo,
      assignedToId: primaryTarget?.userId ?? null,
    });

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

    if (route.routeType === "AFTER_HOURS") {
      return xmlResponse(
        buildVoiceXmlResponse({
          preDialMessage:
            "Thank you for calling Betech Solar Solutions. Our sales team is currently outside working hours. Please hold as we connect you to the admin line.",
          phoneNumbers: route.orderedTargets.map((target) => target.phoneNumber),
        }),
      );
    }

    return xmlResponse(
      buildVoiceXmlResponse({
        phoneNumbers: route.orderedTargets.map((target) => target.phoneNumber),
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
