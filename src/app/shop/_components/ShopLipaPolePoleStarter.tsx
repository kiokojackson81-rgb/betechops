"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Wallet } from "lucide-react";
import { formatCurrency } from "@/app/shop/_components/shopStyles";
import { LIPA_POLE_POLE_TERMS_PATH } from "@/lib/lipaPolePoleTerms";
import {
  LIPA_POLE_POLE_MIN_DEPOSIT,
  LIPA_POLE_POLE_MPESA_ACCOUNT,
  LIPA_POLE_POLE_MPESA_PAYBILL,
} from "@/lib/lipaPolePoleConfig";

type ShopLipaPolePoleStarterProps = {
  product: {
    id: string;
    name: string;
    price: number;
    lipaPolePoleEnabled?: boolean;
    lipaPolePoleMinDeposit?: number | null;
    lipaPolePoleMaxDays?: number | null;
    lipaPolePoleDefaultDays?: number | null;
    lipaPolePoleTerms?: string | null;
    opsProductId: string | null;
  };
  customer: {
    isAuthenticated: boolean;
    name: string;
    phone: string;
    email: string;
    county: string;
    town: string;
    estateLandmark: string;
    locationNotes: string;
  };
  loginHref: string;
};

const inputClass =
  "min-h-[3rem] rounded-[16px] border border-[#7a0000]/10 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-[#7a0000]/35";

function todayPlus(days: number) {
  const value = new Date();
  value.setDate(value.getDate() + days);
  return value.toISOString().slice(0, 10);
}

