import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApprovedAgentSession } from "@/lib/agents/auth";
import { createAgentReferralLead } from "@/lib/agents/referralLeads";

const createReferralLeadSchema = z.object({
  productId: z.string().trim().optional().nullable(),
  opsProductId: z.string().trim().optional().nullable(),
  productName: z.string().trim().min(1),
  productSlug: z.string().trim().optional().nullable(),
  customerName: z.string().trim().optional().nullable(),
  customerPhone: z.string().trim().min(7),
  referralCode: z.string().trim().optional().nullable(),
  referralUrl: z.string().trim().url(),
  channel: z.enum(["whatsapp", "sms"]),
});

export async function POST(request: Request) {
  const agentSession = await requireApprovedAgentSession();
  if (!agentSession) {
    return NextResponse.json({ ok: false, error: "Agent authentication is required." }, { status: 401 });
  }

  try {
    const payload = createReferralLeadSchema.parse(await request.json());
    const lead = await createAgentReferralLead({
      agentId: agentSession.userId,
      productId: payload.productId,
      opsProductId: payload.opsProductId,
      productName: payload.productName,
      productSlug: payload.productSlug,
      customerName: payload.customerName,
      customerPhone: payload.customerPhone,
      referralCode: payload.referralCode,
      referralUrl: payload.referralUrl,
      channel: payload.channel,
    });

    return NextResponse.json({ ok: true, lead });
  } catch (error) {
    const message = error instanceof z.ZodError
      ? error.issues[0]?.message || "Invalid referral lead payload."
      : error instanceof Error
        ? error.message
        : "Unable to save this referral lead right now.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
