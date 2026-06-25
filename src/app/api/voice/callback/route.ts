import { NextResponse } from "next/server";
import {
  buildEmptyVoiceXmlResponse,
  buildVoiceXmlResponse,
  createOrUpdateMissedVoiceLead,
  getVoiceRouteTargets,
  normalizeVoiceStatus,
  parseVoicePayloadFromRequest,
  upsertVoiceCallFromPayload,
} from "@/lib/voice";

export const dynamic = "force-dynamic";

function xmlResponse(body: string) {
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export async function POST(request: Request) {
  const payload = await parseVoicePayloadFromRequest(request);
  console.info("[voice.callback] inbound", payload);

  const status = normalizeVoiceStatus(payload);
  const isActive = ["1", "true", "yes"].includes(String(payload.isActive || "").toLowerCase());

  const route = await getVoiceRouteTargets(new Date());
  const routedTo = route.orderedTargets.map((target) => target.phoneNumber).join(",");
  const primaryTarget = route.primaryTarget;

  const voiceCall = await upsertVoiceCallFromPayload(payload, {
    routeType: route.routeType,
    routedTo,
    assignedToId: primaryTarget?.userId ?? null,
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
}
