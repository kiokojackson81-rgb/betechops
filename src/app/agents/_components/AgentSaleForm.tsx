"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CreditCard,
  Search,
  Store,
  Truck,
  Wallet,
  X,
} from "lucide-react";
import { agentPath } from "@/lib/agents/host";
import { getTownsForCounty, kenyaCountyOptions } from "@/lib/agents/kenyaMarkets";

type AgentSaleFormProps = {
  useRootPaths?: boolean;
  stats?: {
    earnedCommission: number;
    unpaidCommission: number;
  };
};

const paymentOptions = [
  {
    value: "pay_on_delivery",
    title: "Pay On Delivery",
    note: "For Nairobi and nearby areas.",
    detail: "Customer pays after delivery.",
    icon: Truck,
    accent: "emerald",
  },
  {
    value: "full_payment",
    title: "Prepay Full Amount",
    note: "Recommended for outside Nairobi deliveries.",
    detail: "Customer pays before dispatch.",
    icon: Wallet,
    accent: "gold",
  },
  {
    value: "transport_fee",
    title: "Pay Transport Fee First",
    note: "For customers outside Nairobi.",
    detail: "Customer pays transport first and clears balance on delivery.",
    icon: CreditCard,
    accent: "sky",
  },
  {
    value: "shop_pickup",
    title: "Collect From Shop",
    note: "Pickup from Nairobi shop.",
    detail: "Customer collects order and pays at collection.",
    icon: Store,
    accent: "slate",
  },
] as const;

type PaymentOptionValue = (typeof paymentOptions)[number]["value"];

const paymentTypeToApiValue: Record<PaymentOptionValue, "transport_fee" | "full_payment" | "deposit"> = {
  pay_on_delivery: "deposit",
  full_payment: "full_payment",
  transport_fee: "transport_fee",
  shop_pickup: "deposit",
};

const initialForm = {
  customerName: "",
  customerPhone: "",
  customerCounty: "",
  customerLocation: "",
  productName: "",
  quantity: "1",
  unitPrice: "",
  totalAmount: "",
  paymentOption: "pay_on_delivery" as PaymentOptionValue,
  amountPaid: "",
  mpesaReference: "",
};

type ProductSuggestion = {
  id: string;
  name: string;
  sku: string | null;
  category: string | null;
  sellingPrice: number | null;
  defaultWarranty: string | null;
  commissionEnabled: boolean | null;
  commissionAmount: number | null;
};

function currency(value: string | number) {
  const amount = Number(value || 0);
  return `Ksh ${amount.toLocaleString("en-KE", { maximumFractionDigits: 2 })}`;
}

function commissionForProduct(product: ProductSuggestion | null, totalAmount: number) {
  if (!product) return Math.round(totalAmount * 0.06 * 100) / 100;
  if (product.commissionEnabled && Number(product.commissionAmount ?? 0) > 0) {
    return Number(product.commissionAmount ?? 0);
  }
  return Math.round(totalAmount * 0.06 * 100) / 100;
}

function inputClassName() {
  return "w-full rounded-2xl border border-[#e6d7ce] bg-[#fffdfb] px-4 py-3.5 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#7a0000]/35 focus:bg-white focus:ring-4 focus:ring-[#f2b20f]/10";
}

function sectionCardClassName() {
  return "rounded-[28px] bg-white p-5 shadow-[0_10px_30px_rgba(72,36,19,0.06)] ring-1 ring-[#ead9ce] md:p-6";
}

function paymentCardClasses(active: boolean, accent: string) {
  if (!active) {
    return "border-[#ead9ce] bg-white hover:border-[#7a0000]/25 hover:shadow-[0_14px_34px_rgba(72,36,19,0.08)]";
  }
  if (accent === "emerald") return "border-emerald-300 bg-emerald-50 shadow-[0_16px_36px_rgba(16,185,129,0.14)]";
  if (accent === "gold") return "border-[#f2b20f]/50 bg-[#fff7e3] shadow-[0_16px_36px_rgba(242,178,15,0.16)]";
  if (accent === "sky") return "border-sky-300 bg-sky-50 shadow-[0_16px_36px_rgba(14,165,233,0.14)]";
  return "border-slate-300 bg-slate-50 shadow-[0_16px_36px_rgba(15,23,42,0.10)]";
}

