import { documentAccessAllowed, documentVerificationPath } from "@/lib/documentAccess";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ensureReviewInvitationForReceipt, getReferralRewardPreviewForReceipt } from "@/lib/reviewsReferrals";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your receipt | Betech Solar", robots: { index: false, follow: false }, referrer: "no-referrer" as const };

const money = (value: number) => new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES" }).format(value);

export default async function CustomerReceiptPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^rcpt_[A-Za-z0-9_-]{16}$/.test(token)) notFound();
  const receipt = await prisma.receipt.findFirst({
    where: { data: { path: ["publicReceiptToken"], equals: token } },
    select: { id: true, order: { select: { orderNumber: true, customerName: true, totalAmount: true } } },
  });
  if (!receipt) notFound();
  if (!await documentAccessAllowed("receipt", token)) redirect(documentVerificationPath("receipt", token));
  const review = await ensureReviewInvitationForReceipt(receipt.id).catch(() => null);
  const reward = review?.reviewUrl ? await getReferralRewardPreviewForReceipt(receipt.id).catch(() => null) : null;
  const pdf = `/r/${encodeURIComponent(token)}`;
  return <main className="min-h-screen bg-[#f7f4ef] px-4 py-8 text-slate-900">
    <article className="mx-auto max-w-2xl rounded-3xl border border-[#7a0000]/15 bg-white p-5 shadow-sm sm:p-8">
      <header className="border-b border-[#7a0000]/15 pb-5">
        <p className="text-xs font-black tracking-[.18em] text-[#7a0000]">BETECH SOLAR SOLUTIONS</p>
        <h1 className="mt-3 text-3xl font-black">Your receipt</h1>
      </header>
      <section className="mt-5 rounded-2xl bg-emerald-50 p-5">
        <h2 className="font-bold">{receipt.order.customerName}</h2>
        <p className="mt-2 break-words text-sm">{receipt.order.orderNumber}</p>
        <p className="mt-2 text-xl font-bold text-emerald-800">{money(receipt.order.totalAmount)}</p>
      </section>
      <section className="mt-6 rounded-2xl border border-slate-200 p-5">
        <h2 className="text-lg font-bold">Receipt</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          <a href={pdf} target="_blank" rel="noreferrer" className="rounded-xl bg-[#7a0000] px-5 py-3 font-bold text-white">View PDF</a>
          <a href={`${pdf}?download=1`} className="rounded-xl border border-[#7a0000]/30 px-5 py-3 font-bold text-[#7a0000]">Download PDF</a>
        </div>
      </section>
      {review?.reviewUrl ? <section className="mt-6 grid gap-3 sm:grid-cols-2">
        <a href={review.reviewUrl} rel="noreferrer" className="rounded-2xl border border-slate-200 p-5 font-bold">Leave a Review <span className="mt-2 block text-sm font-normal text-slate-600">Share feedback about your purchase.</span></a>
        {reward ? <a href={review.reviewUrl} rel="noreferrer" className="rounded-2xl border border-amber-200 bg-amber-50 p-5 font-bold">Refer &amp; Earn <span className="mt-2 block text-sm font-normal text-slate-600">Create a tracked referral linked to your purchase.</span></a> : null}
      </section> : null}
      {review?.reviewUrl && reward ? <section className="mt-5 rounded-3xl border border-amber-200 bg-[#fff7df] p-5">
        <h2 className="font-bold text-[#7a0000]">Referral reward for {reward.productName}</h2>
        <p className="mt-4 text-sm">Earn up to</p>
        <p className="mt-1 text-3xl font-black text-[#7a0000]">{money(reward.potentialCommission)}</p>
        <p className="mt-3 text-sm">{reward.commissionType === "PERCENTAGE" ? `${reward.commissionRate}% commission. ` : ""}Tracking period: up to {reward.trackingDays} days.</p>
        <p className="mt-3 text-sm">Rewards apply to qualifying referred purchases{reward.requiresFullPayment ? " after full payment" : ""}.</p>
        <a href={review.reviewUrl} rel="noreferrer" className="mt-5 inline-block rounded-xl bg-[#7a0000] px-5 py-3 font-bold text-white">Start your referral</a>
      </section> : null}
      <footer className="mt-6 text-sm text-slate-600">
        <a href="https://wa.me/254722151083" rel="noreferrer" className="font-bold text-[#7a0000]">Contact Betech Customer Care</a>
        <p className="mt-3">Keep this secure link to view and download your receipt anytime.</p>
      </footer>
    </article>
  </main>;
}
