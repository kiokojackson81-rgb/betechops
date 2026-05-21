"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { buildDetailedCart, useShopCartItems } from "@/app/shop/cartStore";
import { createShopOrder } from "@/app/shop/shopApi";
import type { ShopProduct } from "@/app/shop/shopData";
import { formatCurrency, shopStyles } from "@/app/shop/_components/shopStyles";
import { buildStoredOrderItems, clearCartAfterOrder, saveMockOrder } from "@/app/shop/shopStorage";

type CheckoutClientProps = {
  products: ShopProduct[];
};

type CheckoutFieldErrors = {
  fullName?: string;
  phoneNumber?: string;
  location?: string;
  deliveryMethod?: string;
  paymentPreference?: string;
  cart?: string;
};

export default function CheckoutClient({ products }: CheckoutClientProps) {
  const router = useRouter();
  const items = useShopCartItems();
  const detailedItems = buildDetailedCart(items, products);
  const subtotal = detailedItems.reduce((sum, item) => sum + item.lineTotal, 0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<CheckoutFieldErrors>({});
  const [form, setForm] = useState({
    fullName: "",
    phoneNumber: "",
    location: "",
    deliveryMethod: "",
    paymentPreference: "",
    notes: "",
  });

  function validateForm() {
    const nextErrors: CheckoutFieldErrors = {};

    if (!form.fullName.trim()) nextErrors.fullName = "Please enter the customer name for this Betech Solar order.";
    if (!form.phoneNumber.trim()) nextErrors.phoneNumber = "Please enter a phone number so our solar team can confirm the order.";
    if (!form.location.trim()) nextErrors.location = "Please tell us the county or delivery location.";
    if (!form.deliveryMethod.trim()) nextErrors.deliveryMethod = "Please choose how you want Betech Solar to deliver or prepare pickup.";
    if (!form.paymentPreference.trim()) nextErrors.paymentPreference = "Please choose your preferred payment arrangement.";
    if (!detailedItems.length) nextErrors.cart = "Your cart is empty. Add products before submitting this order.";

    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  const inputBaseClass = "min-h-[3.4rem] rounded-2xl border bg-white px-4 outline-none transition";
  const resolveFieldClass = (fieldError?: string) =>
    `${inputBaseClass} ${fieldError ? "border-red-300 ring-2 ring-red-100" : "border-[#7a0000]/10 focus:border-[#7a0000]/30"}`;

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
          if (!validateForm()) return;
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

            const savedOrder = saveMockOrder({
              customerName: form.fullName.trim(),
              phone: form.phoneNumber.trim(),
              location: form.location.trim(),
              deliveryMethod: form.deliveryMethod,
              paymentPreference: form.paymentPreference,
              notes: form.notes.trim() || undefined,
              subtotal,
              items: buildStoredOrderItems(
                detailedItems.map((item) => ({
                  productId: item.product.id,
                  quantity: item.quantity,
                })),
                new Map(products.map((product) => [product.id, { name: product.name, price: product.price }])),
              ),
            });

            clearCartAfterOrder();
            router.push(
              `/shop/order-success?ref=${encodeURIComponent(savedOrder.orderRef)}&mode=${encodeURIComponent(result.source || "mock")}`,
            );
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
              value={form.fullName}
              onChange={(event) => {
                const value = event.target.value;
                setForm((current) => ({ ...current, fullName: value }));
                if (fieldErrors.fullName) setFieldErrors((current) => ({ ...current, fullName: undefined }));
              }}
              className={resolveFieldClass(fieldErrors.fullName)}
            />
            {fieldErrors.fullName ? <span className="text-xs font-semibold text-red-600">{fieldErrors.fullName}</span> : null}
          </label>
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            Phone number
            <input
              value={form.phoneNumber}
              onChange={(event) => {
                const value = event.target.value;
                setForm((current) => ({ ...current, phoneNumber: value }));
                if (fieldErrors.phoneNumber) setFieldErrors((current) => ({ ...current, phoneNumber: undefined }));
              }}
              className={resolveFieldClass(fieldErrors.phoneNumber)}
            />
            {fieldErrors.phoneNumber ? <span className="text-xs font-semibold text-red-600">{fieldErrors.phoneNumber}</span> : null}
          </label>
          <label className="grid gap-2 text-sm font-semibold text-slate-700 sm:col-span-2">
            County / location
            <input
              value={form.location}
              onChange={(event) => {
                const value = event.target.value;
                setForm((current) => ({ ...current, location: value }));
                if (fieldErrors.location) setFieldErrors((current) => ({ ...current, location: undefined }));
              }}
              className={resolveFieldClass(fieldErrors.location)}
            />
            {fieldErrors.location ? <span className="text-xs font-semibold text-red-600">{fieldErrors.location}</span> : null}
          </label>
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            Delivery method
            <select
              value={form.deliveryMethod}
              onChange={(event) => {
                const value = event.target.value;
                setForm((current) => ({ ...current, deliveryMethod: value }));
                if (fieldErrors.deliveryMethod) setFieldErrors((current) => ({ ...current, deliveryMethod: undefined }));
              }}
              className={resolveFieldClass(fieldErrors.deliveryMethod)}
            >
              <option value="">Select delivery method</option>
              <option>Nairobi rider delivery</option>
              <option>Countrywide courier</option>
              <option>Shop pickup</option>
            </select>
            {fieldErrors.deliveryMethod ? <span className="text-xs font-semibold text-red-600">{fieldErrors.deliveryMethod}</span> : null}
          </label>
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            Payment preference
            <select
              value={form.paymentPreference}
              onChange={(event) => {
                const value = event.target.value;
                setForm((current) => ({ ...current, paymentPreference: value }));
                if (fieldErrors.paymentPreference) setFieldErrors((current) => ({ ...current, paymentPreference: undefined }));
              }}
              className={resolveFieldClass(fieldErrors.paymentPreference)}
            >
              <option value="">Select payment preference</option>
              <option>Pay on delivery Nairobi</option>
              <option>Pay transport fee first</option>
              <option>Deposit/full payment</option>
            </select>
            {fieldErrors.paymentPreference ? <span className="text-xs font-semibold text-red-600">{fieldErrors.paymentPreference}</span> : null}
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

        {fieldErrors.cart ? <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{fieldErrors.cart}</div> : null}
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
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Safe flag: <code>NEXT_PUBLIC_SHOP_USE_OPS_API=false</code> keeps checkout in mock fallback mode.
        </p>
      </aside>
    </div>
  );
}
