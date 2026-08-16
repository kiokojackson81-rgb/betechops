"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, WalletCards, X } from "lucide-react";
import { formatCurrency } from "@/app/shop/_components/shopStyles";
import {
  LIPA_POLE_POLE_MIN_DEPOSIT,
  LIPA_POLE_POLE_MPESA_ACCOUNT,
  LIPA_POLE_POLE_MPESA_PAYBILL,
} from "@/lib/lipaPolePoleConfig";
import { LIPA_POLE_POLE_TERMS_PATH } from "@/lib/lipaPolePoleTerms";

type ShopLipaPolePoleStarterProps = {
  product: {
    id: string;
    name: string;
    image?: string | null;
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
  autoOpen?: boolean;
};

type BookingStep = "setup" | "payment" | "success";
type PaymentFrequency = "WEEKLY" | "MONTHLY";

type BookingForm = {
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  county: string;
  town: string;
  estateLandmark: string;
  locationNotes: string;
  quantity: string;
  initialPaymentAmount: string;
  paymentFrequency: PaymentFrequency;
  installmentCount: string;
};

const inputClass =
  "min-h-12 w-full rounded-[16px] border border-[#7a0000]/12 bg-white px-4 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#7a0000]/40 focus:ring-4 focus:ring-[#7a0000]/5 sm:text-sm";

function addPaymentPeriod(base: Date, frequency: PaymentFrequency, count: number) {
  const value = new Date(base);
  if (frequency === "WEEKLY") value.setDate(value.getDate() + count * 7);
  else value.setMonth(value.getMonth() + count);
  return value;
}

function formatPlanDate(value: Date) {
  return new Intl.DateTimeFormat("en-KE", { day: "numeric", month: "short", year: "numeric" }).format(value);
}

function draftKey(productId: string) {
  return `betech:lpp-draft:${productId}`;
}

export default function ShopLipaPolePoleStarter({
  product,
  customer,
  loginHref,
  autoOpen = false,
}: ShopLipaPolePoleStarterProps) {
  const minimumDeposit = Math.max(
    LIPA_POLE_POLE_MIN_DEPOSIT,
    Math.round(product.lipaPolePoleMinDeposit || 0),
  );
  const initialForm = useMemo<BookingForm>(() => ({
    customerName: customer.name,
    customerPhone: customer.phone,
    customerEmail: customer.email,
    county: customer.county,
    town: customer.town,
    estateLandmark: customer.estateLandmark,
    locationNotes: customer.locationNotes,
    quantity: "1",
    initialPaymentAmount: String(minimumDeposit),
    paymentFrequency: "MONTHLY",
    installmentCount: String(Math.max(1, Math.round((product.lipaPolePoleDefaultDays || 30) / 30))),
  }), [customer, minimumDeposit, product.lipaPolePoleDefaultDays]);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<BookingStep>("setup");
  const [form, setForm] = useState<BookingForm>(initialForm);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [transactionCode, setTransactionCode] = useState("");
  const [plan, setPlan] = useState<{ id: string; reference: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const quantity = Math.max(1, Number(form.quantity || 1));
  const agreedTotal = quantity * Number(product.price || 0);
  const initialPayment = Math.max(0, Number(form.initialPaymentAmount || 0));
  const balance = Math.max(0, agreedTotal - initialPayment);
  const progress = agreedTotal > 0 ? Math.min(100, (initialPayment / agreedTotal) * 100) : 0;
  const configuredMaxDays = Math.max(0, Number(product.lipaPolePoleMaxDays || 0));
  const maxInstallments = form.paymentFrequency === "WEEKLY"
    ? Math.max(1, Math.min(52, configuredMaxDays ? Math.floor(configuredMaxDays / 7) : 52))
    : Math.max(1, Math.min(24, configuredMaxDays ? Math.floor(configuredMaxDays / 30) : 24));
  const installmentCount = Math.max(1, Math.min(maxInstallments, Number.parseInt(form.installmentCount, 10) || 1));
  const installmentAmount = balance / installmentCount;
  const planStart = new Date();
  const paymentSchedule = Array.from({ length: installmentCount }, (_, index) => ({
    date: addPaymentPeriod(planStart, form.paymentFrequency, index + 1),
    amount: index === installmentCount - 1
      ? Math.max(0, balance - Math.round(installmentAmount) * (installmentCount - 1))
      : Math.round(installmentAmount),
  }));
  const completionDate = paymentSchedule.at(-1)?.date || planStart;

  useEffect(() => {
    if (!product.opsProductId || !autoOpen) return;
    let restored = false;
    try {
      const saved = window.sessionStorage.getItem(draftKey(product.opsProductId));
      if (saved) {
        const parsed = JSON.parse(saved) as { form?: Partial<BookingForm>; termsAccepted?: boolean };
        setForm((current) => ({ ...current, ...parsed.form }));
        setTermsAccepted(Boolean(parsed.termsAccepted));
        restored = true;
      }
    } catch {
      // A stale browser draft should never block the booking flow.
    }
    if (!restored && customer.isAuthenticated) setForm(initialForm);
    setOpen(true);
  }, [autoOpen, customer.isAuthenticated, initialForm, product.opsProductId]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  if (!product.lipaPolePoleEnabled || !product.opsProductId) return null;

  function openFlow() {
    setStep("setup");
    setError(null);
    setOpen(true);
  }

  function saveDraftAndAuthenticate() {
    window.sessionStorage.setItem(
      draftKey(product.opsProductId as string),
      JSON.stringify({ form, termsAccepted }),
    );
    window.location.href = loginHref;
  }

  async function startBooking(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!customer.isAuthenticated) {
      saveDraftAndAuthenticate();
      return;
    }

    setSubmitting(true);
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
          paymentFrequency: form.paymentFrequency,
          installmentCount,
          initialPaymentAmount: initialPayment,
          initialPaymentMethod: "MPESA",
          initialPaymentReference: "",
          termsAccepted,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string; id?: string; reference?: string };
      if (!response.ok || !data.id) throw new Error(data.error || "Unable to start Lipa Pole Pole.");
      setPlan({ id: data.id, reference: data.reference || "Lipa Pole Pole" });
      window.sessionStorage.removeItem(draftKey(product.opsProductId!));
      setStep("payment");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to start Lipa Pole Pole.");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitPayment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!plan) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/shop/lipa-pole-pole/${encodeURIComponent(plan.id)}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: initialPayment,
          method: "MPESA",
          reference: transactionCode,
          notes: "Customer portal initial payment.",
        }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Unable to submit payment.");
      setStep("success");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to submit payment.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openFlow}
        className="inline-flex min-h-[3.55rem] w-full items-center justify-center gap-2 rounded-[20px] border border-[#7a0000]/18 bg-[linear-gradient(135deg,#fff3d8_0%,#ffe2a1_100%)] px-5 py-3 text-sm font-black uppercase tracking-[0.06em] text-[#7a0000] shadow-[0_16px_30px_rgba(122,0,0,0.10)] transition hover:-translate-y-0.5 hover:border-[#7a0000]/30 hover:shadow-[0_20px_38px_rgba(122,0,0,0.16)]"
      >
        <WalletCards className="h-5 w-5" />
        Lipa Pole Pole
      </button>

      {open ? (
        <div className="fixed inset-0 z-[80] bg-slate-950/75 sm:flex sm:items-center sm:justify-center sm:p-4 xl:p-6" role="dialog" aria-modal="true" aria-labelledby="lpp-dialog-title">
          <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-[#fcfaf7] sm:h-[calc(100dvh-2rem)] sm:max-h-[900px] sm:max-w-[1320px] sm:rounded-[30px] sm:border sm:border-white/20 sm:shadow-[0_35px_100px_rgba(15,23,42,0.45)] xl:h-[calc(100dvh-3rem)]">
            <div className="flex shrink-0 items-center justify-between border-b border-[#7a0000]/10 bg-white px-4 py-3 sm:px-6">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#7a0000]">Betech Solar Solutions</div>
                <div className="mt-1 text-sm font-black text-slate-950">Lipa Pole Pole</div>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close Lipa Pole Pole" className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[#7a0000]/10 bg-[#fcfaf7] text-slate-700">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain lg:overflow-hidden">
              <div className="grid min-h-full lg:h-full lg:grid-cols-[minmax(320px,0.76fr)_minmax(0,1.24fr)]">
                <aside className="border-b border-[#7a0000]/10 bg-[radial-gradient(circle_at_top,rgba(242,178,15,0.20),transparent_42%),linear-gradient(160deg,#fffaf0_0%,#f7ede2_100%)] p-4 sm:p-6 lg:overflow-y-auto lg:border-b-0 lg:border-r lg:p-7">
                  <div className="mx-auto max-w-sm">
                    <div className="relative aspect-[4/3] overflow-hidden rounded-[22px] border border-[#7a0000]/10 bg-white shadow-[0_20px_45px_rgba(15,23,42,0.08)] sm:rounded-[28px]">
                      {product.image ? <Image src={product.image} alt={product.name} fill sizes="(max-width: 1024px) 100vw, 420px" className="object-contain p-4" /> : <div className="flex h-full items-center justify-center px-6 text-center text-sm font-bold text-slate-500">Betech Solar product</div>}
                    </div>
                    <h2 className="mt-4 text-xl font-black leading-tight text-slate-950 lg:text-2xl">{product.name}</h2>
                    <div className="mt-2 text-2xl font-black text-[#7a0000]">{formatCurrency(agreedTotal)}</div>
                    {plan ? <div className="mt-3 inline-flex rounded-full bg-white px-3 py-2 text-xs font-black text-[#7a0000] shadow-sm">{plan.reference}</div> : null}
                  </div>
                </aside>

                <section className="p-4 pb-[max(2rem,env(safe-area-inset-bottom))] sm:p-6 lg:overflow-y-auto lg:p-7 xl:p-8">
                  {step === "setup" ? (
                    <form onSubmit={startBooking} className="mx-auto max-w-2xl">
                      <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#7a0000]">Get it with Lipa Pole Pole</div>
                      <h3 id="lpp-dialog-title" className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Pay gradually and collect after completing payment.</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-600">Your product and agreed price come directly from the Betech catalogue.</p>

                      <div className="mt-6 grid gap-4 sm:grid-cols-2">
                        <label className="grid gap-2 text-sm font-bold text-slate-700">Full name<input value={form.customerName} onChange={(event) => setForm((current) => ({ ...current, customerName: event.target.value }))} className={inputClass} autoComplete="name" required /></label>
                        <label className="grid gap-2 text-sm font-bold text-slate-700">Phone number<input value={form.customerPhone} onChange={(event) => setForm((current) => ({ ...current, customerPhone: event.target.value }))} className={inputClass} inputMode="tel" autoComplete="tel" required /></label>
                        <label className="grid gap-2 text-sm font-bold text-slate-700 sm:col-span-2">Email<input value={form.customerEmail} onChange={(event) => setForm((current) => ({ ...current, customerEmail: event.target.value }))} className={inputClass} type="email" autoComplete="email" /></label>
                        <label className="grid gap-2 text-sm font-bold text-slate-700">Quantity<input value={form.quantity} onChange={(event) => setForm((current) => ({ ...current, quantity: event.target.value }))} className={inputClass} type="number" min={1} max={50} required /></label>
                        <label className="grid gap-2 text-sm font-bold text-slate-700">Initial payment<input value={form.initialPaymentAmount} onChange={(event) => setForm((current) => ({ ...current, initialPaymentAmount: event.target.value }))} className={inputClass} type="number" min={minimumDeposit} max={agreedTotal} inputMode="numeric" required /></label>
                        <fieldset className="grid gap-2 sm:col-span-2">
                          <legend className="text-sm font-bold text-slate-700">Payment frequency</legend>
                          <div className="grid grid-cols-2 gap-3">
                            {(["WEEKLY", "MONTHLY"] as const).map((frequency) => (
                              <button key={frequency} type="button" onClick={() => setForm((current) => ({ ...current, paymentFrequency: frequency, installmentCount: "1" }))} className={`min-h-12 rounded-[16px] border px-4 text-sm font-black transition ${form.paymentFrequency === frequency ? "border-[#7a0000] bg-[#7a0000] text-white shadow-md" : "border-[#7a0000]/12 bg-white text-slate-700 hover:border-[#7a0000]/35"}`}>
                                {frequency === "WEEKLY" ? "Weekly" : "Monthly"}
                              </button>
                            ))}
                          </div>
                        </fieldset>
                        <label className="grid gap-2 text-sm font-bold text-slate-700 sm:col-span-2">Number of {form.paymentFrequency === "WEEKLY" ? "weeks" : "months"}<input value={form.installmentCount} onChange={(event) => setForm((current) => ({ ...current, installmentCount: event.target.value }))} className={inputClass} type="number" min={1} max={maxInstallments} inputMode="numeric" required /><span className="text-xs font-medium text-slate-500">Up to {maxInstallments} {form.paymentFrequency === "WEEKLY" ? "weeks" : "months"} for this product.</span></label>
                      </div>

                      <details className="mt-4 rounded-[18px] border border-[#7a0000]/10 bg-white p-4">
                        <summary className="cursor-pointer text-sm font-black text-[#7a0000]">Optional delivery details</summary>
                        <div className="mt-4 grid gap-4 sm:grid-cols-2">
                          <label className="grid gap-2 text-sm font-bold text-slate-700">County<input value={form.county} onChange={(event) => setForm((current) => ({ ...current, county: event.target.value }))} className={inputClass} /></label>
                          <label className="grid gap-2 text-sm font-bold text-slate-700">Town / area<input value={form.town} onChange={(event) => setForm((current) => ({ ...current, town: event.target.value }))} className={inputClass} /></label>
                          <label className="grid gap-2 text-sm font-bold text-slate-700 sm:col-span-2">Estate / landmark<input value={form.estateLandmark} onChange={(event) => setForm((current) => ({ ...current, estateLandmark: event.target.value }))} className={inputClass} /></label>
                          <label className="grid gap-2 text-sm font-bold text-slate-700 sm:col-span-2">Location notes<textarea value={form.locationNotes} onChange={(event) => setForm((current) => ({ ...current, locationNotes: event.target.value }))} className={`${inputClass} min-h-24 py-3`} /></label>
                        </div>
                      </details>

                      <div className="mt-5 rounded-[22px] border border-[#7a0000]/10 bg-[#fff7e8] p-4">
                        <div className="grid gap-3 sm:grid-cols-3">
                          <div><div className="text-[10px] font-black uppercase tracking-[0.12em] text-[#7a0000]">Product price</div><div className="mt-1 font-black text-slate-950">{formatCurrency(agreedTotal)}</div></div>
                          <div><div className="text-[10px] font-black uppercase tracking-[0.12em] text-[#7a0000]">Initial payment</div><div className="mt-1 font-black text-slate-950">{formatCurrency(initialPayment)}</div></div>
                          <div><div className="text-[10px] font-black uppercase tracking-[0.12em] text-[#7a0000]">Balance after payment</div><div className="mt-1 font-black text-slate-950">{formatCurrency(balance)}</div></div>
                        </div>
                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white"><div className="h-full rounded-full bg-[linear-gradient(90deg,#7a0000,#f2b20f)]" style={{ width: `${progress}%` }} /></div>
                        <div className="mt-2 text-xs font-semibold text-slate-600">{progress.toFixed(1)}% progress after Betech verifies this payment</div>
                      </div>

                      <div className="mt-4 rounded-[22px] border border-[#7a0000]/10 bg-white p-4">
                        <div className="text-[10px] font-black uppercase tracking-[0.14em] text-[#7a0000]">Your payment plan</div>
                        <div className="mt-3 grid gap-3 sm:grid-cols-3">
                          <div className="rounded-2xl bg-slate-50 p-3"><div className="text-xs font-bold text-slate-500">Frequency</div><div className="mt-1 font-black text-slate-950">{form.paymentFrequency === "WEEKLY" ? "Weekly" : "Monthly"}</div></div>
                          <div className="rounded-2xl bg-slate-50 p-3"><div className="text-xs font-bold text-slate-500">Each payment</div><div className="mt-1 font-black text-slate-950">{formatCurrency(Math.round(installmentAmount))}</div></div>
                          <div className="rounded-2xl bg-slate-50 p-3"><div className="text-xs font-bold text-slate-500">Completion date</div><div className="mt-1 font-black text-slate-950">{formatPlanDate(completionDate)}</div></div>
                        </div>
                        <div className="mt-4 max-h-48 space-y-2 overflow-y-auto pr-1">
                          {paymentSchedule.map((installment, index) => <div key={`${installment.date.toISOString()}-${index}`} className="flex items-center justify-between gap-4 rounded-xl border border-slate-100 px-3 py-2 text-sm"><span className="font-semibold text-slate-600">{index + 1}. {formatPlanDate(installment.date)}</span><span className="font-black text-slate-950">{formatCurrency(installment.amount)}</span></div>)}
                        </div>
                      </div>

                      {product.lipaPolePoleTerms ? <div className="mt-4 rounded-[18px] border border-[#7a0000]/10 bg-white px-4 py-3 text-sm leading-6 text-slate-600">{product.lipaPolePoleTerms}</div> : null}
                      <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-[18px] border border-[#7a0000]/10 bg-white p-4 text-sm leading-6 text-slate-700">
                        <input type="checkbox" checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-[#7a0000]" required />
                        <span>I understand that the product will only be released after full payment and I agree to the Betech Solar Solutions <Link href={LIPA_POLE_POLE_TERMS_PATH} target="_blank" className="font-black text-[#7a0000] underline underline-offset-4">Lipa Pole Pole Terms &amp; Conditions</Link>.</span>
                      </label>
                      {error ? <div className="mt-4 rounded-[16px] border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</div> : null}
                      <button type="submit" disabled={submitting} className="mt-5 inline-flex min-h-14 w-full items-center justify-center rounded-[18px] bg-[#7a0000] px-5 py-3 text-sm font-black uppercase tracking-[0.06em] text-white shadow-[0_18px_34px_rgba(122,0,0,0.22)] disabled:opacity-50">{submitting ? "Starting..." : customer.isAuthenticated ? "Start Lipa Pole Pole" : "Continue with OTP"}</button>
                    </form>
                  ) : null}

                  {step === "payment" ? (
                    <form onSubmit={submitPayment} className="mx-auto max-w-2xl">
                      <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#0f9d58]">Booking created</div>
                      <h3 id="lpp-dialog-title" className="mt-2 text-3xl font-black tracking-tight text-slate-950">Pay with M-Pesa</h3>
                      <div className="mt-5 rounded-[22px] border border-[#0f9d58]/20 bg-[#f3fff7] p-5">
                        <div className="text-xs font-black uppercase tracking-[0.14em] text-[#0f9d58]">Amount to pay</div>
                        <div className="mt-1 text-3xl font-black text-slate-950">{formatCurrency(initialPayment)}</div>
                        <div className="mt-5 grid gap-3 sm:grid-cols-2"><div className="rounded-2xl bg-white p-4"><div className="text-xs font-bold text-slate-500">Paybill</div><div className="mt-1 text-xl font-black text-slate-950">{LIPA_POLE_POLE_MPESA_PAYBILL}</div></div><div className="rounded-2xl bg-white p-4"><div className="text-xs font-bold text-slate-500">Account Number</div><div className="mt-1 text-xl font-black text-slate-950">{LIPA_POLE_POLE_MPESA_ACCOUNT}</div></div></div>
                      </div>
                      <ol className="mt-5 grid gap-2 rounded-[22px] border border-[#7a0000]/10 bg-white p-5 text-sm leading-6 text-slate-700">
                        {["Open M-Pesa.", "Select Lipa na M-Pesa.", "Select Pay Bill.", `Enter Business Number ${LIPA_POLE_POLE_MPESA_PAYBILL}.`, `Enter Account Number ${LIPA_POLE_POLE_MPESA_ACCOUNT}.`, `Enter ${formatCurrency(initialPayment)}.`, "Complete payment.", "Enter the M-Pesa confirmation code below."].map((instruction, index) => <li key={instruction} className="flex gap-3"><span className="font-black text-[#7a0000]">{index + 1}.</span><span>{instruction}</span></li>)}
                      </ol>
                      <label className="mt-5 grid gap-2 text-sm font-bold text-slate-700">M-Pesa Transaction Code<input value={transactionCode} onChange={(event) => setTransactionCode(event.target.value.toUpperCase())} className={inputClass} placeholder="e.g. TGQ7ABC123" autoCapitalize="characters" required /></label>
                      <p className="mt-3 text-xs leading-5 text-slate-500">Submitting a code does not credit your balance. Betech staff must verify the payment first.</p>
                      {error ? <div className="mt-4 rounded-[16px] border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</div> : null}
                      <button type="submit" disabled={submitting} className="mt-5 inline-flex min-h-14 w-full items-center justify-center rounded-[18px] bg-[#0f9d58] px-5 py-3 text-sm font-black uppercase tracking-[0.06em] text-white shadow-[0_18px_34px_rgba(15,157,88,0.22)] disabled:opacity-50">{submitting ? "Submitting..." : "Submit Payment"}</button>
                    </form>
                  ) : null}

                  {step === "success" && plan ? (
                    <div className="mx-auto flex max-w-2xl flex-col items-center py-8 text-center sm:py-14">
                      <span className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-[#e9fff1] text-[#0f9d58]"><CheckCircle2 className="h-10 w-10" /></span>
                      <div className="mt-5 text-[11px] font-black uppercase tracking-[0.18em] text-[#0f9d58]">Payment submitted for verification</div>
                      <h3 id="lpp-dialog-title" className="mt-2 text-3xl font-black tracking-tight text-slate-950">Your booking is in your Betech account.</h3>
                      <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600">We have received your payment details. Your Lipa Pole Pole balance will update after Betech verifies the payment.</p>
                      <div className="mt-7 grid w-full gap-3 sm:grid-cols-2">
                        <Link href={`/shop/account/lipa-pole-pole/${encodeURIComponent(plan.id)}`} className="inline-flex min-h-14 items-center justify-center rounded-[18px] bg-[#7a0000] px-5 py-3 text-sm font-black text-white">View My Lipa Pole Pole</Link>
                        <Link href="/" className="inline-flex min-h-14 items-center justify-center rounded-[18px] border border-[#7a0000]/16 bg-white px-5 py-3 text-sm font-black text-[#7a0000]">Continue Shopping</Link>
                      </div>
                    </div>
                  ) : null}
                </section>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
