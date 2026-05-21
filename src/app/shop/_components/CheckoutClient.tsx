"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { buildDetailedCart, clearShopCart, useShopCartItems } from "@/app/shop/cartStore";
import { createShopOrder } from "@/app/shop/shopApi";
import type { ShopProduct } from "@/app/shop/shopData";
import { formatCurrency, shopStyles } from "@/app/shop/_components/shopStyles";

type CheckoutClientProps = {
  products: ShopProduct[];
};

export default function CheckoutClient({ products }: CheckoutClientProps) {
  const router = useRouter();
  const items = useShopCartItems();
  const detailedItems = buildDetailedCart(items, products);
  const subtotal = detailedItems.reduce((sum, item) => sum + item.lineTotal, 0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    fullName: "",
    phoneNumber: "",
    location: "",
    deliveryMethod: "Nairobi rider delivery",
    paymentPreference: "Pay on delivery Nairobi",
    notes: "",
  });

  if (!detailedItems.length) {
    return (
      <div className={`${shopStyles.softCard} p-6 sm:p-8`}>
        <div className={shopStyles.sectionEyebrow}>Cart required</div>
        <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950">Add products before starting checkout.</h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
          This checkout stays mock-only for now and will create a safe pending ecommerce order later when ops integration starts.
        </p>
        <div className="mt-6">
          <Link href="/shop/cart" className={shopStyles.primaryButton}>
            Go to Cart
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
      <form
        className={`${shopStyles.lightCard} p-5 sm:p-6`}
        onSubmit={async (event) => {
          event.preventDefault();
          setSubmitting(true);
          setError(null);

          try {
            const result = await createShopOrder({
              items: detailedItems.map((item) => ({
                productId: item.product.id,
                quantity: item.quantity,
              })),
              customerName: form.fullName,
              customerPhone: form.phoneNumber,
              location: form.location,
              deliveryMethod: form.deliveryMethod,
              paymentPreference: form.paymentPreference,
              notes: form.notes,
            });

            clearShopCart();
            router.push(`/shop/order-success?ref=${encodeURIComponent(result.orderRef)}`);
          } catch (submissionError) {
            setError(submissionError instanceof Error ? submissionError.message : "Unable to create mock order.");
          } finally {
            setSubmitting(false);
          }
        }}
      >
        <div className={shopStyles.sectionEyebrow}>Checkout</div>
        <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950">Complete your mock Betech Solar checkout.</h1>
        <p className="mt-3 text-base leading-7 text-slate-600">
          This phase does not connect live backend logic yet. Submitting creates a safe mock pending order only.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            Full name
            <input
              required
              value={form.fullName}
              onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))}
              className="min-h-[3.4rem] rounded-2xl border border-[#7a0000]/10 bg-white px-4 outline-none"
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            Phone number
            <input
              required
              value={form.phoneNumber}
              onChange={(event) => setForm((current) => ({ ...current, phoneNumber: event.target.value }))}
              className="min-h-[3.4rem] rounded-2xl border border-[#7a0000]/10 bg-white px-4 outline-none"
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-slate-700 sm:col-span-2">
            County / location
            <input
              required
              value={form.location}
              onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))}
              className="min-h-[3.4rem] rounded-2xl border border-[#7a0000]/10 bg-white px-4 outline-none"
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            Delivery method
            <select
              value={form.deliveryMethod}
              onChange={(event) => setForm((current) => ({ ...current, deliveryMethod: event.target.value }))}
              className="min-h-[3.4rem] rounded-2xl border border-[#7a0000]/10 bg-white px-4 outline-none"
            >
              <option>Nairobi rider delivery</option>
              <option>Countrywide courier</option>
              <option>Shop pickup</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            Payment preference
            <select
              value={form.paymentPreference}
              onChange={(event) => setForm((current) => ({ ...current, paymentPreference: event.target.value }))}
              className="min-h-[3.4rem] rounded-2xl border border-[#7a0000]/10 bg-white px-4 outline-none"
            >
              <option>Pay on delivery Nairobi</option>
              <option>Pay transport fee first</option>
              <option>Deposit/full payment</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold text-slate-700 sm:col-span-2">
            Order notes
            <textarea
              rows={5}
              value={form.notes}
              onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
              className="rounded-[24px] border border-[#7a0000]/10 bg-white px-4 py-3 outline-none"
            />
          </label>
        </div>

        {error ? <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button type="submit" disabled={submitting} className={shopStyles.primaryButton}>
            {submitting ? "Creating Mock Order..." : "Submit Mock Order"}
          </button>
          <Link href="/shop/cart" className={shopStyles.secondaryButton}>
            Back to Cart
          </Link>
        </div>
      </form>

      <aside className={`${shopStyles.softCard} h-fit p-5 sm:p-6 xl:sticky xl:top-28`}>
        <div className={shopStyles.sectionEyebrow}>Order Summary</div>
        <div className="mt-5 grid gap-4">
          {detailedItems.map((item) => (
            <div key={item.product.id} className="flex items-start justify-between gap-3 border-b border-[#7a0000]/10 pb-4">
              <div>
                <div className="text-sm font-black text-slate-950">{item.product.name}</div>
                <div className="mt-1 text-xs text-slate-500">Qty {item.quantity}</div>
              </div>
              <div className="text-sm font-semibold text-slate-950">{formatCurrency(item.lineTotal)}</div>
            </div>
          ))}
        </div>
        <div className="mt-5 flex items-center justify-between text-lg font-black text-slate-950">
          <span>Estimated total</span>
          <span>{formatCurrency(subtotal)}</span>
        </div>
        <p className="mt-4 text-sm leading-6 text-slate-500">
          TODO: Checkout should create pending ecommerce order in ops and later connect customer, delivery, and receipt workflows.
        </p>
      </aside>
    </div>
  );
}
