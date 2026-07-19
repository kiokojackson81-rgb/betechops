"use client";

import { useState } from "react";

type InvitationPayload = {
  invitationId: string;
  token: string;
  isTestMode: boolean;
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
  purchasedItems: Array<{
    productId: string | null;
    name: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    isPrimary: boolean;
  }>;
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

type ReferralDashboardPayload = {
  customerName: string;
  customerPhoneMasked: string;
  status: string;
  activationExpiresAt: string;
  totals: {
    totalReferrals: number;
    potentialCommission: number;
    availableBalance: number;
    pendingWithdrawalAmount: number;
    paidWithdrawalAmount: number;
  };
  referrals: Array<{
    referralCode: string;
    status: string;
    commissionStatus: string;
  }>;
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

function buildReferralShareMessage(input: {
  referredName?: string;
  customerFirstName: string;
  productName: string;
  productPrice: number;
  referralUrl: string;
}) {
  return [
    `Hello${input.referredName ? ` ${input.referredName}` : ""}, ${input.customerFirstName} recently purchased this from Betech Solar Solutions and thought it may help you too.`,
    "",
    `${input.productName}`,
    `Selling price: ${formatMoney(input.productPrice)}`,
    "",
    "View product details and order through this referral link:",
    input.referralUrl,
  ].join("\n");
}

function getFulfillmentCopy(deliveryMode: string | null | undefined) {
  const mode = String(deliveryMode || "").toLowerCase();
  const installationKeywords = ["install", "installation", "installed", "system"];
  const isInstallation = installationKeywords.some((keyword) => mode.includes(keyword));
  return isInstallation
    ? {
        title: "Installation service",
        prompt: "How would you rate the installation service?",
      }
    : {
        title: "Delivery experience",
        prompt: "How would you rate the delivery of your order?",
      };
}

function extractActivationToken(activationUrl: string) {
  try {
    const url = new URL(activationUrl);
    return url.searchParams.get("token");
  } catch {
    return null;
  }
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
    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
      {[1, 2, 3, 4, 5].map((score) => (
        <button
          key={`${name}-${score}`}
          type="button"
          onClick={() => onChange(score)}
          className={`flex h-14 w-14 items-center justify-center rounded-full text-[2.8rem] leading-none transition sm:h-16 sm:w-16 sm:text-[3.2rem] ${score <= value ? "text-amber-400" : "text-slate-300 hover:text-amber-300"}`}
          aria-label={`${score} star${score === 1 ? "" : "s"}`}
          aria-pressed={score <= value}
        >
          ★
        </button>
      ))}
    </div>
  );
}

function MetricCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="rounded-[22px] border border-[#ecd7cb] bg-white px-4 py-4 text-center shadow-[0_14px_35px_rgba(15,23,42,0.04)]">
      <div className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{label}</div>
      <div className={`mt-2 text-2xl font-black tracking-tight ${accent || "text-[#210505]"}`}>{value}</div>
    </div>
  );
}

