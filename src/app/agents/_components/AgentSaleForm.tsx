"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { agentPath } from "@/lib/agents/host";

type AgentSaleFormProps = {
  useRootPaths?: boolean;
};

const paymentTypes = [
  { value: "transport_fee", label: "Transport fee" },
  { value: "deposit", label: "Deposit" },
  { value: "full_payment", label: "Full payment" },
];

const deliveryMethods = [
  { value: "courier", label: "Courier" },
  { value: "rider", label: "Rider" },
  { value: "shop_pickup", label: "Shop pickup" },
  { value: "agent_pickup", label: "Agent pickup" },
];

const initialForm = {
  customerName: "",
  customerPhone: "",
  customerLocation: "",
  customerCounty: "",
  productName: "",
  productCategory: "",
  quantity: "1",
  unitPrice: "",
  totalAmount: "",
  paymentType: "deposit",
  amountPaid: "",
  mpesaReference: "",
  deliveryMethod: "",
  deliveryNotes: "",
  customerNotes: "",
  internalAgentNotes: "",
};

export default function AgentSaleForm({ useRootPaths = false }: AgentSaleFormProps) {
  const router = useRouter();
  const [form, setForm] = useState(initialForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const quantity = Number(form.quantity || 0);
    const unitPrice = Number(form.unitPrice || 0);
    if (quantity > 0 && unitPrice >= 0) {
      const nextTotal = String(Math.round(quantity * unitPrice * 100) / 100);
      setForm((current) => (current.totalAmount === nextTotal ? current : { ...current, totalAmount: nextTotal }));
    }
  }, [form.quantity, form.unitPrice]);

  function update(key: keyof typeof initialForm, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setSuccess(null);

    const response = await fetch("/api/agents/sales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        quantity: Number(form.quantity || 0),
        unitPrice: Number(form.unitPrice || 0),
        totalAmount: Number(form.totalAmount || 0),
        amountPaid: Number(form.amountPaid || 0),
      }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(payload.error || "Unable to submit sale.");
      setBusy(false);
      return;
    }

    setSuccess(
      payload.message ||
        "Sale submitted successfully. Potential commission will be unlocked after customer pays fully and order is delivered.",
    );
    const nextId = payload?.sale?.id;
    if (nextId) {
      window.setTimeout(() => {
        router.push(agentPath(`/sales/${nextId}`, useRootPaths));
        router.refresh();
      }, 900);
    } else {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-300">Agent sales desk</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">Submit a new sale lead</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Log the customer and payment details here. The sale stays under admin review until payment and delivery are confirmed.
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href={agentPath("/sales", useRootPaths)}
            className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:border-white/20"
          >
            View my sales
          </Link>
          <Link
            href={agentPath("/dashboard", useRootPaths)}
            className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-sm font-semibold text-cyan-100 transition hover:border-cyan-300/30"
          >
            Dashboard
          </Link>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</div>
      ) : null}
      {success ? (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{success}</div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm text-slate-300">Customer name</span>
          <input
            required
            value={form.customerName}
            onChange={(event) => update("customerName", event.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-slate-100 outline-none focus:border-emerald-400/60"
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm text-slate-300">Customer phone</span>
          <input
            required
            value={form.customerPhone}
            onChange={(event) => update("customerPhone", event.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-slate-100 outline-none focus:border-emerald-400/60"
          />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm text-slate-300">Customer location</span>
          <input
            required
            value={form.customerLocation}
            onChange={(event) => update("customerLocation", event.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-slate-100 outline-none focus:border-emerald-400/60"
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm text-slate-300">Customer county</span>
          <input
            value={form.customerCounty}
            onChange={(event) => update("customerCounty", event.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-slate-100 outline-none focus:border-emerald-400/60"
          />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm text-slate-300">Product name</span>
          <input
            required
            value={form.productName}
            onChange={(event) => update("productName", event.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-slate-100 outline-none focus:border-emerald-400/60"
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm text-slate-300">Product category</span>
          <input
            value={form.productCategory}
            onChange={(event) => update("productCategory", event.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-slate-100 outline-none focus:border-emerald-400/60"
          />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <label className="space-y-2">
          <span className="text-sm text-slate-300">Quantity</span>
          <input
            type="number"
            min="1"
            step="0.01"
            required
            value={form.quantity}
            onChange={(event) => update("quantity", event.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-slate-100 outline-none focus:border-emerald-400/60"
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm text-slate-300">Unit price</span>
          <input
            type="number"
            min="0"
            step="0.01"
            required
            value={form.unitPrice}
            onChange={(event) => update("unitPrice", event.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-slate-100 outline-none focus:border-emerald-400/60"
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm text-slate-300">Total amount</span>
          <input
            type="number"
            min="0"
            step="0.01"
            required
            value={form.totalAmount}
            onChange={(event) => update("totalAmount", event.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-slate-100 outline-none focus:border-emerald-400/60"
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm text-slate-300">Amount paid</span>
          <input
            type="number"
            min="0"
            step="0.01"
            required
            value={form.amountPaid}
            onChange={(event) => update("amountPaid", event.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-slate-100 outline-none focus:border-emerald-400/60"
          />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <label className="space-y-2">
          <span className="text-sm text-slate-300">Payment type</span>
          <select
            required
            value={form.paymentType}
            onChange={(event) => update("paymentType", event.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-slate-100 outline-none focus:border-emerald-400/60"
          >
            {paymentTypes.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-2">
          <span className="text-sm text-slate-300">M-PESA reference</span>
          <input
            value={form.mpesaReference}
            onChange={(event) => update("mpesaReference", event.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-slate-100 outline-none focus:border-emerald-400/60"
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm text-slate-300">Delivery method</span>
          <select
            required
            value={form.deliveryMethod}
            onChange={(event) => update("deliveryMethod", event.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-slate-100 outline-none focus:border-emerald-400/60"
          >
            <option value="">Select method</option>
            {deliveryMethods.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm text-slate-300">Delivery notes</span>
          <textarea
            rows={4}
            value={form.deliveryNotes}
            onChange={(event) => update("deliveryNotes", event.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-slate-100 outline-none focus:border-emerald-400/60"
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm text-slate-300">Customer notes</span>
          <textarea
            rows={4}
            value={form.customerNotes}
            onChange={(event) => update("customerNotes", event.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-slate-100 outline-none focus:border-emerald-400/60"
          />
        </label>
      </div>

      <label className="space-y-2">
        <span className="text-sm text-slate-300">Internal agent notes</span>
        <textarea
          rows={4}
          value={form.internalAgentNotes}
          onChange={(event) => update("internalAgentNotes", event.target.value)}
          className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-slate-100 outline-none focus:border-emerald-400/60"
        />
      </label>

      <div className="rounded-[28px] border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100">
        Potential commission is previewed immediately, but it stays locked until the customer pays in full and the product is delivered or collected.
      </div>

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-2xl bg-emerald-400 px-4 py-3 font-semibold text-slate-950 transition hover:brightness-95 disabled:opacity-60"
      >
        {busy ? "Submitting sale..." : "Submit sale"}
      </button>
    </form>
  );
}
