"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { buildDetailedCart, useShopCartItems } from "@/app/shop/cartStore";
import { createShopOrder } from "@/app/shop/shopApi";
import { trackCheckoutStarted, trackOrderSubmitted } from "@/app/shop/shopAnalytics";
import type { ShopProduct } from "@/app/shop/shopData";
import { formatCurrency, shopStyles } from "@/app/shop/_components/shopStyles";
import { buildStoredOrderItems, clearCartAfterOrder, saveMockOrder } from "@/app/shop/shopStorage";
import { getProductAvailabilityMessage } from "@/app/shop/shopAvailability";

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
  const hasWarehouseItems = detailedItems.some((item) => item.product.availabilityType === "WAREHOUSE");
  const availabilityNotice = hasWarehouseItems
    ? "Some items in your order are available from warehouse. Pickup or delivery will be available after 1 day."
    : "All items are available for immediate shop pickup.";
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

  useEffect(() => {
    if (!detailedItems.length) return;
    trackCheckoutStarted({
      itemCount: detailedItems.length,
      subtotal,
    });
  }, [detailedItems.length, subtotal]);

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
      <div className="rounded-[20px] border border-[#7a0000]/10 bg-[linear-gradient(180deg,#fffaf2_0%,#ffffff_100%)] p-5 shadow-[0_14px_32px_rgba(15,23,42,0.06)] sm:p-6">
          <div className={shopStyles.sectionEyebrow}>Cart required</div>
          <h1 className="mt-3 text-2xl font-black tracking-tight text-slate-950">Add products before starting checkout.</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            This checkout stays in preview mode for now and will create a safe pending ecommerce order later when ops integration starts.
          </p>
        <div className="mt-4">
          <Link href="/shop/cart" className={shopStyles.primaryButton}>
            Go to Cart
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_330px]">
      <form
        className="rounded-[20px] border border-[#7a0000]/10 bg-white p-4 shadow-[0_14px_32px_rgba(15,23,42,0.05)] sm:p-5"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!validateForm()) return;
          setSubmitting(true);
          setError(null);

          try {
            await createShopOrder({
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

            trackOrderSubmitted({
              orderRef: savedOrder.orderRef,
              itemCount: savedOrder.items.length,
              subtotal: savedOrder.subtotal,
              deliveryMethod: savedOrder.deliveryMethod,
              paymentPreference: savedOrder.paymentPreference,
            });
            clearCartAfterOrder();
            router.push(
              `/shop/order-success?ref=${encodeURIComponent(savedOrder.orderRef)}&mode=${encodeURIComponent("preview")}`,
            );
          } catch (submissionError) {
            setError(submissionError instanceof Error ? submissionError.message : "Unable to create the preview order request.");
          } finally {
            setSubmitting(false);
          }
        }}
      >
        <div className={shopStyles.sectionEyebrow}>Checkout</div>
        <h1 className="mt-3 text-2xl font-black tracking-tight text-slate-950 sm:text-[2rem]">Complete your Betech Solar preview checkout.</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600 sm:text-[15px]">
          This preview does not connect live backend logic yet. Submitting creates a safe test order request only and does not confirm payment automatically.
        </p>
        <div className="mt-3 rounded-[16px] border border-amber-400/20 bg-amber-400/5 px-3 py-2.5 text-sm font-semibold leading-6 text-slate-700">
          {availabilityNotice}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
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
              rows={4}
              value={form.notes}
              onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
              className="rounded-[16px] border border-[#7a0000]/10 bg-white px-4 py-3 outline-none"
            />
          </label>
        </div>

        {fieldErrors.cart ? <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{fieldErrors.cart}</div> : null}
        {error ? <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

        <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
          <button type="submit" disabled={submitting} className="inline-flex min-h-[2.9rem] items-center justify-center gap-2 rounded-[14px] bg-[#7a0000] px-4 py-2.5 text-sm font-bold text-white shadow-[0_12px_28px_rgba(122,0,0,0.16)] transition hover:bg-[#610000]">
            {submitting ? "Creating Mock Order..." : "Submit Mock Order"}
          </button>
          <Link href="/shop/cart" className="inline-flex min-h-[2.9rem] items-center justify-center gap-2 rounded-[14px] border border-[#7a0000]/16 bg-white px-4 py-2.5 text-sm font-bold text-slate-950 shadow-[0_10px_22px_rgba(15,23,42,0.04)] transition">
            Back to Cart
          </Link>
        </div>
      </form>

      <aside className="h-fit self-start rounded-[20px] border border-[#7a0000]/10 bg-[linear-gradient(180deg,#fffaf2_0%,#ffffff_100%)] p-4 shadow-[0_14px_32px_rgba(15,23,42,0.06)] xl:sticky xl:top-24">
        <div className={shopStyles.sectionEyebrow}>Order Summary</div>
        <div className="mt-4 grid gap-3">
          {detailedItems.map((item) => (
            <div key={item.product.id} className="flex items-start justify-between gap-3 border-b border-[#7a0000]/10 pb-3">
              <div>
                <div className="text-sm font-black text-slate-950">{item.product.name}</div>
                <div className="mt-1 text-xs text-slate-500">Qty {item.quantity}</div>
                <div className="mt-1 text-[11px] font-medium text-slate-500">{getProductAvailabilityMessage(item.product)}</div>
              </div>
              <div className="text-sm font-semibold text-slate-950">{formatCurrency(item.lineTotal)}</div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between text-lg font-black text-slate-950">
          <span>Estimated total</span>
          <span>{formatCurrency(subtotal)}</span>
        </div>
        <div className="mt-3 rounded-[16px] border border-amber-400/20 bg-amber-400/5 px-3 py-2.5 text-sm font-semibold leading-6 text-slate-700">
          {availabilityNotice}
        </div>
        <p className="mt-3 text-sm leading-6 text-slate-500">
          Preview mode only: a Betech Solar team member will still confirm availability, delivery planning, and payment steps manually.
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Safe flag: <code>NEXT_PUBLIC_SHOP_USE_OPS_API=false</code> keeps checkout in preview fallback mode.
        </p>
      </aside>
    </div>
  );
}
