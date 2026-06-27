import {
  BETECH_CONNECTING_PROMPT,
  VOICE_HOP_MAX_DURATION_SECONDS,
  buildDialAttemptXml,
  buildRoutePlanRedirectUrl,
  buildVoiceRoutePlanFromPhoneNumbers,
  decodeRoutePlan,
  getIvrDigits,
  getTechnicalTeamPhoneNumbers,
} from "@/lib/voiceIvr";
import { buildVoiceMessageXmlResponse, parseVoicePayloadFromRequest } from "@/lib/voice";

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

  const selectedRoutePlan =
    digits === "1"
      ? buildVoiceRoutePlanFromPhoneNumbers({
          labels: ["TECHNICAL_TEAM"],
          phoneNumbers: getTechnicalTeamPhoneNumbers(),
          routeType: "TECHNICAL_TEAM",
        })
      : customerServiceRoutePlan;

  const currentHop = selectedRoutePlan?.hops?.[0] ?? null;
  if (!selectedRoutePlan || !currentHop) {
    return xmlResponse(buildVoiceMessageXmlResponse("No agents are currently available. Please try again shortly."));
  }

  return xmlResponse(
    buildDialAttemptXml({
      preDialMessage: BETECH_CONNECTING_PROMPT,
      phoneNumber: currentHop.dialValue,
      maxDurationSeconds: VOICE_HOP_MAX_DURATION_SECONDS,
      redirectUrl:
        selectedRoutePlan.hops.length > 1
          ? buildRoutePlanRedirectUrl(requestUrl, selectedRoutePlan, 1)
          : null,
    }),
  );
}
