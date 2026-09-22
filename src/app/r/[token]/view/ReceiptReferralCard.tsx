"use client";

import { useState, type FormEvent } from "react";
import { Gift, Copy } from "lucide-react";
import type { ReceiptReferralOffer } from "@/lib/reviewsReferrals";
import { receiptMoney } from "@/lib/customerReceiptPresentation";

export default function ReceiptReferralCard({ token, offers }: { token: string; offers: ReceiptReferralOffer[] }) {
  const [selected, setSelected] = useState(offers[0]?.productId || "");
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ referralUrl: string; activationUrl: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [verificationUrl, setVerificationUrl] = useState("");
  if (!offers.length) return null;
  async function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true); setError(""); setResult(null); setCopied(false);
    try {
      const response = await fetch(`/api/receipts/public/${encodeURIComponent(token)}/referral`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productId: selected, referredName: data.get("name"), referredPhone: data.get("phone") }) });
      const body = await response.json();
      if (!response.ok) { setVerificationUrl(body.verificationUrl || ""); throw new Error(body.error || "Unable to create referral."); }
      // Only the separate product referral URL is ever offered for sharing.
      const link = new URL(body.referral.referralUrl);
      if (link.protocol !== "https:" || link.hostname !== "www.betech.co.ke" || !link.searchParams.get("ref") || link.pathname.startsWith("/r/")) throw new Error("Unable to create a shareable referral link.");
      setResult(body.referral);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to create referral. Please try again."); }
    finally { setBusy(false); }
  }
  return <section aria-labelledby="receipt-referral-heading" className="mt-6 rounded-2xl border border-amber-200 bg-[#fff7df] p-5 sm:p-6">
    <div className="flex items-start gap-4">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-100 text-[#870000]"><Gift aria-hidden="true" size={26} /></span>
      <div><h2 id="receipt-referral-heading" className="text-xl font-bold">Refer &amp; Earn</h2><p className="mt-1 text-slate-600">Refer a friend to buy this same item.</p></div>
    </div>
    <div className="mt-4 space-y-4">
      {offers.map(offer => <div key={offer.productId} className="border-b border-amber-200 pb-4 last:border-0 last:pb-0">
        <h3 className="font-semibold break-words">{offer.productName}</h3>
        <p className="mt-1 text-3xl font-extrabold tracking-tight text-[#870000]">Earn {receiptMoney(offer.reward)}</p>
        <p className="mt-1 text-sm text-slate-700">{offer.commissionType === "PERCENTAGE" ? `${offer.commissionRate}% of this item’s ${receiptMoney(offer.purchasePrice)} purchase price.` : `Fixed reward for this item’s ${receiptMoney(offer.purchasePrice)} purchase price.`} Per unit.</p>
        <p className="mt-1 text-sm text-slate-700">{offer.requiresFullPayment ? "Reward applies after full payment for a qualifying referred purchase." : "Reward applies to a qualifying referred purchase under this item’s payment rules."}</p>
        <p className="mt-1 text-sm text-slate-600">Tracking period: up to {offer.trackingDays} days. Payout hold: {offer.holdingDays} days.{offer.maximumAmount != null ? ` Reward capped at ${receiptMoney(offer.maximumAmount)}.` : ""}{offer.minimumQualifyingSale != null ? ` Minimum qualifying purchase: ${receiptMoney(offer.minimumQualifyingSale)}.` : ""}</p>
      </div>)}
    </div>
    {!expanded ? <button type="button" onClick={() => setExpanded(true)} className="receipt-primary mt-5 w-full">Get Referral Link</button> : <form onSubmit={generate} className="mt-5 space-y-3">
      {offers.length > 1 ? <label className="block text-sm font-semibold">Item to refer<select value={selected} onChange={event => { setSelected(event.target.value); setResult(null); }} className="mt-1 block min-h-12 w-full rounded-lg border border-amber-300 bg-white p-3">{offers.map(offer => <option key={offer.productId} value={offer.productId}>{offer.productName}</option>)}</select></label> : null}
      <label className="block text-sm font-semibold">Friend’s name (optional)<input name="name" autoComplete="off" className="mt-1 block min-h-12 w-full rounded-lg border border-amber-300 bg-white p-3" /></label>
      <label className="block text-sm font-semibold">Friend’s phone number<input name="phone" type="tel" inputMode="tel" autoComplete="off" required placeholder="07xx xxx xxx" className="mt-1 block min-h-12 w-full rounded-lg border border-amber-300 bg-white p-3" /></label>
      <p className="text-sm text-slate-600">Used to track your qualifying referral. Share only the referral link generated below.</p>
      <button type="submit" disabled={busy} className="receipt-primary w-full disabled:opacity-60">{busy ? "Creating your link…" : "Get Referral Link"}</button>
    </form>}
    {error ? <p role="alert" className="mt-3 text-sm text-red-800">{error} {verificationUrl ? <a className="underline" href={verificationUrl}>Verify access</a> : null}</p> : null}
    {result ? <div className="mt-4 rounded-xl border border-amber-200 bg-white p-4" role="status"><label className="text-sm font-semibold">Your shareable referral link<input aria-label="Your shareable referral link" readOnly value={result.referralUrl} onFocus={event => event.target.select()} className="mt-2 w-full rounded-lg border border-slate-300 p-3 text-sm" /></label><button type="button" className="receipt-secondary mt-3 w-full" onClick={async () => { try { await navigator.clipboard.writeText(result.referralUrl); setCopied(true); } catch { setError("Select and copy the referral link above."); } }}><Copy size={18} aria-hidden="true" />{copied ? "Copied" : "Copy Referral Link"}</button><a href={result.activationUrl} rel="noreferrer" className="mt-3 block text-sm text-[#870000] underline">Activate your referral account for payouts</a></div> : null}
    <details className="mt-3 text-sm text-slate-700"><summary className="mx-auto min-h-11 w-fit cursor-pointer content-center text-[#870000] underline">Referral Terms</summary><p className="mt-2 leading-6">The reward shown is for one unit at your recorded purchase price. Final rewards follow the eligible referred purchase’s actual price and the item’s reward policy. Tracking lasts up to {offers[0].trackingDays} days. Self-referrals and duplicate customer claims are not eligible. Payment requirements, payout holds and any item limits above still apply. Activate and verify your referral account before requesting a payout.</p></details>
  </section>;
}
