import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { documentAccessAllowed, documentVerificationPath } from "@/lib/documentAccess";
import { createReferralFromReview, createReferralSchema, ensureReviewInvitationForReceipt, receiptIsEligibleForReferral } from "@/lib/reviewsReferrals";

export const dynamic = "force-dynamic";
const payloadSchema = z.object({ productId: z.string().min(1), referredPhone: z.string().trim().min(7), referredName: z.string().trim().optional() });
const response = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^rcpt_[A-Za-z0-9_-]{16}$/.test(token)) return response({ error: "Receipt not found." }, 404);
  if (!await documentAccessAllowed("receipt", token)) return response({ error: "Please verify your phone number to continue.", verificationUrl: documentVerificationPath("receipt", token) }, 401);
  const receipt = await prisma.receipt.findFirst({
    where: { data: { path: ["publicReceiptToken"], equals: token } },
    select: { id: true, data: true, order: { select: { totalAmount: true, paidAmount: true, paymentStatus: true } } },
  });
  if (!receipt) return response({ error: "Receipt not found." }, 404);
  if (!receiptIsEligibleForReferral(receipt)) {
    return response({ error: "Project referral links are available only after the project is fully paid and posted to POS." }, 409);
  }
  try {
    const body = payloadSchema.parse(await request.json());
    const invitation = await ensureReviewInvitationForReceipt(receipt.id);
    if (!invitation.reviewUrl) return response({ error: "Referral service is currently unavailable for this receipt." }, 400);
    const invitationToken = new URL(invitation.reviewUrl).pathname.split("/").pop();
    const referral = await createReferralFromReview(createReferralSchema.parse({ token: invitationToken, referredPhone: body.referredPhone, referredName: body.referredName, channel: "copy" }), { receiptId: receipt.id, productId: body.productId });
    return response({ referral: { referralUrl: referral.referralUrl, activationUrl: referral.activationUrl } });
  } catch (error) {
    return response({ error: error instanceof z.ZodError ? "Enter your friend’s name and a valid phone number." : error instanceof Error ? error.message : "Unable to create referral." }, 400);
  }
}
