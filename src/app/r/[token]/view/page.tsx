import { documentAccessAllowed, documentVerificationPath } from "@/lib/documentAccess";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ensureReviewInvitationForReceipt, getReceiptReferralOffers } from "@/lib/reviewsReferrals";
import { customerReceiptPresentation } from "@/lib/customerReceiptPresentation";
import ReceiptLandingPage from "./ReceiptLandingPage";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your receipt | Betech Solar", robots: { index: false, follow: false }, referrer: "no-referrer" as const };

export default async function CustomerReceiptPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^rcpt_[A-Za-z0-9_-]{16}$/.test(token)) notFound();
  const receipt = await prisma.receipt.findFirst({
    where: { data: { path: ["publicReceiptToken"], equals: token } },
    select: { id: true, receiptNumber: true, data: true, order: { select: {
      orderNumber: true, customerName: true, totalAmount: true, paidAmount: true,
      items: { select: { id: true, quantity: true, sellingPrice: true, product: { select: { name: true } } } },
      mpesaPayments: { where: { status: "SUCCESS", purpose: "ORDER_PAYMENT" }, select: { transactionAt: true } },
      layawayPlan: { select: { payments: { select: { paidAt: true } } } },
    } } },
  });
  if (!receipt) notFound();
  if (!await documentAccessAllowed("receipt", token)) redirect(documentVerificationPath("receipt", token));
  const [review, offers] = await Promise.all([
    ensureReviewInvitationForReceipt(receipt.id).catch(() => null),
    getReceiptReferralOffers(receipt.id).catch(() => []),
  ]);
  return <ReceiptLandingPage receipt={customerReceiptPresentation(receipt)} token={token} reviewUrl={review?.reviewUrl || null} offers={offers} />;
}
