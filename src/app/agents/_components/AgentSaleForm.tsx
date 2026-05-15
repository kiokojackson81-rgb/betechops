"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Building2,
  CreditCard,
  MapPinned,
  PackageCheck,
  ReceiptText,
  ShieldCheck,
  Store,
  Truck,
} from "lucide-react";
import { agentPath } from "@/lib/agents/host";
import { getTownsForCounty, kenyaCountyOptions } from "@/lib/agents/kenyaMarkets";

type AgentSaleFormProps = {
  useRootPaths?: boolean;
};

const paymentTypes = [
  { value: "transport_fee", label: "Transport fee", note: "Use when customer is outside Nairobi and needs dispatch arrangement started." },
  { value: "deposit", label: "Deposit", note: "Use when customer is committing to an order before final balance is cleared." },
  { value: "full_payment", label: "Full payment", note: "Use when customer has cleared the full order amount." },
];

const deliveryMethods = [
  { value: "courier", label: "Courier / parcel delivery" },
  { value: "rider", label: "Betech rider / pay on delivery" },
  { value: "shop_pickup", label: "Shop pickup - Nairobi CBD" },
  { value: "agent_pickup", label: "Send to nearest agent / pickup point" },
];

const initialForm = {
  customerName: "",
  customerPhone: "",
  customerCounty: "",
  customerLocation: "",
  productName: "",
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

function currency(value: string | number) {
  const amount = Number(value || 0);
  return `Ksh ${amount.toLocaleString("en-KE", { maximumFractionDigits: 2 })}`;
}

function fieldClassName() {
  return "w-full rounded-2xl border border-[#e6d7ce] bg-[#fffdfb] px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#7a0000]/35 focus:bg-white focus:ring-4 focus:ring-[#f2b20f]/10";
}

function labelClassName() {
  return "text-sm font-semibold text-slate-700";
}

export default function AgentSaleForm({ useRootPaths = false }: AgentSaleFormProps) {
  const router = useRouter();
  const [form, setForm] = useState(initialForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const isNairobi = form.customerCounty === "Nairobi";
  const availableTowns = getTownsForCounty(form.customerCounty);
  const numericTotal = Number(form.totalAmount || 0);
  const numericPaid = Number(form.amountPaid || 0);
  const balance = Math.max(numericTotal - numericPaid, 0);
  const potentialCommission = Math.round(numericTotal * 0.06 * 100) / 100;
  const selectedPaymentType = paymentTypes.find((item) => item.value === form.paymentType);
  const selectedDeliveryMethod = deliveryMethods.find((item) => item.value === form.deliveryMethod);

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

  function updateCounty(value: string) {
    const towns = getTownsForCounty(value);
    setForm((current) => ({
      ...current,
      customerCounty: value,
      customerLocation: towns.some((town) => town === current.customerLocation) ? current.customerLocation : "",
      deliveryMethod:
        value === "Nairobi"
          ? current.deliveryMethod === "courier" || current.deliveryMethod === "agent_pickup"
            ? ""
            : current.deliveryMethod
          : current.deliveryMethod === "rider"
            ? ""
            : current.deliveryMethod,
    }));
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
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <p className="text-xs font-black uppercase tracking-[0.28em] text-[#7a0000]">Agent sales desk</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 md:text-4xl">Submit a customer order opportunity</h1>
          <p className="mt-3 text-base leading-7 text-slate-600">
            Capture the customer, location, payment stage, and delivery plan correctly so admin can process the order through the normal Betech flow and issue a receipt once the order is confirmed.
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href={agentPath("/sales", useRootPaths)}
            className="rounded-2xl border border-[#7a0000]/12 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-[#7a0000]/25 hover:bg-[#fff8f3]"
          >
            View my sales
          </Link>
          <Link
            href={agentPath("/dashboard", useRootPaths)}
            className="rounded-2xl bg-[#fff3d8] px-4 py-3 text-sm font-semibold text-[#7a0000] transition hover:bg-[#ffe7ab]"
          >
            Dashboard
          </Link>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-[28px] border border-[#ead9ce] bg-[linear-gradient(180deg,#fffefb_0%,#fff7ef_100%)] p-5 shadow-[0_10px_28px_rgba(72,36,19,0.05)]">
              <div className="text-xs font-black uppercase tracking-[0.2em] text-[#7a0000]">Potential commission</div>
              <div className="mt-3 text-3xl font-black text-slate-950">{currency(potentialCommission)}</div>
              <p className="mt-2 text-sm leading-6 text-slate-600">Locked until customer pays fully and delivery or collection is confirmed.</p>
            </div>
            <div className="rounded-[28px] border border-[#ead9ce] bg-white p-5 shadow-[0_10px_28px_rgba(72,36,19,0.05)]">
              <div className="text-xs font-black uppercase tracking-[0.2em] text-[#7a0000]">Amount paid</div>
              <div className="mt-3 text-3xl font-black text-slate-950">{currency(numericPaid)}</div>
              <p className="mt-2 text-sm leading-6 text-slate-600">Use M-Pesa reference whenever the customer has already sent any payment.</p>
            </div>
            <div className="rounded-[28px] border border-[#ead9ce] bg-white p-5 shadow-[0_10px_28px_rgba(72,36,19,0.05)]">
              <div className="text-xs font-black uppercase tracking-[0.2em] text-[#7a0000]">Outstanding balance</div>
              <div className="mt-3 text-3xl font-black text-slate-950">{currency(balance)}</div>
              <p className="mt-2 text-sm leading-6 text-slate-600">Admin follows up the balance before a commission becomes earned.</p>
            </div>
          </div>

          {error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
          ) : null}
          {success ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-6">
            <section className="rounded-[30px] border border-[#ead9ce] bg-white p-6 shadow-[0_12px_34px_rgba(72,36,19,0.06)] md:p-7">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#fff3d8] text-[#7a0000]">
                  <MapPinned className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-950">Customer and location</h2>
                  <p className="text-sm text-slate-500">Select county first, then choose the market centre or town.</p>
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className={labelClassName()}>Customer name</span>
                  <input
                    required
                    value={form.customerName}
                    onChange={(event) => update("customerName", event.target.value)}
                    className={fieldClassName()}
                    placeholder="Customer full name"
                  />
                </label>
                <label className="space-y-2">
                  <span className={labelClassName()}>Customer phone</span>
                  <input
                    required
                    value={form.customerPhone}
                    onChange={(event) => update("customerPhone", event.target.value)}
                    className={fieldClassName()}
                    placeholder="e.g. 0712345678"
                  />
                </label>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className={labelClassName()}>Customer county</span>
                  <select
                    required
                    value={form.customerCounty}
                    onChange={(event) => updateCounty(event.target.value)}
                    className={fieldClassName()}
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
                  <span className={labelClassName()}>Town / market centre</span>
                  <select
                    required
                    disabled={!form.customerCounty}
                    value={form.customerLocation}
                    onChange={(event) => update("customerLocation", event.target.value)}
                    className={`${fieldClassName()} disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400`}
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
            </section>

            <section className="rounded-[30px] border border-[#ead9ce] bg-white p-6 shadow-[0_12px_34px_rgba(72,36,19,0.06)] md:p-7">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#fff3d8] text-[#7a0000]">
                  <PackageCheck className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-950">Product and pricing</h2>
                  <p className="text-sm text-slate-500">Keep this simple and exact so admin can turn it into a receipt smoothly.</p>
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className={labelClassName()}>Product name</span>
                  <input
                    required
                    value={form.productName}
                    onChange={(event) => update("productName", event.target.value)}
                    className={fieldClassName()}
                    placeholder="e.g. 5KW solar kit"
                  />
                </label>
                <label className="space-y-2">
                  <span className={labelClassName()}>Quantity</span>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    required
                    value={form.quantity}
                    onChange={(event) => update("quantity", event.target.value)}
                    className={fieldClassName()}
                  />
                </label>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <label className="space-y-2">
                  <span className={labelClassName()}>Unit price</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={form.unitPrice}
                    onChange={(event) => update("unitPrice", event.target.value)}
                    className={fieldClassName()}
                  />
                </label>
                <label className="space-y-2">
                  <span className={labelClassName()}>Total amount</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={form.totalAmount}
                    onChange={(event) => update("totalAmount", event.target.value)}
                    className={fieldClassName()}
                  />
                </label>
                <label className="space-y-2">
                  <span className={labelClassName()}>Amount paid so far</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={form.amountPaid}
                    onChange={(event) => update("amountPaid", event.target.value)}
                    className={fieldClassName()}
                  />
                </label>
              </div>
            </section>

            <section className="rounded-[30px] border border-[#ead9ce] bg-white p-6 shadow-[0_12px_34px_rgba(72,36,19,0.06)] md:p-7">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#fff3d8] text-[#7a0000]">
                  <CreditCard className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-950">Payment and delivery procedure</h2>
                  <p className="text-sm text-slate-500">Use the correct payment stage and route so operations can process the order properly.</p>
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <label className="space-y-2 md:col-span-1">
                  <span className={labelClassName()}>Payment stage</span>
                  <select
                    required
                    value={form.paymentType}
                    onChange={(event) => update("paymentType", event.target.value)}
                    className={fieldClassName()}
                  >
                    {paymentTypes.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-2 md:col-span-1">
                  <span className={labelClassName()}>Delivery method</span>
                  <select
                    required
                    value={form.deliveryMethod}
                    onChange={(event) => update("deliveryMethod", event.target.value)}
                    className={fieldClassName()}
                  >
                    <option value="">Select method</option>
                    {deliveryMethods
                      .filter((item) => (isNairobi ? item.value !== "agent_pickup" : item.value !== "rider"))
                      .map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="space-y-2 md:col-span-1">
                  <span className={labelClassName()}>M-Pesa reference</span>
                  <input
                    value={form.mpesaReference}
                    onChange={(event) => update("mpesaReference", event.target.value)}
                    className={fieldClassName()}
                    placeholder="Optional until payment is made"
                  />
                </label>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <div className="rounded-[24px] border border-[#ecd8b1] bg-[#fff8e8] p-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#f2b20f] text-slate-950">
                      {isNairobi ? <Truck className="h-5 w-5" /> : <Building2 className="h-5 w-5" />}
                    </div>
                    <div className="text-lg font-black text-slate-950">{isNairobi ? "Nairobi order flow" : "Outside Nairobi order flow"}</div>
                  </div>
                  <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
                    {isNairobi ? (
                      <>
                        <li>Customer can pay on delivery within Nairobi after being guided to paybill <span className="font-bold text-[#7a0000]">516600</span>, account <span className="font-bold text-[#7a0000]">0710098001</span>.</li>
                        <li>Customer may also collect from the Betech shop in Nairobi CBD.</li>
                        <li>Once the order is confirmed, admin issues the receipt immediately.</li>
                      </>
                    ) : (
                      <>
                        <li>Ask the customer to pay a deposit first when the order is being delivered.</li>
                        <li>If needed, collect transport fee first so dispatch can be arranged.</li>
                        <li>Order can be sent through SpeedAF or to the nearest agent / pickup point, then the balance is cleared.</li>
                      </>
                    )}
                  </ul>
                </div>

                <div className="rounded-[24px] border border-[#ead9ce] bg-[#fffdfb] p-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#7a0000] text-white">
                      <ReceiptText className="h-5 w-5" />
                    </div>
                    <div className="text-lg font-black text-slate-950">Recommended procedure</div>
                  </div>
                  <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
                    <li><span className="font-semibold text-slate-950">Payment type:</span> {selectedPaymentType?.note || "Choose the correct customer payment stage."}</li>
                    <li><span className="font-semibold text-slate-950">Delivery route:</span> {selectedDeliveryMethod?.label || "Select how the order will move to the customer."}</li>
                    <li><span className="font-semibold text-slate-950">Full payment:</span> If customer clears full amount, admin can parcel using the preferred courier.</li>
                    <li><span className="font-semibold text-slate-950">Commission:</span> Potential commission shows now, but stays locked until payment is complete and delivery is confirmed.</li>
                  </ul>
                </div>
              </div>
            </section>

            <section className="rounded-[30px] border border-[#ead9ce] bg-white p-6 shadow-[0_12px_34px_rgba(72,36,19,0.06)] md:p-7">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#fff3d8] text-[#7a0000]">
                  <Store className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-950">Notes for admin follow-up</h2>
                  <p className="text-sm text-slate-500">Anything that helps operations process the order faster.</p>
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className={labelClassName()}>Delivery notes</span>
                  <textarea
                    rows={4}
                    value={form.deliveryNotes}
                    onChange={(event) => update("deliveryNotes", event.target.value)}
                    className={fieldClassName()}
                    placeholder="Courier preference, pickup point, nearest agent, estate, or landmark"
                  />
                </label>
                <label className="space-y-2">
                  <span className={labelClassName()}>Customer notes</span>
                  <textarea
                    rows={4}
                    value={form.customerNotes}
                    onChange={(event) => update("customerNotes", event.target.value)}
                    className={fieldClassName()}
                    placeholder="Any customer preference, urgency, or product clarification"
                  />
                </label>
              </div>

              <label className="mt-4 block space-y-2">
                <span className={labelClassName()}>Internal agent notes</span>
                <textarea
                  rows={4}
                  value={form.internalAgentNotes}
                  onChange={(event) => update("internalAgentNotes", event.target.value)}
                  className={fieldClassName()}
                  placeholder="Internal context for admin only"
                />
              </label>
            </section>

            <div className="rounded-[26px] border border-[#ecd8b1] bg-[#fff8e8] p-4 text-sm leading-6 text-slate-700">
              <span className="font-black text-slate-950">Important:</span> receipt creation still happens after admin review and confirmation. Agents do not issue receipts directly from this page.
            </div>

            <button
              type="submit"
              disabled={busy}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#7a0000] px-5 py-4 text-base font-bold text-white shadow-[0_18px_38px_rgba(122,0,0,0.20)] transition hover:-translate-y-0.5 hover:bg-[#5e0000] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? "Submitting sale..." : "Submit sale for admin review"}
              <ArrowRight className="h-5 w-5" />
            </button>
          </form>
        </div>

        <aside className="space-y-5">
          <div className="rounded-[30px] border border-[#ead9ce] bg-[linear-gradient(180deg,#fffdf8_0%,#fff4e3_100%)] p-6 shadow-[0_12px_34px_rgba(72,36,19,0.06)]">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#7a0000] text-white">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <div className="text-lg font-black text-slate-950">Order handling checklist</div>
                <div className="text-sm text-slate-500">Use this flow before you submit.</div>
              </div>
            </div>
            <div className="mt-5 space-y-4">
              {[
                "Choose the county, then the exact town or market centre.",
                "Confirm the product name, quantity, and agreed selling price.",
                "Record how much the customer has already paid.",
                "For outside Nairobi, ask for deposit or transport fee before dispatch.",
                "For Nairobi, customer may pay on delivery or collect from the shop.",
                "Add the M-Pesa reference once payment is made.",
              ].map((item, index) => (
                <div key={item} className="flex gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f2b20f] text-sm font-black text-slate-950">
                    {index + 1}
                  </div>
                  <p className="pt-1 text-sm leading-6 text-slate-700">{item}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[30px] border border-[#ead9ce] bg-white p-6 shadow-[0_12px_34px_rgba(72,36,19,0.06)]">
            <div className="text-lg font-black text-slate-950">Payment instructions</div>
            <div className="mt-4 rounded-[22px] border border-[#ead9ce] bg-[#fffaf3] p-4">
              <div className="text-xs font-black uppercase tracking-[0.2em] text-[#7a0000]">Paybill</div>
              <div className="mt-2 text-3xl font-black text-slate-950">516600</div>
              <div className="mt-4 text-xs font-black uppercase tracking-[0.2em] text-[#7a0000]">Account number</div>
              <div className="mt-2 text-2xl font-black text-slate-950">0710098001</div>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-600">
              Use the customer’s confirmed payment stage on the form. Admin will validate the money received and issue a receipt once the order is confirmed.
            </p>
          </div>

          <div className="rounded-[30px] border border-[#ead9ce] bg-white p-6 shadow-[0_12px_34px_rgba(72,36,19,0.06)]">
            <div className="text-lg font-black text-slate-950">How this sale moves next</div>
            <div className="mt-5 space-y-4">
              {[
                ["1", "Pending review", "Admin checks the customer details and payment stage."],
                ["2", "Receipt and processing", "Once confirmed, the order is processed through the normal Betech receipt flow."],
                ["3", "Delivery or collection", "Order is delivered, dispatched, or collected depending on the agreed route."],
                ["4", "Commission unlock", "Your 6% commission becomes earned only after full payment and completion."],
              ].map(([step, title, note]) => (
                <div key={step} className="flex gap-3 rounded-[20px] border border-[#efe4dd] bg-[#fffdfb] p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#7a0000] text-sm font-black text-white">
                    {step}
                  </div>
                  <div>
                    <div className="font-black text-slate-950">{title}</div>
                    <div className="mt-1 text-sm leading-6 text-slate-600">{note}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