export default function ReviewJourneyClient({ invitation: initialInvitation }: ReviewJourneyClientProps) {
  const [invitation, setInvitation] = useState(initialInvitation);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [referralError, setReferralError] = useState<string | null>(null);
  const [referralSuccess, setReferralSuccess] = useState<ReferralPayload | null>(null);
  const [referralDashboard, setReferralDashboard] = useState<ReferralDashboardPayload | null>(null);
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
  const rewardRate = 6;
  const projectedCommission = Number((invitation.product.currentPrice * (rewardRate / 100)).toFixed(2));
  const otherPurchasedItems = invitation.purchasedItems.filter((item) => !item.isPrimary);
  const fulfillmentCopy = getFulfillmentCopy(invitation.order.deliveryMode);
  const referralMessagePreview = referralSuccess
    ? buildReferralShareMessage({
        referredName: referralForm.referredName,
        customerFirstName: invitation.customer.firstName,
        productName: invitation.product.name,
        productPrice: invitation.product.currentPrice,
        referralUrl: referralSuccess.referralUrl,
      })
    : null;
  const successfulReferrals =
    referralDashboard?.referrals.filter((item) => item.commissionStatus === "earned" || item.status === "converted").length ?? 0;
  const shareUrl = referralSuccess?.referralUrl || "";
  const activationUrl = referralSuccess?.activationUrl || "";

  async function hydrateReferralDashboard(activationUrlToOpen: string) {
    const token = extractActivationToken(activationUrlToOpen);
    if (!token) return;
    const response = await fetch(`/api/referral-account/dashboard?token=${encodeURIComponent(token)}`);
    const payload = (await response.json()) as { ok: boolean; dashboard?: ReferralDashboardPayload };
    if (response.ok && payload.ok && payload.dashboard) {
      setReferralDashboard(payload.dashboard);
    }
  }

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
      await hydrateReferralDashboard(payload.referral.activationUrl);
    } catch (error) {
      setReferralError(error instanceof Error ? error.message : "Unable to create referral.");
    } finally {
      setCreatingReferral(false);
    }
  }

  async function copyReferralLink() {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.26),transparent_28%),linear-gradient(180deg,#fff8ef_0%,#fffdfb_45%,#f8fafc_100%)] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {invitation.isTestMode ? (
          <section className="rounded-[28px] border border-amber-300/45 bg-[linear-gradient(180deg,#fff7db_0%,#fff2c0_100%)] px-5 py-4 text-[#5a2400] shadow-[0_14px_30px_rgba(245,158,11,0.12)]">
            <div className="text-xs font-black uppercase tracking-[0.22em] text-[#9a3412]">Admin Test Mode</div>
            <div className="mt-2 text-lg font-bold">This is a real test review page.</div>
            <p className="mt-2 text-sm leading-7 text-[#7c2d12]">
              Any review submitted here is saved to the real review workflow for monitoring, but it belongs to the dedicated admin test product only.
            </p>
          </section>
        ) : null}

        {!alreadySubmitted ? (
          <section className="overflow-hidden rounded-[34px] border border-[#7a0000]/10 bg-white shadow-[0_28px_80px_rgba(122,0,0,0.10)]">
            <div className="grid gap-0 xl:grid-cols-[1.02fr_0.98fr]">
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
                    <div className="mt-2 text-lg font-semibold">Pending</div>
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
                      {otherPurchasedItems.length ? (
                        <div className="mt-5 rounded-[22px] border border-[#ecd7cb] bg-[#fff8f2] p-4">
                          <div className="text-xs font-black uppercase tracking-[0.18em] text-[#7a0000]">Other items from this purchase</div>
                          <div className="mt-3 grid gap-2 text-sm text-slate-600">
                            {otherPurchasedItems.map((item, index) => (
                              <div key={`${item.productId || item.name}-${index}`} className="flex flex-wrap justify-between gap-3">
                                <span>
                                  {item.name} x{item.quantity}
                                </span>
                                <span>{formatMoney(item.lineTotal || item.unitPrice * item.quantity)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
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
        ) : null}

        {!alreadySubmitted ? (
          <section className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
            <div className="rounded-[34px] border border-[#ecd7cb] bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.06)] sm:p-8">
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#fff2ec] text-2xl text-[#7a0000]">✦</div>
                <div>
                  <h2 className="text-3xl font-black tracking-tight text-[#210505]">Tell us about your experience</h2>
                  <p className="mt-3 text-sm leading-7 text-slate-600">
                    Your honest review helps other customers make informed decisions.
                  </p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="mt-8 grid gap-5 sm:gap-6">
                <div className="grid gap-4 sm:gap-5 lg:grid-cols-2">
                  <label className="rounded-[24px] border border-[#eddacf] bg-[#fffaf5] p-4 sm:rounded-[26px] sm:p-5">
                    <div className="text-base font-bold text-[#210505]">Overall experience</div>
                    <div className="mt-2 text-sm leading-6 text-slate-600">How would you rate your overall experience with this product?</div>
                    <div className="mt-4">
                      <Stars name="overall" value={form.overallRating} onChange={(value) => setForm((current) => ({ ...current, overallRating: value }))} />
                    </div>
                  </label>
                  <label className="rounded-[24px] border border-[#eddacf] bg-[#fffaf5] p-4 sm:rounded-[26px] sm:p-5">
                    <div className="text-base font-bold text-[#210505]">Product performance</div>
                    <div className="mt-2 text-sm leading-6 text-slate-600">How well is the product performing?</div>
                    <div className="mt-4">
                      <Stars
                        name="performance"
                        value={form.productPerformanceRating}
                        onChange={(value) => setForm((current) => ({ ...current, productPerformanceRating: value }))}
                      />
                    </div>
                  </label>
                  <label className="rounded-[24px] border border-[#eddacf] bg-[#fffaf5] p-4 sm:rounded-[26px] sm:p-5">
                    <div className="text-base font-bold text-[#210505]">{fulfillmentCopy.title}</div>
                    <div className="mt-2 text-sm leading-6 text-slate-600">{fulfillmentCopy.prompt}</div>
                    <div className="mt-4">
                      <Stars
                        name="fulfillment"
                        value={form.fulfillmentRating}
                        onChange={(value) => setForm((current) => ({ ...current, fulfillmentRating: value }))}
                      />
                    </div>
                  </label>
                  <label className="rounded-[24px] border border-[#eddacf] bg-[#fffaf5] p-4 sm:rounded-[26px] sm:p-5">
                    <div className="text-base font-bold text-[#210505]">Customer service</div>
                    <div className="mt-2 text-sm leading-6 text-slate-600">How would you rate the support you received from our team?</div>
                    <div className="mt-4">
                      <Stars
                        name="service"
                        value={form.customerServiceRating}
                        onChange={(value) => setForm((current) => ({ ...current, customerServiceRating: value }))}
                      />
                    </div>
                  </label>
                </div>

                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-[#210505]">Write your review</span>
                  <textarea
                    value={form.reviewBody}
                    onChange={(event) => setForm((current) => ({ ...current, reviewBody: event.target.value }))}
                    placeholder="Share more details about your experience with the product, delivery and service..."
                    rows={7}
                    className="rounded-[24px] border border-[#ddc6ba] bg-white px-4 py-4 outline-none transition focus:border-[#7a0000]/45"
                  />
                </label>

                <div className="grid gap-4 sm:gap-5 lg:grid-cols-[0.9fr_1.1fr]">
                  <label className="grid gap-2">
                    <span className="text-sm font-semibold text-[#210505]">Review title</span>
                    <input
                      value={form.reviewTitle}
                      onChange={(event) => setForm((current) => ({ ...current, reviewTitle: event.target.value }))}
                      placeholder="Reliable system for my home"
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

                <div className="rounded-[24px] border border-[#ecd7cb] bg-[#fffaf5] p-4 sm:rounded-[28px] sm:p-5">
                  <div className="text-sm font-bold text-[#210505]">Are you experiencing any problem with the product?</div>
                  <div className="mt-4 flex flex-wrap gap-4 text-sm">
                    <label className="inline-flex items-center gap-2">
                      <input type="radio" checked={!form.hasProblem} onChange={() => setForm((current) => ({ ...current, hasProblem: false }))} />
                      No, everything is working well
                    </label>
                    <label className="inline-flex items-center gap-2">
                      <input type="radio" checked={form.hasProblem} onChange={() => setForm((current) => ({ ...current, hasProblem: true }))} />
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
                  <span>I allow Betech Solar Solutions to publish my review, first name, town and uploaded media on the website and social media pages.</span>
                </label>

                {submitError ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{submitError}</div> : null}

                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Verified purchase only. One review per invitation.</div>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex min-h-[3.5rem] items-center justify-center rounded-[20px] bg-[#7a0000] px-7 py-3 text-sm font-bold text-white transition hover:bg-[#650000] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitting ? "Submitting review..." : "Submit Review"}
                  </button>
                </div>
              </form>
            </div>

            <div className="rounded-[34px] border border-[#ecd7cb] bg-[linear-gradient(180deg,#fffdfa_0%,#fff4df_100%)] p-6 shadow-[0_20px_60px_rgba(245,158,11,0.12)] sm:p-8">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                <div className="flex h-24 w-24 items-center justify-center rounded-[28px] bg-[radial-gradient(circle_at_top,#fff7d1_0%,#ffd79a_48%,#ffbe6f_100%)] text-[3rem] shadow-[0_18px_40px_rgba(245,158,11,0.18)]">
                  🎁
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-black uppercase tracking-[0.22em] text-[#7a0000]">Refer & earn rewards</div>
                  <h2 className="mt-2 text-3xl font-black tracking-tight text-[#210505]">Share Betech Solar with friends and earn rewards.</h2>
                  <p className="mt-3 text-sm leading-7 text-slate-600">
                    After you submit your review, the normal Betech referral account is activated for this purchase so you can share using the same referral module used across our customer reward flow.
                  </p>
                </div>
              </div>

              <div className="mt-6 rounded-[28px] border border-amber-300/35 bg-[linear-gradient(180deg,#fff4d0_0%,#ffe9ae_100%)] p-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <div className="text-xs font-black uppercase tracking-[0.14em] text-[#7a0000]">Your available reward</div>
                    <div className="mt-2 text-4xl font-black tracking-tight text-[#210505]">{formatMoney(projectedCommission)}</div>
                    <div className="mt-2 text-sm font-medium text-[#6b3d00]">Ready to unlock after your first successful referral.</div>
                  </div>
                  <div className="sm:text-right">
                    <div className="text-xs font-black uppercase tracking-[0.14em] text-[#7a0000]">Reward rate</div>
                    <div className="mt-2 text-4xl font-black tracking-tight text-[#7a0000]">{rewardRate}%</div>
                    <div className="mt-2 text-sm font-medium text-[#6b3d00]">of the product you purchased</div>
                  </div>
                </div>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard label="Friends referred" value="0" />
                <MetricCard label="Successful referrals" value="0" accent="text-[#0f9d58]" />
                <MetricCard label="Total earned" value={formatMoney(0)} accent="text-[#7a0000]" />
                <MetricCard label="Next reward pending" value={formatMoney(projectedCommission)} accent="text-[#d97706]" />
              </div>

              <div className="mt-5 rounded-[26px] border border-[#ecd7cb] bg-white p-5">
                <div className="text-sm font-semibold text-[#210505]">Referral sharing unlocks after review submission</div>
                <p className="mt-2 text-sm leading-7 text-slate-600">
                  Submit the review on the left first. After that, this panel switches into the live referral area with your real share link, WhatsApp/SMS sharing, and your referral dashboard link.
                </p>
              </div>
            </div>
          </section>
        ) : (
          <section className="grid gap-6 xl:grid-cols-[1.02fr_0.98fr]">
            <div className="rounded-[34px] border border-[#ecd7cb] bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.06)] sm:p-8">
              <div className="text-xs font-black uppercase tracking-[0.24em] text-[#7a0000]">Thank you</div>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-[#210505]">Thank you for your review, {invitation.customer.firstName}.</h2>
              <p className="mt-4 text-sm leading-7 text-slate-600">
                Your feedback has been submitted successfully. It will appear on the product page after moderation. If you reported a problem, our support team has already been alerted.
              </p>
              {invitation.isTestMode ? (
                <div className="mt-4 rounded-2xl border border-amber-300/40 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  Test submission recorded successfully. Admin can now refresh the test monitor page and verify the submitted review.
                </div>
              ) : null}

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

            <div className="rounded-[34px] border border-[#ecd7cb] bg-[linear-gradient(180deg,#fffdfa_0%,#fff4df_100%)] p-6 shadow-[0_20px_60px_rgba(245,158,11,0.12)] sm:p-8">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                <div className="flex h-24 w-24 items-center justify-center rounded-[28px] bg-[radial-gradient(circle_at_top,#fff7d1_0%,#ffd79a_48%,#ffbe6f_100%)] text-[3rem] shadow-[0_18px_40px_rgba(245,158,11,0.18)]">
                  🎁
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-black uppercase tracking-[0.22em] text-[#7a0000]">Refer & earn rewards</div>
                  <h2 className="mt-2 text-3xl font-black tracking-tight text-[#210505]">Share Betech Solar and earn {rewardRate}% of your purchase value.</h2>
                  <p className="mt-3 text-sm leading-7 text-slate-600">
                    This referral section now opens into your normal Betech referral account, so your links, earnings and withdrawals stay in one connected dashboard.
                  </p>
                </div>
              </div>

              <div className="mt-6 rounded-[28px] border border-amber-300/35 bg-[linear-gradient(180deg,#fff4d0_0%,#ffe9ae_100%)] p-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <div className="text-xs font-black uppercase tracking-[0.14em] text-[#7a0000]">Your available reward</div>
                    <div className="mt-2 text-4xl font-black tracking-tight text-[#210505]">
                      {formatMoney(referralDashboard?.totals.potentialCommission ?? projectedCommission)}
                    </div>
                    <div className="mt-2 text-sm font-medium text-[#6b3d00]">
                      {referralSuccess ? "Linked to your referral account" : "Create your first referral to unlock sharing"}
                    </div>
                  </div>
                  <div className="sm:text-right">
                    <div className="text-xs font-black uppercase tracking-[0.14em] text-[#7a0000]">Reward rate</div>
                    <div className="mt-2 text-4xl font-black tracking-tight text-[#7a0000]">{rewardRate}%</div>
                    <div className="mt-2 text-sm font-medium text-[#6b3d00]">of the product you purchased</div>
                  </div>
                </div>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard label="Friends referred" value={String(referralDashboard?.totals.totalReferrals ?? 0)} />
                <MetricCard label="Successful referrals" value={String(successfulReferrals)} accent="text-[#0f9d58]" />
                <MetricCard
                  label="Total earned"
                  value={formatMoney((referralDashboard?.totals.availableBalance ?? 0) + (referralDashboard?.totals.paidWithdrawalAmount ?? 0))}
                  accent="text-[#7a0000]"
                />
                <MetricCard label="Next reward pending" value={formatMoney(referralDashboard?.totals.potentialCommission ?? projectedCommission)} accent="text-[#d97706]" />
              </div>

              {!referralSuccess ? (
                <form onSubmit={handleCreateReferral} className="mt-6 space-y-5 rounded-[28px] border border-[#ecd7cb] bg-white p-5">
                  <div className="text-sm font-semibold text-[#210505]">Create your connected referral link</div>
                  <div className="grid gap-4">
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
                  </div>
                  {referralError ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{referralError}</div> : null}
                  <button
                    type="submit"
                    disabled={creatingReferral}
                    className="inline-flex min-h-[3.4rem] w-full items-center justify-center rounded-[20px] bg-[#7a0000] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#650000] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {creatingReferral ? "Creating referral..." : "Create referral link"}
                  </button>
                </form>
              ) : (
                <div className="mt-6 space-y-5 rounded-[28px] border border-[#ecd7cb] bg-white p-5">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(referralMessagePreview || "")}`, "_blank", "noopener,noreferrer")}
                      className="inline-flex min-h-[3.35rem] items-center justify-center rounded-[18px] bg-[#16a34a] px-4 py-3 text-sm font-bold text-white"
                    >
                      Share on WhatsApp
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        window.open(
                          `sms:?body=${encodeURIComponent(referralMessagePreview || "")}`,
                          "_self",
                        )
                      }
                      className="inline-flex min-h-[3.35rem] items-center justify-center rounded-[18px] bg-[#2563eb] px-4 py-3 text-sm font-bold text-white"
                    >
                      Share via SMS
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        window.open(
                          `mailto:?subject=${encodeURIComponent("Betech Solar referral")}&body=${encodeURIComponent(referralMessagePreview || "")}`,
                          "_self",
                        )
                      }
                      className="inline-flex min-h-[3.35rem] items-center justify-center rounded-[18px] border border-[#d7dde7] bg-white px-4 py-3 text-sm font-bold text-[#1f2937]"
                    >
                      Share by Email
                    </button>
                    <button
                      type="button"
                      onClick={copyReferralLink}
                      className="inline-flex min-h-[3.35rem] items-center justify-center rounded-[18px] border border-[#d7dde7] bg-white px-4 py-3 text-sm font-bold text-[#1f2937]"
                    >
                      {copied ? "Link copied" : "Copy link"}
                    </button>
                  </div>

                  <div className="rounded-[22px] border border-[#ecd7cb] bg-[#fffaf5] p-4">
                    <div className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Share your link</div>
                    <div className="mt-3 break-all rounded-2xl border border-[#ddc6ba] bg-white px-4 py-3 text-sm text-slate-700">{shareUrl}</div>
                  </div>

                  <div className="rounded-[22px] border border-[#ecd7cb] bg-[#fffaf5] p-4">
                    <div className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">How it works</div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-4">
                      <MetricCard label="Step 1" value="Share" />
                      <MetricCard label="Step 2" value="They buy" />
                      <MetricCard label="Step 3" value="We verify" />
                      <MetricCard label="Step 4" value="You earn" />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <a
                      href={activationUrl}
                      className="inline-flex min-h-[3.2rem] items-center justify-center rounded-[18px] border border-amber-400/30 bg-amber-50 px-4 py-3 text-sm font-bold text-[#7a0000]"
                    >
                      Open referral dashboard
                    </a>
                    <a
                      href={`/shop/product/${invitation.product.slug}`}
                      className="inline-flex min-h-[3.2rem] items-center justify-center rounded-[18px] border border-[#d7dde7] bg-white px-4 py-3 text-sm font-bold text-[#1f2937]"
                    >
                      View product details
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
