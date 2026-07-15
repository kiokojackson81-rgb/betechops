"use client";

import { useState } from "react";

type TestReviewLinkPayload = {
  reviewUrl: string;
  invitation: {
    invitationId: string;
    expiresAt: string;
    purchaseDate: string;
    customer: {
      firstName: string;
      town: string | null;
      phoneMasked: string;
    };
    product: {
      name: string;
      currentPrice: number;
      warranty: string | null;
      imageUrl: string | null;
    };
    order: {
      orderOrReceiptRef: string | null;
      deliveryMode: string | null;
    };
  };
  product: {
    imageUrl: string | null;
  };
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-KE", { dateStyle: "medium" }).format(new Date(value));
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

export default function TestReviewLinkCard() {
  const [customerName, setCustomerName] = useState("Jackson");
  const [customerPhone, setCustomerPhone] = useState("0705663175");
  const [customerTown, setCustomerTown] = useState("Nairobi");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TestReviewLinkPayload | null>(null);
  const [copied, setCopied] = useState(false);

  async function createLink(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/reviews-referrals/test-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerName, customerPhone, customerTown }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      } & Partial<TestReviewLinkPayload>;

      if (!response.ok || !payload.ok || !payload.reviewUrl || !payload.invitation) {
        throw new Error(payload.error || "Unable to create test review link.");
      }

      setResult(payload as TestReviewLinkPayload);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to create test review link.");
    } finally {
      setLoading(false);
    }
  }

  async function copyLink() {
    if (!result?.reviewUrl) return;
    await navigator.clipboard.writeText(result.reviewUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  const previewImage = result?.invitation.product.imageUrl || result?.product.imageUrl;

  return (
    <section className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,.95),rgba(2,6,23,.98))] p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-3">
          <div className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-300">Test Review Link</div>
          <h2 className="text-3xl font-semibold tracking-tight text-white">Create a safe admin review test</h2>
          <p className="max-w-3xl text-sm text-slate-400">
            This creates a manual invitation in the dev review system without sending SMS or WhatsApp to the customer.
          </p>
        </div>
      </div>

      <form onSubmit={createLink} className="mt-6 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="grid gap-4 md:grid-cols-3">
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Customer name</span>
            <input
              value={customerName}
              onChange={(event) => setCustomerName(event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/50"
            />
          </label>
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Phone</span>
            <input
              value={customerPhone}
              onChange={(event) => setCustomerPhone(event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/50"
            />
          </label>
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Town</span>
            <input
              value={customerTown}
              onChange={(event) => setCustomerTown(event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/50"
            />
          </label>
        </div>

        <div className="flex items-end justify-start xl:justify-end">
          <button
            type="submit"
            disabled={loading}
            className="inline-flex rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 disabled:opacity-60"
          >
            {loading ? "Creating..." : "Create test review link"}
          </button>
        </div>
      </form>

      {error ? (
        <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      {result ? (
        <div className="mt-6 grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-[26px] border border-[#ecd7cb]/20 bg-[#fff8f2] p-5">
            <div className="flex flex-col gap-5 sm:flex-row">
              <div className="h-32 w-full overflow-hidden rounded-[24px] bg-[#fff4e3] sm:h-40 sm:w-40 sm:shrink-0">
                {previewImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={previewImage} alt={result.invitation.product.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center px-4 text-center text-sm font-semibold text-[#7a0000]">
                    Betech Solar
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="inline-flex rounded-full border border-[#0f9d58]/15 bg-[#eefcf4] px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-[#0f9d58]">
                  Review Page Preview
                </div>
                <h3 className="mt-3 text-2xl font-black tracking-tight text-[#210505]">{result.invitation.product.name}</h3>
                <div className="mt-4 grid gap-2 text-sm text-slate-600">
                  <div>Customer: {result.invitation.customer.firstName}</div>
                  <div>Phone: {result.invitation.customer.phoneMasked}</div>
                  <div>Purchase date: {formatDate(result.invitation.purchaseDate)}</div>
                  <div>Reference: {result.invitation.order.orderOrReceiptRef || "Verified order"}</div>
                  <div>Current price: {formatMoney(result.invitation.product.currentPrice)}</div>
                  <div>Warranty: {result.invitation.product.warranty || "Manufacturer warranty available"}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[26px] border border-white/10 bg-slate-950/70 p-5">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">Generated link</div>
            <a
              href={result.reviewUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-3 block break-all text-sm font-medium text-cyan-100 underline decoration-cyan-400/40 underline-offset-4"
            >
              {result.reviewUrl}
            </a>
            <div className="mt-4 grid gap-2 text-sm text-slate-300">
              <div>Expires: {formatDate(result.invitation.expiresAt)}</div>
              <div>Delivery mode: {result.invitation.order.deliveryMode || "pickup"}</div>
              <div>Image source: {previewImage ? "Product image will render on the review page." : "Fallback Betech Solar badge only."}</div>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={copyLink}
                className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm font-semibold text-white transition hover:border-white/20"
              >
                {copied ? "Copied" : "Copy link"}
              </button>
              <a
                href={result.reviewUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm font-semibold text-amber-100 transition hover:border-amber-300/30"
              >
                Open review page
              </a>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