export default function AgentSaleForm({ useRootPaths = false, stats }: AgentSaleFormProps) {
  const router = useRouter();
  const [form, setForm] = useState(initialForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<ProductSuggestion[]>([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [suggestionsBusy, setSuggestionsBusy] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductSuggestion | null>(null);
  const deferredProductQuery = useDeferredValue(form.productName.trim());

  const availableTowns = useMemo(() => getTownsForCounty(form.customerCounty), [form.customerCounty]);
  const numericTotal = Number(form.totalAmount || 0);
  const potentialCommission = commissionForProduct(selectedProduct, numericTotal);
  const earnedCommission = Number(stats?.earnedCommission ?? 0);
  const unpaidCommission = Number(stats?.unpaidCommission ?? 0);
  const selectedPayment = paymentOptions.find((option) => option.value === form.paymentOption) ?? paymentOptions[0];
  const shouldShowPaymentFields = form.paymentOption === "full_payment" || form.paymentOption === "transport_fee";

  useEffect(() => {
    const quantity = Number(form.quantity || 0);
    const unitPrice = Number(form.unitPrice || 0);
    if (quantity > 0 && unitPrice >= 0) {
      const nextTotal = String(Math.round(quantity * unitPrice * 100) / 100);
      setForm((current) => (current.totalAmount === nextTotal ? current : { ...current, totalAmount: nextTotal }));
    }
  }, [form.quantity, form.unitPrice]);

  useEffect(() => {
    if (!shouldShowPaymentFields) {
      setForm((current) =>
        current.amountPaid === "" && current.mpesaReference === ""
          ? current
          : { ...current, amountPaid: "", mpesaReference: "" },
      );
    }
  }, [shouldShowPaymentFields]);

  useEffect(() => {
    if (selectedProduct && form.productName.trim().toLowerCase() !== selectedProduct.name.trim().toLowerCase()) {
      setSelectedProduct(null);
    }
  }, [form.productName, selectedProduct]);

  useEffect(() => {
    const query = deferredProductQuery;
    if (query.length < 2) {
      setSuggestions([]);
      setSuggestionsBusy(false);
      return;
    }

    let cancelled = false;
    setSuggestionsBusy(true);

    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/products?search=${encodeURIComponent(query)}&activeOnly=1&limit=8`, {
          cache: "no-store",
        });
        const payload = await response.json().catch(() => []);
        if (cancelled) return;
        const nextSuggestions = Array.isArray(payload) ? payload : [];
        setSuggestions(nextSuggestions);
        setSuggestionsOpen(true);
      } catch {
        if (!cancelled) setSuggestions([]);
      } finally {
        if (!cancelled) setSuggestionsBusy(false);
      }
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [deferredProductQuery]);

  function update<K extends keyof typeof initialForm>(key: K, value: (typeof initialForm)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function selectProduct(product: ProductSuggestion) {
    setSelectedProduct(product);
    setSuggestionsOpen(false);
    setSuggestions([]);
    setForm((current) => ({
      ...current,
      productName: product.name,
      unitPrice: product.sellingPrice != null ? String(Number(product.sellingPrice)) : current.unitPrice,
    }));
  }

  function clearSelectedProduct() {
    setSelectedProduct(null);
    setSuggestions([]);
    setSuggestionsOpen(false);
  }

  function updateCounty(value: string) {
    const towns = getTownsForCounty(value);
    setForm((current) => ({
      ...current,
      customerCounty: value,
      customerLocation: towns.includes(current.customerLocation as never) ? current.customerLocation : "",
    }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setSuccess(null);

    const deliveryMethod =
      form.paymentOption === "shop_pickup"
        ? "shop_pickup"
        : form.paymentOption === "pay_on_delivery"
          ? "rider"
          : "courier";

    const amountPaid = shouldShowPaymentFields ? Number(form.amountPaid || 0) : 0;

    const response = await fetch("/api/agents/sales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerName: form.customerName,
        customerPhone: form.customerPhone,
        customerCounty: form.customerCounty,
        customerLocation: form.customerLocation,
        productName: form.productName,
        productCategory: selectedProduct?.category || "",
        quantity: Number(form.quantity || 0),
        unitPrice: Number(form.unitPrice || 0),
        totalAmount: Number(form.totalAmount || 0),
        paymentType: paymentTypeToApiValue[form.paymentOption],
        amountPaid,
        mpesaReference: shouldShowPaymentFields ? form.mpesaReference : "",
        deliveryMethod,
        deliveryNotes:
          form.paymentOption === "pay_on_delivery"
            ? "Customer prefers pay on delivery."
            : form.paymentOption === "full_payment"
              ? "Customer prefers to pay full amount before dispatch."
              : form.paymentOption === "transport_fee"
                ? "Customer pays transport fee first, then clears balance on delivery."
                : "Customer will collect from the Nairobi shop.",
        customerNotes: `Preferred payment option: ${selectedPayment.title}.`,
        internalAgentNotes: "",
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
    <div className="mx-auto max-w-[1100px] space-y-5 sm:space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl md:text-4xl">Submit Customer Order</h1>
        <p className="text-base text-slate-600">Capture customer details and submit the order for processing.</p>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      ) : null}
      {success ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className={sectionCardClassName()}>
          <div className="mb-5">
            <h2 className="text-xl font-black text-slate-950">Customer Details</h2>
            <p className="mt-1 text-sm text-slate-500">Enter the customer information correctly.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-700">Customer Name</span>
              <input
                required
                value={form.customerName}
                onChange={(event) => update("customerName", event.target.value)}
                className={inputClassName()}
                placeholder="Customer full name"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-700">Phone Number</span>
              <input
                required
                value={form.customerPhone}
                onChange={(event) => update("customerPhone", event.target.value)}
                className={inputClassName()}
                placeholder="e.g. 0712345678"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-700">County</span>
              <select
                required
                value={form.customerCounty}
                onChange={(event) => updateCounty(event.target.value)}
                className={inputClassName()}
              >
                <option value="">Select county</option>
                {kenyaCountyOptions.map((county) => (
                  <option key={county} value={county}>
                    {county}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-700">Town / Market Centre</span>
              <select
                required
                disabled={!form.customerCounty}
                value={form.customerLocation}
                onChange={(event) => update("customerLocation", event.target.value)}
                className={`${inputClassName()} disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400`}
              >
                <option value="">{form.customerCounty ? "Select town / market centre" : "Select county first"}</option>
                {availableTowns.map((town) => (
                  <option key={town} value={town}>
                    {town}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className={sectionCardClassName()}>
          <div className="mb-5">
            <h2 className="text-xl font-black text-slate-950">Product Details</h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 sm:col-span-2">
              <span className="text-sm font-semibold text-slate-700">Product Name</span>
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  required
                  value={form.productName}
                  onFocus={() => {
                    if (suggestions.length) setSuggestionsOpen(true);
                  }}
                  onChange={(event) => {
                    update("productName", event.target.value);
                    setSuggestionsOpen(true);
                  }}
                  className={`${inputClassName()} pl-12 pr-11`}
                  placeholder="Type product name e.g. 200W Full Kit"
                />
                {form.productName ? (
                  <button
                    type="button"
                    onClick={() => {
                      update("productName", "");
                      clearSelectedProduct();
                    }}
                    className="absolute right-3 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                    aria-label="Clear product search"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
                {suggestionsOpen && (suggestionsBusy || suggestions.length > 0) ? (
                  <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-20 overflow-hidden rounded-[22px] border border-[#ead9ce] bg-white shadow-[0_20px_48px_rgba(72,36,19,0.14)]">
                    {suggestionsBusy ? (
                      <div className="px-4 py-3 text-sm text-slate-500">Searching catalogue products...</div>
                    ) : (
                      <div className="max-h-80 overflow-y-auto py-2">
                        {suggestions.map((product) => {
                          const unitPrice = Number(product.sellingPrice ?? 0);
                          const suggestionCommission = commissionForProduct(product, unitPrice);
                          return (
                            <button
                              key={product.id}
                              type="button"
                              onClick={() => selectProduct(product)}
                              className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left transition hover:bg-[#fff8ef]"
                            >
                              <div className="min-w-0">
                                <div className="line-clamp-2 text-sm font-bold text-slate-950">{product.name}</div>
                                <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-xs text-slate-500">
                                  {product.category ? <span>{product.category}</span> : null}
                                  {product.sku ? <span>SKU: {product.sku}</span> : null}
                                  {product.defaultWarranty ? <span>{product.defaultWarranty}</span> : null}
                                </div>
                              </div>
                              <div className="shrink-0 text-right">
                                <div className="text-sm font-black text-slate-950">{currency(unitPrice)}</div>
                                <div className="mt-1 text-xs font-semibold text-[#7a0000]">
                                  Commission {currency(suggestionCommission)}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
              <div className="text-xs text-slate-500">
                Start typing to match a live Betech catalogue product and auto-fill linked price and commission.
              </div>
              {selectedProduct ? (
                <div className="rounded-[20px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm">
                  <div className="font-bold text-emerald-900">{selectedProduct.name}</div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-emerald-800/80">
                    {selectedProduct.category ? <span>Category: {selectedProduct.category}</span> : null}
                    <span>Linked price: {currency(selectedProduct.sellingPrice ?? 0)}</span>
                    <span>Matched commission: {currency(commissionForProduct(selectedProduct, Number(selectedProduct.sellingPrice ?? 0)))}</span>
                  </div>
                </div>
              ) : null}
            </label>
            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-700">Quantity</span>
              <input
                type="number"
                min="1"
                step="0.01"
                required
                value={form.quantity}
                onChange={(event) => update("quantity", event.target.value)}
                className={inputClassName()}
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-700">Unit Price</span>
              <input
                type="number"
                min="0"
                step="0.01"
                required
                value={form.unitPrice}
                onChange={(event) => update("unitPrice", event.target.value)}
                className={inputClassName()}
              />
            </label>
            <label className="space-y-2 sm:col-span-2">
              <span className="text-sm font-semibold text-slate-700">Total Amount</span>
              <input
                type="number"
                min="0"
                step="0.01"
                required
                value={form.totalAmount}
                onChange={(event) => update("totalAmount", event.target.value)}
                className={inputClassName()}
              />
            </label>
          </div>
        </div>

        <div className={sectionCardClassName()}>
          <div className="mb-5">
            <h2 className="text-xl font-black text-slate-950">How Will The Customer Pay?</h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {paymentOptions.map((option) => {
              const Icon = option.icon;
              const active = form.paymentOption === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => update("paymentOption", option.value)}
                  className={`rounded-[24px] border p-5 text-left transition ${paymentCardClasses(active, option.accent)}`}
                >
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
                      active
                        ? option.accent === "emerald"
                          ? "bg-emerald-500 text-white"
                          : option.accent === "gold"
                            ? "bg-[#f2b20f] text-slate-950"
                            : option.accent === "sky"
                              ? "bg-sky-500 text-white"
                              : "bg-slate-700 text-white"
                        : "bg-[#fff3d8] text-[#7a0000]"
                    }`}
                  >
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="mt-4 text-lg font-black text-slate-950">{option.title}</div>
                  <div className="mt-2 text-sm font-semibold text-slate-700">{option.note}</div>
                  <div className="mt-1 text-sm leading-6 text-slate-500">{option.detail}</div>
                </button>
              );
            })}
          </div>

          {shouldShowPaymentFields ? (
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-semibold text-slate-700">Amount Paid</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.amountPaid}
                  onChange={(event) => update("amountPaid", event.target.value)}
                  className={inputClassName()}
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold text-slate-700">M-Pesa Reference</span>
                <input
                  value={form.mpesaReference}
                  onChange={(event) => update("mpesaReference", event.target.value)}
                  className={inputClassName()}
                  placeholder="Enter M-Pesa reference"
                />
              </label>
            </div>
          ) : null}
        </div>

        <div className="rounded-[28px] bg-white px-5 py-5 shadow-[0_10px_30px_rgba(72,36,19,0.06)] ring-1 ring-[#ead9ce]">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-lg font-black text-slate-950">How Orders Work</div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-600">
                <span>Submit</span>
                <ArrowRight className="h-4 w-4 text-[#7a0000]/45" />
                <span>Confirm</span>
                <ArrowRight className="h-4 w-4 text-[#7a0000]/45" />
                <span>Deliver</span>
                <ArrowRight className="h-4 w-4 text-[#7a0000]/45" />
                <span>Customer Pays</span>
                <ArrowRight className="h-4 w-4 text-[#7a0000]/45" />
                <span>Commission Unlocks</span>
              </div>
            </div>
            <Link
              href={agentPath("/sales", useRootPaths)}
              className="inline-flex items-center justify-center gap-2 text-sm font-semibold text-[#7a0000] hover:text-[#560000] md:justify-start"
            >
              View my sales
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <div className="space-y-3">
          <button
            type="submit"
            disabled={busy}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#7a0000] px-5 py-4 text-base font-bold text-white shadow-[0_18px_38px_rgba(122,0,0,0.20)] transition hover:-translate-y-0.5 hover:bg-[#5e0000] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? "Submitting order..." : "Submit Customer Order"}
            <ArrowRight className="h-5 w-5" />
          </button>
          <p className="text-center text-sm text-slate-500">Betech will review and process the order.</p>
        </div>
      </form>

      <div className="grid gap-3 rounded-[28px] bg-[#fffaf3] p-4 ring-1 ring-[#ead9ce] md:grid-cols-3">
        <div className="rounded-[22px] bg-white px-5 py-4 shadow-[0_8px_24px_rgba(72,36,19,0.05)]">
          <div className="text-xs font-black uppercase tracking-[0.2em] text-[#7a0000]">Potential Commission</div>
          <div className="mt-2 text-3xl font-black text-slate-950">{currency(potentialCommission)}</div>
          <div className="mt-1 text-sm text-slate-500">Locked until customer pays fully and delivery or collection is confirmed.</div>
        </div>
        <div className="rounded-[22px] bg-white px-5 py-4 shadow-[0_8px_24px_rgba(72,36,19,0.05)]">
          <div className="text-xs font-black uppercase tracking-[0.2em] text-[#7a0000]">Commission Not Paid</div>
          <div className="mt-2 text-3xl font-black text-slate-950">{currency(unpaidCommission)}</div>
          <div className="mt-1 text-sm text-slate-500">Completed commission still waiting for payout.</div>
        </div>
        <div className="rounded-[22px] bg-white px-5 py-4 shadow-[0_8px_24px_rgba(72,36,19,0.05)]">
          <div className="text-xs font-black uppercase tracking-[0.2em] text-[#7a0000]">Commission Earned So Far</div>
          <div className="mt-2 text-3xl font-black text-slate-950">{currency(earnedCommission)}</div>
          <div className="mt-1 text-sm text-slate-500">Every completed sale moves you closer to more income.</div>
        </div>
      </div>
    </div>
  );
}
