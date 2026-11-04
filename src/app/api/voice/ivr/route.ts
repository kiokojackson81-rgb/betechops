import {
  BETECH_WORKING_HOURS_DIGITS_PROMPT,
  type VoiceRoutePlan,
  buildVoiceRoutePlanFromPhoneNumbers,
  buildDialAttemptXml,
  decodeRoutePlan,
  getIvrDigits,
} from "@/lib/voiceIvr";
import { buildVoiceMessageXmlResponse, getEngineeringVoiceRouteTargets, parseVoicePayloadFromRequest } from "@/lib/voice";
import { prisma } from "@/lib/prisma";

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

export async function POST(request: Request) {
  const requestUrl = new URL(request.url);
  const payload = await parseVoicePayloadFromRequest(request);
  const customerServiceRoutePlan = decodeRoutePlan(requestUrl.searchParams.get("routePlan"));
  const digits = getIvrDigits(payload);

  let selectedRoutePlan: VoiceRoutePlan | null = customerServiceRoutePlan;

  if (digits === "1") {
    const engineeringTargets = await getEngineeringVoiceRouteTargets();
    const engineeringRoutePlan = buildVoiceRoutePlanFromPhoneNumbers({
      labels: engineeringTargets.map((target) => target.label),
      phoneNumbers: engineeringTargets.map((target) => target.phoneNumber),
      targetUserIds: engineeringTargets.map((target) => target.userId),
      routeType: "TECHNICAL_TEAM",
    });
    selectedRoutePlan = {
      ...engineeringRoutePlan,
      primaryTargetUserId: engineeringTargets[0]?.userId ?? null,
    };

    const sessionId = payload.sessionId || payload.SessionId || "";
    if (sessionId) {
      await prisma.voiceCall.updateMany({
        where: { sessionId },
        data: {
          routeType: "TECHNICAL_TEAM",
          menuOption: "1",
        },
      });
    }
  }

  const currentHop = selectedRoutePlan?.hops?.[0] ?? null;
  if (!selectedRoutePlan || !currentHop) {
    return xmlResponse(buildVoiceMessageXmlResponse("No agents are currently available. Please try again shortly."));
  }

  return xmlResponse(
    buildDialAttemptXml({
      preDialMessage: digits === "1" ? BETECH_WORKING_HOURS_DIGITS_PROMPT : null,
      // Send the whole ordered list to Africa's Talking in one sequential
      // dial. A busy/no-answer must proceed to the next destination, then
      // Admin, rather than depend on a terminal no-answer webhook redirect.
      phoneNumbers: selectedRoutePlan.hops.map((hop) => hop.dialValue),
    }),
  );
}
