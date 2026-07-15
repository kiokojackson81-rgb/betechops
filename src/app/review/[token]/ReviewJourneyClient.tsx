"use client";

import { useState } from "react";

type InvitationPayload = {
  invitationId: string;
  token: string;
  reviewStatus: string;
  expiresAt: string;
  purchaseDate: string;
  usedAt: string | null;
  customer: {
    firstName: string;
    town: string | null;
    phoneMasked: string;
  };
  product: {
    id: string;
    name: string;
    currentPrice: number;
    warranty: string | null;
    imageUrl: string | null;
    slug: string;
    category: string | null;
  };
  order: {
    orderOrReceiptRef: string | null;
    deliveryMode: string | null;
  };
  review: {
    id: string;
    reviewTitle: string | null;
    reviewBody: string;
    overallRating: number;
    productPerformanceRating: number | null;
    customerServiceRating: number | null;
    fulfillmentRating: number | null;
    fulfillmentType: string | null;
    wouldRecommend: string | null;
    hasProblem: boolean;
    published: boolean;
    moderationStatus: string;
    createdAt: string | null;
  } | null;
};

type ReferralPayload = {
  referralCode: string;
  referralUrl: string;
  potentialCommission: number;
  activationUrl: string;
  product: {
    id: string;
    name: string;
    price: number;
  };
};

type ReviewJourneyClientProps = {
  invitation: InvitationPayload;
};

