"use client";

import { useRef, useState, type KeyboardEvent } from "react";

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
  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, score: number) {
    if (event.key === "ArrowRight" || event.key === "ArrowUp") {
      event.preventDefault();
      onChange(Math.min(5, score + 1));
      return;
    }
    if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
      event.preventDefault();
      onChange(Math.max(1, score - 1));
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      onChange(1);
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      onChange(5);
      return;
    }
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      onChange(score);
    }
  }

  return (
    <div
      role="radiogroup"
      aria-label={`${name} rating`}
      aria-describedby={`${name}-rating-status`}
      className="grid w-full grid-cols-5 gap-3 sm:gap-4"
    >
      {[1, 2, 3, 4, 5].map((score) => (
        <button
          key={`${name}-${score}`}
          type="button"
          onClick={() => onChange(score)}
          onKeyDown={(event) => handleKeyDown(event, score)}
          role="radio"
          aria-checked={score === value}
          aria-label={`Rate ${score} star${score === 1 ? "" : "s"}`}
          className={`group flex min-h-[5.5rem] w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-[22px] border px-2 py-3 text-center outline-none transition duration-200 ease-out focus-visible:ring-2 focus-visible:ring-[#7a0000]/30 focus-visible:ring-offset-2 sm:min-h-[6.2rem] ${
            score === value
              ? "scale-[1.05] border-[#f59e0b] bg-[#FBBF24] text-white shadow-[0_16px_34px_rgba(251,191,36,0.34)]"
              : "border-slate-200 bg-white text-slate-400 shadow-[0_10px_24px_rgba(15,23,42,0.04)] hover:border-[#fbbf24] hover:bg-amber-50 hover:text-[#f59e0b] hover:shadow-[0_16px_30px_rgba(251,191,36,0.16)]"
          }`}
        >
          <span
            aria-hidden="true"
            className={`flex h-14 w-14 items-center justify-center rounded-[18px] text-[1.8rem] leading-none transition duration-200 sm:h-[60px] sm:w-[60px] sm:text-[2rem] ${
              score === value
                ? "bg-white/18 text-white"
                : "bg-slate-50 text-slate-300 group-hover:bg-amber-100 group-hover:text-[#f59e0b]"
            }`}
          >
            ★
          </span>
          <span
            className={`text-sm font-black leading-none transition ${
              score === value ? "text-white" : "text-slate-500 group-hover:text-[#b45309]"
            }`}
          >
            {score}
          </span>
        </button>
      ))}
      <div id={`${name}-rating-status`} className="sr-only">
        Selected rating: {value} out of 5
      </div>
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

function RatingField({
  index,
  title,
  prompt,
  name,
  value,
  onChange,
}: {
  index: string;
  title: string;
  prompt: string;
  name: string;
  value: number;
  onChange: (next: number) => void;
}) {
  return (
    <label className="rounded-[26px] border border-[#ecd7cb] bg-[linear-gradient(180deg,#ffffff_0%,#fffaf5_100%)] p-5 shadow-[0_16px_36px_rgba(15,23,42,0.04)]">
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#fff3ea] text-sm font-black text-[#7a0000]">
          {index}
        </div>
        <div className="min-w-0">
          <div className="text-lg font-black tracking-tight text-[#210505]">{title}</div>
          <div className="mt-1 text-sm leading-6 text-slate-600">{prompt}</div>
        </div>
      </div>
      <div className="mt-5">
        <Stars name={name} value={value} onChange={onChange} />
      </div>
    </label>
  );
}

export default function ReviewJourneyClient({ invitation: initialInvitation }: ReviewJourneyClientProps) {
  const reviewFormRef = useRef<HTMLFormElement | null>(null);
  const [invitation, setInvitation] = useState(initialInvitation);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [referralError, setReferralError] = useState<string | null>(null);
  const [referralSuccess, setReferralSuccess] = useState<ReferralPayload | null>(null);
  const [referralDashboard, setReferralDashboard] = useState<ReferralDashboardPayload | null>(null);
  const [creatingReferral, setCreatingReferral] = useState(false);
  const [showReferralForm, setShowReferralForm] = useState(true);
  const [referralTab, setReferralTab] = useState<"product" | "program">("product");
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

  function openShareChannel(message: string, channel: string) {
    if (channel === "whatsapp") {
      window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
      return;
    }
    if (channel === "phone") {
      const phone = referralForm.referredPhone.trim();
      if (phone) {
        window.open(`tel:${phone}`, "_self");
      }
      return;
    }
    if (channel === "sms") {
      window.open(`sms:?body=${encodeURIComponent(message)}`, "_self");
      return;
    }
    if (channel === "email") {
      window.open(
        `mailto:?subject=${encodeURIComponent("Betech Solar referral")}&body=${encodeURIComponent(message)}`,
        "_self",
      );
      return;
    }
    if (channel === "copy") {
      navigator.clipboard.writeText(message);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
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
      const shareMessage = buildReferralShareMessage({
        referredName: referralForm.referredName,
        customerFirstName: invitation.customer.firstName,
        productName: invitation.product.name,
        productPrice: invitation.product.currentPrice,
        referralUrl: payload.referral.referralUrl,
      });
      openShareChannel(shareMessage, referralForm.channel);
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

  function openReferralStart() {
    setReferralTab("product");
    setShowReferralForm(true);
    window.setTimeout(() => {
      reviewFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }

  function renderReferralEntryCard(isPresubmit: boolean) {
    if (referralSuccess) return null;
    if (!showReferralForm) return null;
    return (
      <form onSubmit={handleCreateReferral} className="rounded-[28px] border border-[#ecd7cb] bg-white p-5">
        <div className="text-sm font-semibold text-[#210505]">Refer Someone</div>
        <p className="mt-2 text-sm leading-7 text-slate-600">
          Enter the details of the person you&apos;d like to refer. We&apos;ll contact them professionally about <span className="font-semibold text-[#210505]">{invitation.product.name}</span>, track any purchase made within the next 3 months, and automatically credit your commission after a successful purchase.
        </p>
        <div className="mt-5 grid gap-4">
          <label className="grid gap-2">
            <span className="text-sm font-semibold text-[#210505]">Friend&apos;s Phone Number</span>
            <input
              value={referralForm.referredPhone}
              onChange={(event) => setReferralForm((current) => ({ ...current, referredPhone: event.target.value }))}
              placeholder="0712345678"
              className="rounded-2xl border border-[#ddc6ba] bg-white px-4 py-3 outline-none transition focus:border-[#7a0000]/45"
            />
            <span className="text-xs leading-6 text-slate-500">
              This number is used only to track your referral and contact them about {invitation.product.name}.
            </span>
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-semibold text-[#210505]">Friend&apos;s Name (Optional)</span>
            <input
              value={referralForm.referredName}
              onChange={(event) => setReferralForm((current) => ({ ...current, referredName: event.target.value }))}
              placeholder="Peter"
              className="rounded-2xl border border-[#ddc6ba] bg-white px-4 py-3 outline-none transition focus:border-[#7a0000]/45"
            />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-semibold text-[#210505]">Preferred Contact Method</span>
            <select
              value={referralForm.channel}
              onChange={(event) => setReferralForm((current) => ({ ...current, channel: event.target.value }))}
              className="rounded-2xl border border-[#ddc6ba] bg-white px-4 py-3 outline-none transition focus:border-[#7a0000]/45"
            >
              <option value="whatsapp">WhatsApp</option>
              <option value="phone">Phone Call</option>
              <option value="sms">SMS</option>
              <option value="email">Email</option>
              <option value="copy">Copy link</option>
            </select>
          </label>
        </div>
        {referralError ? <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{referralError}</div> : null}
        <button
          type="submit"
          disabled={creatingReferral}
          className="mt-5 inline-flex min-h-[3.4rem] w-full items-center justify-center rounded-[20px] bg-[#7a0000] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#650000] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {creatingReferral ? "Submitting referral..." : "Submit Referral"}
        </button>
        {isPresubmit ? (
          <div className="mt-3 text-center text-sm text-slate-500">
            You can submit a referral before or after leaving your review.
          </div>
        ) : null}
      </form>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.18),transparent_22%),radial-gradient(circle_at_top_right,rgba(122,0,0,0.08),transparent_25%),linear-gradient(180deg,#fffaf3_0%,#fffefc_42%,#f8fafc_100%)] px-4 py-6 sm:px-6 lg:px-8">
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
          <>
            <section className="overflow-hidden rounded-[28px] border border-[#7a0000]/10 bg-[linear-gradient(145deg,#2a0606_0%,#641010_52%,#930d0d_100%)] px-5 py-6 text-white shadow-[0_24px_60px_rgba(122,0,0,0.12)] sm:hidden">
              <h1 className="text-[2rem] font-black leading-[1.02] tracking-tight">
                Hello {invitation.customer.firstName} 👋
              </h1>
              <p className="mt-4 text-xl font-black leading-tight text-white">
                How has your experience been with {invitation.product.name}?
              </p>
              <p className="mt-4 text-sm leading-7 text-amber-50/92">
                We&apos;d love to hear your feedback. Your review helps us improve our service and helps other customers make informed purchasing decisions.
              </p>
            </section>

            <section className="hidden overflow-hidden rounded-[36px] border border-[#7a0000]/10 bg-white shadow-[0_28px_80px_rgba(122,0,0,0.08)] sm:block">
            <div className="grid gap-0 xl:grid-cols-[1.02fr_0.98fr]">
              <div className="bg-[linear-gradient(145deg,#2a0606_0%,#641010_52%,#930d0d_100%)] px-6 py-8 text-white sm:px-8 sm:py-9">
                <div className="text-xs font-black uppercase tracking-[0.28em] text-amber-300">Verified Purchase Review</div>
                <h1 className="mt-4 max-w-2xl text-3xl font-black tracking-tight sm:text-[3.3rem] sm:leading-[1.02]">
                  Hello {invitation.customer.firstName} 👋
                </h1>
                <div className="mt-4 max-w-2xl text-2xl font-black tracking-tight sm:text-[2.6rem] sm:leading-[1.08]">
                  How has your experience been with {invitation.product.name}?
                </div>
                <p className="mt-4 max-w-xl text-sm leading-7 text-amber-50/92 sm:text-base">
                  We&apos;d love to hear your feedback. Your review helps us improve our service and helps other customers make informed purchasing decisions.
                </p>

                <div className="mt-8 grid gap-3 sm:grid-cols-2">
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

              <div className="bg-[linear-gradient(180deg,#fff9f3_0%,#fffdfb_100%)] p-5 sm:p-7">
                <div className="rounded-[30px] border border-[#ecd7cb] bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.07)] sm:p-6">
                  <div className="flex flex-col gap-5 sm:flex-row">
                    <div className="h-32 w-full overflow-hidden rounded-[24px] bg-[#fff4e3] sm:h-44 sm:w-44 sm:shrink-0">
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
                      <h2 className="mt-3 text-2xl font-black tracking-tight text-[#210505] sm:text-[2rem]">{invitation.product.name}</h2>
                      <div className="mt-4 grid gap-2 text-sm leading-6 text-slate-600">
                        <div>Purchased: {formatDate(invitation.purchaseDate)}</div>
                        <div>Receipt / order: {invitation.order.orderOrReceiptRef || "Verified order"}</div>
                        <div>Current price: {formatMoney(invitation.product.currentPrice)}</div>
                        <div>Warranty: {invitation.product.warranty || "Manufacturer warranty available"}</div>
                      </div>
                      {otherPurchasedItems.length ? (
                        <div className="mt-5 rounded-[24px] border border-[#ecd7cb] bg-[#fff8f2] p-4">
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
                        className="mt-5 inline-flex min-h-[3rem] items-center justify-center rounded-2xl border border-[#7a0000]/15 px-4 py-2 text-sm font-semibold text-[#7a0000] transition hover:bg-[#fff7ee]"
                      >
                        View product details
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            </section>
          </>
        ) : null}

        {!alreadySubmitted ? (
          <section className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
            <div className="overflow-hidden rounded-[36px] border border-[#ecd7cb] bg-white shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
              <div className="border-b border-[#f1e3d9] bg-[linear-gradient(180deg,#fffdf9_0%,#fff5ec_100%)] px-6 py-6 sm:px-8">
                <div className="max-w-3xl">
                  <div className="max-w-2xl">
                    <div className="text-xs font-black uppercase tracking-[0.24em] text-[#7a0000]">Share your experience</div>
                    <h2 className="mt-3 text-3xl font-black tracking-tight text-[#210505] sm:text-[2.5rem]">Share Your Experience</h2>
                    <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">
                      Please rate your experience with {invitation.product.name}, delivery, and customer support. Your honest feedback helps us improve and assists future customers in making confident decisions.
                    </p>
                  </div>
                </div>
              </div>

              <form ref={reviewFormRef} onSubmit={handleSubmit} className="grid gap-6 p-6 sm:p-8">
                <div className="grid gap-4 sm:gap-5 lg:grid-cols-2">
                  <RatingField
                    index="1"
                    title="Overall Experience"
                    prompt="How satisfied are you with your overall experience?"
                    name="overall"
                    value={form.overallRating}
                    onChange={(value) => setForm((current) => ({ ...current, overallRating: value }))}
                  />
                  <RatingField
                    index="2"
                    title="Product Performance"
                    prompt={`How well is ${invitation.product.name} meeting your expectations?`}
                    name="performance"
                    value={form.productPerformanceRating}
                    onChange={(value) => setForm((current) => ({ ...current, productPerformanceRating: value }))}
                  />
                  <RatingField
                    index="3"
                    title={fulfillmentCopy.title}
                    prompt={String(fulfillmentCopy.title).toLowerCase().includes("installation") ? "How satisfied were you with the installation service?" : "How satisfied were you with the delivery process?"}
                    name="fulfillment"
                    value={form.fulfillmentRating}
                    onChange={(value) => setForm((current) => ({ ...current, fulfillmentRating: value }))}
                  />
                  <RatingField
                    index="4"
                    title="Customer Service"
                    prompt="How would you rate the support you received from our team?"
                    name="service"
                    value={form.customerServiceRating}
                    onChange={(value) => setForm((current) => ({ ...current, customerServiceRating: value }))}
                  />
                </div>

                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-[#210505]">Tell us more</span>
                  <textarea
                    value={form.reviewBody}
                    onChange={(event) => setForm((current) => ({ ...current, reviewBody: event.target.value }))}
                    placeholder={`Share what you liked, how ${invitation.product.name} is performing, or anything we can improve.`}
                    rows={7}
                    className="rounded-[24px] border border-[#ddc6ba] bg-[#fffefd] px-4 py-4 outline-none transition focus:border-[#7a0000]/45"
                  />
                </label>

                <div className="grid gap-4 sm:gap-5 lg:grid-cols-[0.9fr_1.1fr]">
                  <label className="grid gap-2">
                    <span className="text-sm font-semibold text-[#210505]">Review Title</span>
                    <input
                      value={form.reviewTitle}
                      onChange={(event) => setForm((current) => ({ ...current, reviewTitle: event.target.value }))}
                      placeholder="Excellent quality"
                      className="rounded-2xl border border-[#ddc6ba] bg-white px-4 py-3 outline-none transition focus:border-[#7a0000]/45"
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm font-semibold text-[#210505]">Would you recommend {invitation.product.name} to your friends or family?</span>
                    <select
                      value={form.wouldRecommend}
                      onChange={(event) => setForm((current) => ({ ...current, wouldRecommend: event.target.value }))}
                      className="rounded-2xl border border-[#ddc6ba] bg-white px-4 py-3 outline-none transition focus:border-[#7a0000]/45"
                    >
                      <option value="yes">Definitely Yes</option>
                      <option value="maybe">Maybe</option>
                      <option value="no">Not at the moment</option>
                    </select>
                  </label>
                </div>

                <div className="rounded-[24px] border border-[#ecd7cb] bg-[#fffaf5] p-4 sm:rounded-[28px] sm:p-5">
                  <div className="text-sm font-bold text-[#210505]">Is everything working as expected?</div>
                  <div className="mt-4 flex flex-wrap gap-4 text-sm">
                    <label className="inline-flex items-center gap-2">
                      <input type="radio" checked={!form.hasProblem} onChange={() => setForm((current) => ({ ...current, hasProblem: false }))} />
                      ✅ Yes, everything is working perfectly.
                    </label>
                    <label className="inline-flex items-center gap-2">
                      <input type="radio" checked={form.hasProblem} onChange={() => setForm((current) => ({ ...current, hasProblem: true }))} />
                      🛠️ I need assistance from the support team.
                    </label>
                  </div>

                  {form.hasProblem ? (
                    <div className="mt-5 grid gap-4 md:grid-cols-2">
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 md:col-span-2">
                        Our support team will contact you as soon as possible to help resolve the issue.
                      </div>
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
                  <span>I agree that Betech Solar Solutions may publish my review, first name, town, and any photos or videos I upload on our website and social media pages.</span>
                </label>

                {submitError ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{submitError}</div> : null}

                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Only verified customers can submit a review. Each invitation can only be used once.</div>
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

            <div className="rounded-[36px] border border-[#ecd7cb] bg-[linear-gradient(180deg,#fffdf9_0%,#fff3dd_100%)] p-6 shadow-[0_20px_60px_rgba(245,158,11,0.12)] sm:p-7">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                <div className="flex h-20 w-20 items-center justify-center rounded-[26px] bg-[radial-gradient(circle_at_top,#fff7d1_0%,#ffd79a_48%,#ffbe6f_100%)] text-[2.7rem] shadow-[0_18px_40px_rgba(245,158,11,0.18)]">
                  🎁
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-black uppercase tracking-[0.22em] text-[#7a0000]">Refer Friends & Family — Earn Rewards</div>
                  <h2 className="mt-2 text-3xl font-black tracking-tight text-[#210505] sm:text-[2.35rem]">
                    Know someone who could benefit from {invitation.product.name}?
                  </h2>
                  <p className="mt-3 text-sm leading-7 text-slate-600">
                    Refer them today and earn a commission when they complete a successful purchase.
                  </p>
                  <div className="mt-4 space-y-2 text-sm font-medium text-slate-700">
                    <div>✔ No paperwork</div>
                    <div>✔ We automatically track your referral using the phone number you provide.</div>
                    <div>✔ Your commission is credited after the purchase is confirmed.</div>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setReferralTab("product")}
                  className={`inline-flex min-h-[3rem] items-center justify-center rounded-[18px] px-4 py-2 text-sm font-bold transition ${referralTab === "product" ? "bg-[#7a0000] text-white" : "border border-[#ddc6ba] bg-white text-[#210505]"}`}
                >
                  Refer this product
                </button>
                <button
                  type="button"
                  onClick={() => setReferralTab("program")}
                  className={`inline-flex min-h-[3rem] items-center justify-center rounded-[18px] px-4 py-2 text-sm font-bold transition ${referralTab === "program" ? "bg-[#7a0000] text-white" : "border border-[#ddc6ba] bg-white text-[#210505]"}`}
                >
                  Join referral program
                </button>
              </div>

              {referralTab === "product" ? (
                <>
                  <div className="mt-5 rounded-[32px] border border-amber-300/35 bg-[linear-gradient(180deg,#fff5d3_0%,#ffebb7_100%)] p-6 shadow-[0_18px_40px_rgba(245,158,11,0.14)]">
                    <div className="grid gap-5 md:grid-cols-[1.2fr_0.8fr] md:items-center">
                      <div>
                        <div className="text-xs font-black uppercase tracking-[0.14em] text-[#7a0000]">Earn up to</div>
                        <div className="mt-3 text-5xl font-black tracking-tight text-[#7a0000] sm:text-6xl">
                          {formatMoney(referralDashboard?.totals.potentialCommission ?? projectedCommission)}
                        </div>
                        <div className="mt-4 text-base font-medium leading-7 text-[#6b3d00]">
                          Earn up to {formatMoney(projectedCommission)} when someone you refer completes a purchase for <span className="font-bold text-[#210505]">{invitation.product.name}</span>.
                        </div>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-1">
                        <div className="rounded-[22px] border border-white/50 bg-white/70 px-4 py-4">
                          <div className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Commission Rate</div>
                          <div className="mt-2 text-3xl font-black text-[#7a0000]">{rewardRate}%</div>
                        </div>
                        <div className="rounded-[22px] border border-white/50 bg-white/70 px-4 py-4">
                          <div className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Referral Validity</div>
                          <div className="mt-2 text-lg font-bold text-[#210505]">Up to 3 months</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 rounded-[30px] border border-[#f0dccf] bg-white/80 p-4 shadow-[0_18px_40px_rgba(15,23,42,0.05)] sm:p-5">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-black uppercase tracking-[0.18em] text-[#7a0000]">Refer someone</div>
                        <div className="mt-1 text-lg font-black tracking-tight text-[#210505]">Start earning today</div>
                      </div>
                      <div className="rounded-full border border-amber-300/50 bg-amber-50 px-3 py-1 text-xs font-bold text-[#7a0000]">
                        Valid for 3 Months
                      </div>
                    </div>
                    <div className="mb-5 rounded-[24px] border border-[#ecd7cb] bg-[#fffaf5] p-4">
                      <div className="text-sm font-bold text-[#210505]">How the Referral Program Works</div>
                      <div className="mt-3 grid gap-2 text-sm leading-7 text-slate-600">
                        <div>Share the phone number of someone interested in {invitation.product.name}.</div>
                        <div>We contact them professionally and provide product information.</div>
                        <div>If they purchase within 3 months, your referral is automatically matched.</div>
                        <div>Your commission is credited to your referral account.</div>
                        <div>You can refer as many people as you like.</div>
                      </div>
                    </div>
                    {renderReferralEntryCard(true)}
                  </div>
                </>
              ) : (
                <div className="mt-5 rounded-[30px] border border-[#ecd7cb] bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
                  <div className="text-xs font-black uppercase tracking-[0.14em] text-[#7a0000]">Join our referral program</div>
                  <h3 className="mt-3 text-3xl font-black tracking-tight text-[#210505]">
                    Join our referral program and earn more than Ksh 100,000 per referral.
                  </h3>
                  <p className="mt-4 text-sm leading-7 text-slate-600">
                    Open the full Betech referral program to access your wider referral dashboard, withdrawals, and larger commission opportunities beyond this single product referral.
                  </p>
                  <a
                    href="https://agents.betech.co.ke/"
                    target="_blank"
                    rel="noreferrer"
                    className="mt-5 inline-flex min-h-[3.4rem] w-full items-center justify-center rounded-[20px] bg-[#7a0000] px-6 py-3 text-sm font-bold text-white"
                  >
                    Join referral program
                  </a>
                </div>
              )}
            </div>
          </section>
        ) : (
          <section className="grid gap-6 xl:grid-cols-[1.02fr_0.98fr]">
            <div className="overflow-hidden rounded-[36px] border border-[#ecd7cb] bg-white shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
              <div className="bg-[linear-gradient(145deg,#2a0606_0%,#641010_52%,#930d0d_100%)] px-6 py-7 text-white sm:px-8 sm:py-8">
                <div className="text-xs font-black uppercase tracking-[0.24em] text-amber-300">Thank you</div>
                <h2 className="mt-3 max-w-2xl text-3xl font-black tracking-tight sm:text-[3rem] sm:leading-[1.04]">
                  Thank you for your review, {invitation.customer.firstName}.
                </h2>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-amber-50/92 sm:text-base">
                  Your feedback has been submitted successfully. It will appear on the product page after moderation. If you reported a problem, our support team has already been alerted.
                </p>
              </div>

              <div className="grid gap-6 p-6 sm:p-8">
                {invitation.isTestMode ? (
                  <div className="rounded-[22px] border border-amber-300/40 bg-amber-50 px-4 py-4 text-sm leading-7 text-amber-900">
                    Test submission recorded successfully. Admin can now refresh the test monitor page and verify the submitted review.
                  </div>
                ) : null}

                <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
                  <div className="rounded-[28px] border border-[#eddacf] bg-[linear-gradient(180deg,#ffffff_0%,#fffaf5_100%)] p-5">
                    <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Submitted review</div>
                    <div className="mt-3 text-2xl font-black tracking-tight text-[#210505]">
                      {invitation.review?.reviewTitle || "Customer review submitted"}
                    </div>
                    <div className="mt-4 text-sm leading-7 text-slate-600">{invitation.review?.reviewBody}</div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
                    <div className="rounded-[24px] border border-[#ecd7cb] bg-white px-5 py-4 shadow-[0_14px_30px_rgba(15,23,42,0.04)]">
                      <div className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Overall rating</div>
                      <div className="mt-3 text-4xl font-black tracking-tight text-[#7a0000]">
                        {invitation.review?.overallRating || 0}/5
                      </div>
                    </div>
                    <div className="rounded-[24px] border border-[#ecd7cb] bg-white px-5 py-4 shadow-[0_14px_30px_rgba(15,23,42,0.04)]">
                      <div className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Recommend</div>
                      <div className="mt-3 text-xl font-black capitalize tracking-tight text-[#210505]">
                        {invitation.review?.wouldRecommend || "Not specified"}
                      </div>
                    </div>
                    <div className="rounded-[24px] border border-[#ecd7cb] bg-white px-5 py-4 shadow-[0_14px_30px_rgba(15,23,42,0.04)]">
                      <div className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Status</div>
                      <div className="mt-3 text-xl font-black capitalize tracking-tight text-[#210505]">
                        {invitation.review?.moderationStatus || "pending"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[36px] border border-[#ecd7cb] bg-[linear-gradient(180deg,#fffdf9_0%,#fff3dd_100%)] p-6 shadow-[0_20px_60px_rgba(245,158,11,0.12)] sm:p-7">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                <div className="flex h-20 w-20 items-center justify-center rounded-[26px] bg-[radial-gradient(circle_at_top,#fff7d1_0%,#ffd79a_48%,#ffbe6f_100%)] text-[2.7rem] shadow-[0_18px_40px_rgba(245,158,11,0.18)]">
                  🎁
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-black uppercase tracking-[0.22em] text-[#7a0000]">Refer Friends & Family — Earn Rewards</div>
                  <h2 className="mt-2 text-3xl font-black tracking-tight text-[#210505] sm:text-[2.35rem]">
                    Know someone who could benefit from {invitation.product.name}?
                  </h2>
                  <p className="mt-3 text-sm leading-7 text-slate-600">
                    Refer them today and earn a commission when they complete a successful purchase.
                  </p>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setReferralTab("product")}
                  className={`inline-flex min-h-[3rem] items-center justify-center rounded-[18px] px-4 py-2 text-sm font-bold transition ${referralTab === "product" ? "bg-[#7a0000] text-white" : "border border-[#ddc6ba] bg-white text-[#210505]"}`}
                >
                  Refer this product
                </button>
                <button
                  type="button"
                  onClick={() => setReferralTab("program")}
                  className={`inline-flex min-h-[3rem] items-center justify-center rounded-[18px] px-4 py-2 text-sm font-bold transition ${referralTab === "program" ? "bg-[#7a0000] text-white" : "border border-[#ddc6ba] bg-white text-[#210505]"}`}
                >
                  Join referral program
                </button>
              </div>

              {referralTab === "product" ? (
                <>
                  <div className="mt-5 rounded-[32px] border border-amber-300/35 bg-[linear-gradient(180deg,#fff5d3_0%,#ffebb7_100%)] p-6 shadow-[0_18px_40px_rgba(245,158,11,0.14)]">
                    <div className="grid gap-5 md:grid-cols-[1.2fr_0.8fr] md:items-center">
                      <div>
                        <div className="text-xs font-black uppercase tracking-[0.14em] text-[#7a0000]">Earn up to</div>
                        <div className="mt-3 text-5xl font-black tracking-tight text-[#7a0000] sm:text-6xl">
                          {formatMoney(referralDashboard?.totals.potentialCommission ?? projectedCommission)}
                        </div>
                        <div className="mt-4 text-base font-medium leading-7 text-[#6b3d00]">
                          Earn up to {formatMoney(projectedCommission)} when someone you refer completes a purchase for <span className="font-bold text-[#210505]">{invitation.product.name}</span>.
                        </div>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-1">
                        <div className="rounded-[22px] border border-white/50 bg-white/70 px-4 py-4">
                          <div className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Commission Rate</div>
                          <div className="mt-2 text-3xl font-black text-[#7a0000]">{rewardRate}%</div>
                        </div>
                        <div className="rounded-[22px] border border-white/50 bg-white/70 px-4 py-4">
                          <div className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Referral Validity</div>
                          <div className="mt-2 text-lg font-bold text-[#210505]">Up to 3 months</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {!referralSuccess ? (
                    <div className="mt-6 space-y-5 rounded-[30px] border border-[#f0dccf] bg-white/80 p-4 shadow-[0_18px_40px_rgba(15,23,42,0.05)] sm:p-5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="text-xs font-black uppercase tracking-[0.18em] text-[#7a0000]">Refer someone</div>
                          <div className="mt-1 text-lg font-black tracking-tight text-[#210505]">Start earning today</div>
                        </div>
                        <div className="rounded-full border border-amber-300/50 bg-amber-50 px-3 py-1 text-xs font-bold text-[#7a0000]">
                          Valid for 3 Months
                        </div>
                      </div>
                      <div className="rounded-[24px] border border-[#ecd7cb] bg-[#fffaf5] p-4">
                        <div className="text-sm font-bold text-[#210505]">How the Referral Program Works</div>
                        <div className="mt-3 grid gap-2 text-sm leading-7 text-slate-600">
                          <div>Share the phone number of someone interested in {invitation.product.name}.</div>
                          <div>We contact them professionally and provide product information.</div>
                          <div>If they purchase within 3 months, your referral is automatically matched.</div>
                          <div>Your commission is credited to your referral account.</div>
                          <div>You can refer as many people as you like.</div>
                        </div>
                      </div>
                      {renderReferralEntryCard(false)}
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="mt-5 rounded-[30px] border border-[#ecd7cb] bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
                  <div className="text-xs font-black uppercase tracking-[0.14em] text-[#7a0000]">Join our referral program</div>
                  <h3 className="mt-3 text-3xl font-black tracking-tight text-[#210505]">
                    Join our referral program and earn more than Ksh 100,000 per referral.
                  </h3>
                  <p className="mt-4 text-sm leading-7 text-slate-600">
                    Open the full Betech referral program to access your wider referral dashboard, withdrawals, and larger commission opportunities beyond this single product referral.
                  </p>
                  <a
                    href="https://agents.betech.co.ke/"
                    target="_blank"
                    rel="noreferrer"
                    className="mt-5 inline-flex min-h-[3.4rem] w-full items-center justify-center rounded-[20px] bg-[#7a0000] px-6 py-3 text-sm font-bold text-white"
                  >
                    Join referral program
                  </a>
                </div>
              )}

              {referralSuccess ? (
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
                      <MetricCard label="Step 1" value="Refer" />
                      <MetricCard label="Step 2" value="They buy" />
                      <MetricCard label="Step 3" value="We track" />
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
              ) : null}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
