import {
  type VoiceRoutePlan,
  buildVoiceRoutePlanFromPhoneNumbers,
  buildDialAttemptXml,
  buildRoutePlanRedirectUrl,
  decodeRoutePlan,
  getAdminPhoneNumbers,
  getIvrDigits,
} from "@/lib/voiceIvr";
import { buildVoiceMessageXmlResponse, parseVoicePayloadFromRequest } from "@/lib/voice";
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
    const fallbackAgentHop = customerServiceRoutePlan?.hops?.[0] ?? null;
    const adminFirstRoutePlan = buildVoiceRoutePlanFromPhoneNumbers({
      labels: ["ADMIN", fallbackAgentHop?.label || "AGENT_FALLBACK"],
      phoneNumbers: [
        ...getAdminPhoneNumbers(),
        ...(fallbackAgentHop?.dialValue ? [fallbackAgentHop.dialValue] : []),
      ],
      routeType: "TECHNICAL_TEAM",
    });
    selectedRoutePlan = {
      ...adminFirstRoutePlan,
      primaryTargetUserId: customerServiceRoutePlan?.primaryTargetUserId ?? null,
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
      preDialMessage: null,
      phoneNumber: currentHop.dialValue,
      redirectUrl:
        selectedRoutePlan.hops.length > 1
          ? buildRoutePlanRedirectUrl(requestUrl, selectedRoutePlan, 1)
          : null,
    }),
  );
}