function formatDate(value: string | null) {
  if (!value) return "Not available";
  return new Intl.DateTimeFormat("en-KE", { dateStyle: "medium" }).format(new Date(value));
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function Stars({
  name,
  value,
  onChange,
}: {
  name: string;
  value: number;
  onChange: (next: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      {[1, 2, 3, 4, 5].map((score) => (
        <button
          key={`${name}-${score}`}
          type="button"
          onClick={() => onChange(score)}
          className={`text-3xl leading-none transition ${score <= value ? "text-amber-400" : "text-slate-300 hover:text-amber-300"}`}
          aria-label={`${score} star${score === 1 ? "" : "s"}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

export default function ReviewJourneyClient({ invitation: initialInvitation }: ReviewJourneyClientProps) {
  const [invitation, setInvitation] = useState(initialInvitation);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [referralError, setReferralError] = useState<string | null>(null);
  const [referralSuccess, setReferralSuccess] = useState<ReferralPayload | null>(null);
  const [creatingReferral, setCreatingReferral] = useState(false);
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState({
    overallRating: invitation.review?.overallRating ?? 5,
    productPerformanceRating: invitation.review?.productPerformanceRating ?? 5,
    customerServiceRating: invitation.review?.customerServiceRating ?? 5,
    fulfillmentRating: invitation.review?.fulfillmentRating ?? 5,
    fulfillmentType: invitation.review?.fulfillmentType ?? invitation.order.deliveryMode ?? "delivery",
    reviewTitle: invitation.review?.reviewTitle ?? "",
    reviewBody: invitation.review?.reviewBody ?? "",
    wouldRecommend: invitation.review?.wouldRecommend ?? "yes",
    hasProblem: invitation.review?.hasProblem ?? false,
    problemDescription: "",
    preferredContactNumber: "",
    bestTimeToContact: "",
    publicationConsent: true,
  });
  const [referralForm, setReferralForm] = useState({
    referredName: "",
    referredPhone: "",
    channel: "whatsapp",
  });

  const alreadySubmitted = Boolean(invitation.review);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setSubmitError(null);

    try {
      const response = await fetch(`/api/reviews/invitations/${invitation.token}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = (await response.json()) as { ok: boolean; invitation?: InvitationPayload; error?: string };
      if (!response.ok || !payload.ok || !payload.invitation) {
        throw new Error(payload.error || "Unable to submit your review.");
      }

      setInvitation(payload.invitation);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Unable to submit your review.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreateReferral(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreatingReferral(true);
    setReferralError(null);

    try {
      const response = await fetch("/api/referrals/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: invitation.token,
          referredName: referralForm.referredName,
          referredPhone: referralForm.referredPhone,
          channel: referralForm.channel,
        }),
      });
      const payload = (await response.json()) as { ok: boolean; referral?: ReferralPayload; error?: string };
      if (!response.ok || !payload.ok || !payload.referral) {
        throw new Error(payload.error || "Unable to create referral.");
      }
      setReferralSuccess(payload.referral);
    } catch (error) {
      setReferralError(error instanceof Error ? error.message : "Unable to create referral.");
    } finally {
      setCreatingReferral(false);
    }
  }

  async function copyReferralLink() {
    if (!referralSuccess?.referralUrl) return;
    await navigator.clipboard.writeText(referralSuccess.referralUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.26),transparent_28%),linear-gradient(180deg,#fff8ef_0%,#fffdfb_45%,#f8fafc_100%)] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="overflow-hidden rounded-[34px] border border-[#7a0000]/10 bg-white shadow-[0_28px_80px_rgba(122,0,0,0.10)]">
          <div className="grid gap-0 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="bg-[linear-gradient(145deg,#210505_0%,#4d0909_48%,#7a0000_100%)] px-6 py-8 text-white sm:px-8">
              <div className="text-xs font-black uppercase tracking-[0.28em] text-amber-300">Verified Purchase Review</div>
              <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-5xl">
                Hello {invitation.customer.firstName}, how is your product performing?
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-7 text-amber-50/90 sm:text-base">
                Thank you for purchasing from Betech Solar Solutions. Share your experience below, then refer a friend or family member and earn after a successful sale.
              </p>

              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                <div className="rounded-[24px] border border-white/10 bg-white/10 p-4 backdrop-blur">
                  <div className="text-xs uppercase tracking-[0.18em] text-amber-200">Purchase date</div>
                  <div className="mt-2 text-lg font-semibold">{formatDate(invitation.purchaseDate)}</div>
                </div>
                <div className="rounded-[24px] border border-white/10 bg-white/10 p-4 backdrop-blur">
                  <div className="text-xs uppercase tracking-[0.18em] text-amber-200">Reference</div>
                  <div className="mt-2 text-lg font-semibold">{invitation.order.orderOrReceiptRef || "Verified order"}</div>
                </div>
                <div className="rounded-[24px] border border-white/10 bg-white/10 p-4 backdrop-blur">
                  <div className="text-xs uppercase tracking-[0.18em] text-amber-200">Review link status</div>
                  <div className="mt-2 text-lg font-semibold">{alreadySubmitted ? "Submitted" : "Pending"}</div>
                </div>
                <div className="rounded-[24px] border border-white/10 bg-white/10 p-4 backdrop-blur">
                  <div className="text-xs uppercase tracking-[0.18em] text-amber-200">Expires</div>
                  <div className="mt-2 text-lg font-semibold">{formatDate(invitation.expiresAt)}</div>
                </div>
              </div>
            </div>

            <div className="bg-[#fff8f2] p-5 sm:p-8">
              <div className="rounded-[28px] border border-[#ecd7cb] bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.07)]">
                <div className="flex flex-col gap-5 sm:flex-row">
                  <div className="h-32 w-full overflow-hidden rounded-[24px] bg-[#fff4e3] sm:h-40 sm:w-40 sm:shrink-0">
                    {invitation.product.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={invitation.product.imageUrl} alt={invitation.product.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center px-4 text-center text-sm font-semibold text-[#7a0000]">
                        Betech Solar
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="inline-flex rounded-full border border-[#0f9d58]/15 bg-[#eefcf4] px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-[#0f9d58]">
                      Verified Purchase
                    </div>
                    <h2 className="mt-3 text-2xl font-black tracking-tight text-[#210505]">{invitation.product.name}</h2>
                    <div className="mt-4 grid gap-2 text-sm text-slate-600">
                      <div>Purchased: {formatDate(invitation.purchaseDate)}</div>
                      <div>Receipt / order: {invitation.order.orderOrReceiptRef || "Verified order"}</div>
                      <div>Current price: {formatMoney(invitation.product.currentPrice)}</div>
                      <div>Warranty: {invitation.product.warranty || "Manufacturer warranty available"}</div>
                    </div>
                    <a
                      href={`/shop/product/${invitation.product.slug}`}
                      className="mt-5 inline-flex rounded-2xl border border-[#7a0000]/15 px-4 py-2 text-sm font-semibold text-[#7a0000] transition hover:bg-[#fff7ee]"
                    >
                      View product details
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {!alreadySubmitted ? (
          <section className="rounded-[34px] border border-[#ecd7cb] bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.06)] sm:p-8">
            <div className="max-w-3xl">
              <div className="text-xs font-black uppercase tracking-[0.24em] text-[#7a0000]">Review form</div>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-[#210505]">Tell us about your experience</h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                Keep it simple. Your review helps other customers make informed decisions, and if you need assistance we will alert our support team immediately.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="mt-8 grid gap-6">
              <div className="grid gap-5 lg:grid-cols-2">
                <label className="rounded-[26px] border border-[#eddacf] bg-[#fffaf5] p-5">
                  <div className="text-sm font-bold text-[#210505]">Overall rating</div>
                  <div className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-500">How would you rate this product?</div>
                  <div className="mt-4">
                    <Stars name="overall" value={form.overallRating} onChange={(value) => setForm((current) => ({ ...current, overallRating: value }))} />
                  </div>
                </label>
                <label className="rounded-[26px] border border-[#eddacf] bg-[#fffaf5] p-5">
                  <div className="text-sm font-bold text-[#210505]">Product performance</div>
                  <div className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-500">How well is the product performing?</div>
                  <div className="mt-4">
                    <Stars
                      name="performance"
                      value={form.productPerformanceRating}
                      onChange={(value) => setForm((current) => ({ ...current, productPerformanceRating: value }))}
                    />
                  </div>
                </label>
                <label className="rounded-[26px] border border-[#eddacf] bg-[#fffaf5] p-5">
                  <div className="text-sm font-bold text-[#210505]">Customer service</div>
                  <div className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-500">How would you rate our customer service?</div>
                  <div className="mt-4">
                    <Stars
                      name="service"
                      value={form.customerServiceRating}
                      onChange={(value) => setForm((current) => ({ ...current, customerServiceRating: value }))}
                    />
                  </div>
                </label>
                <label className="rounded-[26px] border border-[#eddacf] bg-[#fffaf5] p-5">
                  <div className="text-sm font-bold text-[#210505]">Delivery or installation</div>
                  <div className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-500">Rate the relevant part of fulfilment</div>
                  <div className="mt-4">
                    <Stars
                      name="fulfillment"
                      value={form.fulfillmentRating}
                      onChange={(value) => setForm((current) => ({ ...current, fulfillmentRating: value }))}
                    />
                  </div>
                </label>
              </div>

              <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-[#210505]">Review title</span>
                  <input
                    value={form.reviewTitle}
                    onChange={(event) => setForm((current) => ({ ...current, reviewTitle: event.target.value }))}
                    placeholder="Reliable hot-water system for my family"
                    className="rounded-2xl border border-[#ddc6ba] bg-white px-4 py-3 outline-none transition focus:border-[#7a0000]/45"
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-[#210505]">Would you recommend this product?</span>
                  <select
                    value={form.wouldRecommend}
                    onChange={(event) => setForm((current) => ({ ...current, wouldRecommend: event.target.value }))}
                    className="rounded-2xl border border-[#ddc6ba] bg-white px-4 py-3 outline-none transition focus:border-[#7a0000]/45"
                  >
                    <option value="yes">Yes</option>
                    <option value="maybe">Maybe</option>
                    <option value="no">No</option>
                  </select>
                </label>
              </div>

              <label className="grid gap-2">
                <span className="text-sm font-semibold text-[#210505]">Written review</span>
                <textarea
                  value={form.reviewBody}
                  onChange={(event) => setForm((current) => ({ ...current, reviewBody: event.target.value }))}
                  placeholder="What did you like about the product? How is it performing? Would you recommend it to another customer?"
                  rows={7}
                  className="rounded-[24px] border border-[#ddc6ba] bg-white px-4 py-4 outline-none transition focus:border-[#7a0000]/45"
                />
              </label>

              <div className="rounded-[28px] border border-[#ecd7cb] bg-[#fffaf5] p-5">
                <div className="text-sm font-bold text-[#210505]">Are you experiencing any problem with the product?</div>
                <div className="mt-4 flex flex-wrap gap-4 text-sm">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="radio"
                      checked={!form.hasProblem}
                      onChange={() => setForm((current) => ({ ...current, hasProblem: false }))}
                    />
                    No, everything is working well
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="radio"
                      checked={form.hasProblem}
                      onChange={() => setForm((current) => ({ ...current, hasProblem: true }))}
                    />
                    Yes, I need assistance
                  </label>
                </div>

                {form.hasProblem ? (
                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <label className="grid gap-2 md:col-span-2">
                      <span className="text-sm font-semibold text-[#210505]">Please describe the issue</span>
                      <textarea
                        value={form.problemDescription}
                        onChange={(event) => setForm((current) => ({ ...current, problemDescription: event.target.value }))}
                        rows={4}
                        className="rounded-2xl border border-[#ddc6ba] bg-white px-4 py-3 outline-none transition focus:border-[#7a0000]/45"
                      />
                    </label>
                    <label className="grid gap-2">
                      <span className="text-sm font-semibold text-[#210505]">Preferred contact number</span>
                      <input
                        value={form.preferredContactNumber}
                        onChange={(event) => setForm((current) => ({ ...current, preferredContactNumber: event.target.value }))}
                        className="rounded-2xl border border-[#ddc6ba] bg-white px-4 py-3 outline-none transition focus:border-[#7a0000]/45"
                      />
                    </label>
                    <label className="grid gap-2">
                      <span className="text-sm font-semibold text-[#210505]">Best time to contact you</span>
                      <input
                        value={form.bestTimeToContact}
                        onChange={(event) => setForm((current) => ({ ...current, bestTimeToContact: event.target.value }))}
                        className="rounded-2xl border border-[#ddc6ba] bg-white px-4 py-3 outline-none transition focus:border-[#7a0000]/45"
                      />
                    </label>
                  </div>
                ) : null}
              </div>

              <label className="inline-flex items-start gap-3 rounded-[24px] border border-[#ecd7cb] bg-[#fffaf5] px-4 py-4 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.publicationConsent}
                  onChange={(event) => setForm((current) => ({ ...current, publicationConsent: event.target.checked }))}
                  className="mt-1"
                />
                <span>
                  I allow Betech Solar Solutions to publish my review, first name, town and uploaded media on the website and social media pages.
                </span>
              </label>

              {submitError ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{submitError}</div> : null}

              <div className="flex flex-wrap items-center gap-4">
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex min-h-[3.5rem] items-center justify-center rounded-[20px] bg-[#7a0000] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#650000] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? "Submitting review..." : "Submit my review"}
                </button>
                <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Verified purchase only. One review per invitation.</div>
              </div>
            </form>
          </section>
        ) : (
          <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="rounded-[34px] border border-[#ecd7cb] bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.06)] sm:p-8">
              <div className="text-xs font-black uppercase tracking-[0.24em] text-[#7a0000]">Thank you</div>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-[#210505]">Thank you for your review, {invitation.customer.firstName}.</h2>
              <p className="mt-4 text-sm leading-7 text-slate-600">
                Your feedback has been submitted successfully. It will appear on the product page after moderation. If you reported a problem, our support team has already been alerted.
              </p>

              <div className="mt-6 rounded-[28px] border border-[#eddacf] bg-[#fffaf5] p-5">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Submitted review</div>
                <div className="mt-2 text-xl font-bold text-[#210505]">{invitation.review?.reviewTitle || "Customer review submitted"}</div>
                <div className="mt-3 text-sm text-slate-600">{invitation.review?.reviewBody}</div>
                <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-600">
                  <span>Overall: {invitation.review?.overallRating}/5</span>
                  <span>Recommend: {invitation.review?.wouldRecommend || "Not specified"}</span>
                  <span>Status: {invitation.review?.moderationStatus || "pending"}</span>
                </div>
              </div>
            </div>

            <div className="rounded-[34px] border border-[#ecd7cb] bg-[linear-gradient(180deg,#fff8ee_0%,#fff3df_100%)] p-6 shadow-[0_20px_60px_rgba(245,158,11,0.12)] sm:p-8">
              <div className="text-xs font-black uppercase tracking-[0.24em] text-[#7a0000]">Refer and earn</div>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-[#210505]">Could you recommend this product to a friend, family member, neighbour or business?</h2>
              <div className="mt-5 rounded-[28px] border border-amber-400/20 bg-white p-5">
                <div className="text-sm font-semibold text-slate-500">Product</div>
                <div className="mt-2 text-2xl font-black tracking-tight text-[#210505]">{invitation.product.name}</div>
                <div className="mt-4 grid gap-2 text-sm text-slate-700">
                  <div>Selling price: {formatMoney(invitation.product.currentPrice)}</div>
                  <div>Your commission after a completed sale: approximately based on current policy</div>
                </div>
              </div>

              {!referralSuccess ? (
                <form onSubmit={handleCreateReferral} className="mt-6 grid gap-4">
                  <label className="grid gap-2">
                    <span className="text-sm font-semibold text-[#210505]">Friend or family member&apos;s phone number</span>
                    <input
                      value={referralForm.referredPhone}
                      onChange={(event) => setReferralForm((current) => ({ ...current, referredPhone: event.target.value }))}
                      placeholder="0712345678"
                      className="rounded-2xl border border-[#ddc6ba] bg-white px-4 py-3 outline-none transition focus:border-[#7a0000]/45"
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm font-semibold text-[#210505]">Name (optional)</span>
                    <input
                      value={referralForm.referredName}
                      onChange={(event) => setReferralForm((current) => ({ ...current, referredName: event.target.value }))}
                      placeholder="Peter"
                      className="rounded-2xl border border-[#ddc6ba] bg-white px-4 py-3 outline-none transition focus:border-[#7a0000]/45"
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm font-semibold text-[#210505]">Send via</span>
                    <select
                      value={referralForm.channel}
                      onChange={(event) => setReferralForm((current) => ({ ...current, channel: event.target.value }))}
                      className="rounded-2xl border border-[#ddc6ba] bg-white px-4 py-3 outline-none transition focus:border-[#7a0000]/45"
                    >
                      <option value="whatsapp">WhatsApp</option>
                      <option value="sms">SMS</option>
                      <option value="copy">Copy link</option>
                    </select>
                  </label>
                  {referralError ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{referralError}</div> : null}
                  <button
                    type="submit"
                    disabled={creatingReferral}
                    className="inline-flex min-h-[3.4rem] items-center justify-center rounded-[20px] bg-[#7a0000] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#650000] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {creatingReferral ? "Creating referral..." : "Refer now"}
                  </button>
                </form>
              ) : (
                <div className="mt-6 space-y-4 rounded-[28px] border border-[#ddc6ba] bg-white p-5">
                  <div className="text-sm font-semibold text-[#210505]">Referral created successfully</div>
                  <div className="grid gap-2 text-sm text-slate-700">
                    <div>Referral code: {referralSuccess.referralCode}</div>
                    <div>Potential commission: {formatMoney(referralSuccess.potentialCommission)}</div>
                    <div className="break-all">Referral link: {referralSuccess.referralUrl}</div>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <a
                      href={`https://wa.me/?text=${encodeURIComponent(
                        `Hello${referralForm.referredName ? ` ${referralForm.referredName}` : ""}, I recently purchased this product from Betech Solar Solutions and thought it might help you too.\n\n${invitation.product.name}\nPrice: ${formatMoney(invitation.product.currentPrice)}\n\nView product details here:\n${referralSuccess.referralUrl}`,
                      )}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex rounded-2xl bg-[#0f9d58] px-4 py-3 text-sm font-bold text-white"
                    >
                      Refer via WhatsApp
                    </a>
                    <button
                      type="button"
                      onClick={copyReferralLink}
                      className="inline-flex rounded-2xl border border-[#7a0000]/18 bg-white px-4 py-3 text-sm font-bold text-[#7a0000]"
                    >
                      {copied ? "Link copied" : "Copy referral link"}
                    </button>
                    <a
                      href={referralSuccess.activationUrl}
                      className="inline-flex rounded-2xl border border-amber-400/30 bg-amber-50 px-4 py-3 text-sm font-bold text-[#7a0000]"
                    >
                      View my referral dashboard
                    </a>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