export default function ShopLipaPolePoleStarter({
  product,
  customer,
  loginHref,
}: ShopLipaPolePoleStarterProps) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successHref, setSuccessHref] = useState<string | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [form, setForm] = useState({
    customerName: customer.name,
    customerPhone: customer.phone,
    customerEmail: customer.email,
    county: customer.county,
    town: customer.town,
    estateLandmark: customer.estateLandmark,
    locationNotes: customer.locationNotes,
    quantity: "1",
    initialPaymentAmount: String(Math.max(LIPA_POLE_POLE_MIN_DEPOSIT, Math.round(product.lipaPolePoleMinDeposit || 0))),
    initialPaymentMethod: "MPESA",
    initialPaymentReference: "",
    initialPaymentNotes: "",
    expectedCompletionDate: todayPlus(Math.max(1, product.lipaPolePoleDefaultDays || 30)),
    notes: "",
  });

  const quantity = Math.max(1, Number(form.quantity || 1));
  const agreedTotal = useMemo(() => quantity * Number(product.price || 0), [product.price, quantity]);
  const initialPayment = Math.max(0, Number(form.initialPaymentAmount || 0));
  const balance = Math.max(0, agreedTotal - initialPayment);

  if (!product.lipaPolePoleEnabled || !product.opsProductId) {
    return null;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!customer.isAuthenticated) {
      window.location.href = loginHref;
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/shop/lipa-pole-pole", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          opsProductId: product.opsProductId,
          quantity,
          customerName: form.customerName,
          customerPhone: form.customerPhone,
          customerEmail: form.customerEmail,
          county: form.county,
          town: form.town,
          estateLandmark: form.estateLandmark,
          locationNotes: form.locationNotes,
          expectedCompletionDate: form.expectedCompletionDate,
          initialPaymentAmount: initialPayment,
          initialPaymentMethod: form.initialPaymentMethod,
          initialPaymentReference: form.initialPaymentReference,
          initialPaymentNotes: form.initialPaymentNotes,
          notes: form.notes,
          termsAccepted,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        id?: string;
      };
      if (!response.ok) {
        throw new Error(data.error || "Unable to start Lipa Pole Pole.");
      }
      setSuccessHref(data.id ? `/shop/account/lipa-pole-pole/${encodeURIComponent(data.id)}` : "/shop/account");
      setOpen(false);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to start Lipa Pole Pole.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (!customer.isAuthenticated) {
            window.location.href = loginHref;
            return;
          }
          setOpen(true);
          setError(null);
        }}
        className="inline-flex min-h-[3.35rem] items-center justify-center gap-2 rounded-[20px] border border-[#7a0000]/16 bg-[linear-gradient(135deg,#fff6e7_0%,#ffe5b4_100%)] px-4 py-3 text-sm font-bold text-[#7a0000] shadow-[0_14px_28px_rgba(122,0,0,0.08)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_36px_rgba(122,0,0,0.14)]"
      >
        <Wallet className="h-4 w-4" />
        Lipa Pole Pole
      </button>
      {successHref ? (
        <div className="rounded-[18px] border border-[#0f9d58]/15 bg-[#f4fff7] px-4 py-3 text-sm text-slate-700">
          Lipa Pole Pole booking created. Your payment is pending verification.{" "}
          <Link href={successHref} className="font-bold text-[#0f9d58]">
            Open account
          </Link>
        </div>
      ) : null}
      {open ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/70 px-4 py-8">
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-[28px] bg-white p-5 shadow-[0_30px_80px_rgba(15,23,42,0.35)] sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.18em] text-[#7a0000]">Lipa Pole Pole</div>
                <h3 className="mt-2 text-2xl font-black text-slate-950">{product.name}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Pay your deposit now, reserve the agreed price, and continue paying from your Betech account.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full border border-slate-200 px-3 py-1 text-sm font-semibold text-slate-600"
              >
                Close
              </button>
            </div>

            <div className="mt-5 grid gap-3 rounded-[22px] border border-[#7a0000]/10 bg-[#fffaf4] p-4 sm:grid-cols-3">
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.12em] text-[#7a0000]">Product price</div>
                <div className="mt-1 text-lg font-black text-slate-950">{formatCurrency(agreedTotal)}</div>
              </div>
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.12em] text-[#7a0000]">Deposit now</div>
                <div className="mt-1 text-lg font-black text-slate-950">{formatCurrency(initialPayment)}</div>
              </div>
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.12em] text-[#7a0000]">Remaining balance</div>
                <div className="mt-1 text-lg font-black text-slate-950">{formatCurrency(balance)}</div>
              </div>
            </div>

            <div className="mt-4 rounded-[20px] border border-[#0f9d58]/20 bg-[#f4fff7] p-4 text-sm leading-6 text-slate-700">
              <div className="font-black uppercase tracking-[0.12em] text-[#0f9d58]">Pay with M-Pesa</div>
              <div className="mt-2">Paybill: <strong>{LIPA_POLE_POLE_MPESA_PAYBILL}</strong></div>
              <div>Account number: <strong>{LIPA_POLE_POLE_MPESA_ACCOUNT}</strong></div>
              <div className="mt-2">Send the initial payment shown above, then enter the M-Pesa confirmation code below. Your balance updates only after Betech verifies the payment.</div>
            </div>

            {product.lipaPolePoleTerms ? (
              <div className="mt-4 rounded-[18px] border border-[#7a0000]/10 bg-[#fcfaf7] px-4 py-3 text-sm leading-6 text-slate-600">
                {product.lipaPolePoleTerms}
              </div>
            ) : null}

            {error ? (
              <div className="mt-4 rounded-[18px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            <form className="mt-5 grid gap-3 sm:grid-cols-2" onSubmit={handleSubmit}>
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Full name
                <input
                  value={form.customerName}
                  onChange={(event) => setForm((current) => ({ ...current, customerName: event.target.value }))}
                  className={inputClass}
                  required
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Phone number
                <input
                  value={form.customerPhone}
                  onChange={(event) => setForm((current) => ({ ...current, customerPhone: event.target.value }))}
                  className={inputClass}
                  required
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Email
                <input
                  value={form.customerEmail}
                  onChange={(event) => setForm((current) => ({ ...current, customerEmail: event.target.value }))}
                  className={inputClass}
                  type="email"
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Quantity
                <input
                  value={form.quantity}
                  onChange={(event) => setForm((current) => ({ ...current, quantity: event.target.value }))}
                  className={inputClass}
                  type="number"
                  min={1}
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                County
                <input
                  value={form.county}
                  onChange={(event) => setForm((current) => ({ ...current, county: event.target.value }))}
                  className={inputClass}
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Town / area
                <input
                  value={form.town}
                  onChange={(event) => setForm((current) => ({ ...current, town: event.target.value }))}
                  className={inputClass}
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-slate-700 sm:col-span-2">
                Estate / landmark
                <input
                  value={form.estateLandmark}
                  onChange={(event) => setForm((current) => ({ ...current, estateLandmark: event.target.value }))}
                  className={inputClass}
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-slate-700 sm:col-span-2">
                Location notes
                <textarea
                  value={form.locationNotes}
                  onChange={(event) => setForm((current) => ({ ...current, locationNotes: event.target.value }))}
                  className={`${inputClass} min-h-[92px] py-3`}
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Deposit amount
                <input
                  value={form.initialPaymentAmount}
                  onChange={(event) => setForm((current) => ({ ...current, initialPaymentAmount: event.target.value }))}
                  className={inputClass}
                  type="number"
                  min={Math.max(LIPA_POLE_POLE_MIN_DEPOSIT, Math.round(product.lipaPolePoleMinDeposit || 0))}
                  required
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                M-Pesa transaction code
                <input
                  value={form.initialPaymentReference}
                  onChange={(event) => setForm((current) => ({ ...current, initialPaymentReference: event.target.value }))}
                  className={inputClass}
                  placeholder="e.g. TGQ7ABC123"
                  required={form.initialPaymentMethod !== "CASH"}
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Target completion date
                <input
                  value={form.expectedCompletionDate}
                  onChange={(event) => setForm((current) => ({ ...current, expectedCompletionDate: event.target.value }))}
                  className={inputClass}
                  type="date"
                  required
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-slate-700 sm:col-span-2">
                Internal notes for support team
                <textarea
                  value={form.notes}
                  onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                  className={`${inputClass} min-h-[92px] py-3`}
                  placeholder="Any product preferences, delivery planning details, or follow-up notes."
                />
              </label>
              <label className="sm:col-span-2 flex cursor-pointer items-start gap-3 rounded-[18px] border border-[#7a0000]/10 bg-[#fffaf4] px-4 py-4 text-sm leading-6 text-slate-700">
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(event) => setTermsAccepted(event.target.checked)}
                  className="mt-1 h-4 w-4 shrink-0 accent-[#7a0000]"
                  required
                />
                <span>
                  I have read and agree to the Betech Solar Solutions{" "}
                  <Link
                    href={LIPA_POLE_POLE_TERMS_PATH}
                    target="_blank"
                    className="font-black text-[#7a0000] underline decoration-[#7a0000]/30 underline-offset-4"
                  >
                    Lipa Pole Pole Terms &amp; Conditions
                  </Link>
                  . I understand that the product is released only after full payment is confirmed.
                </span>
              </label>
              <div className="sm:col-span-2 flex flex-wrap gap-3 pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-[18px] bg-[#7a0000] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#660000] disabled:opacity-50"
                >
                  {submitting ? "Starting..." : "Start Lipa Pole Pole"}
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-[18px] border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
