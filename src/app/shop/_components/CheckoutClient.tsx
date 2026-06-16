"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { MessageCircle } from "lucide-react";
import { buildDetailedCart, useShopCartItems } from "@/app/shop/cartStore";
import TrackedWhatsAppLink from "@/app/shop/_components/TrackedWhatsAppLink";
import { createShopOrder } from "@/app/shop/shopSubmitApi";
import { trackCheckoutStarted, trackOrderSubmitted } from "@/app/shop/shopAnalytics";
import type { ShopProduct } from "@/app/shop/shopData";
import { formatCurrency, shopStyles } from "@/app/shop/_components/shopStyles";
import {
  buildStoredOrderItems,
  clearCartAfterOrder,
  getShopCustomerProfile,
  saveMockOrder,
  saveShopCustomerProfile,
} from "@/app/shop/shopStorage";
import { getTownsForCounty, kenyaCountyOptions } from "@/lib/agents/kenyaMarkets";
import { getProductAvailabilityMessage } from "@/app/shop/shopAvailability";
import { getShopOrderSuccessHref, SHOP_CART_HREF, SHOP_HOME_HREF, SHOP_REQUEST_QUOTE_HREF } from "@/app/shop/storefrontPaths";

type CheckoutClientProps = {
  products: ShopProduct[];
  isSignedIn: boolean;
  initialProfile: {
    fullName: string;
    phoneNumber: string;
    whatsappNumber: string;
    email: string;
    county: string;
    town: string;
    estateLandmark: string;
    locationNotes: string;
  };
};

type CheckoutFieldErrors = {
  fullName?: string;
  phoneNumber?: string;
  whatsappNumber?: string;
  county?: string;
  town?: string;
  deliveryMethod?: string;
  paymentPreference?: string;
  cart?: string;
};

const inputBaseClass = "min-h-[3rem] rounded-[16px] border bg-white px-4 outline-none transition";

export default function CheckoutClient({ products, isSignedIn, initialProfile }: CheckoutClientProps) {
  const router = useRouter();
  const items = useShopCartItems();
  const detailedItems = useMemo(() => buildDetailedCart(items, products), [items, products]);
  const subtotal = detailedItems.reduce((sum, item) => sum + item.lineTotal, 0);
  const hasWarehouseItems = detailedItems.some((item) => item.product.availabilityType === "WAREHOUSE");
  const availabilityNotice = hasWarehouseItems
    ? "Some items in your order are available from warehouse. Pickup or delivery will be available after 1 day."
    : "All items are available for immediate shop pickup.";
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<CheckoutFieldErrors>({});
  const [hydrated, setHydrated] = useState(false);
  const [form, setForm] = useState({
    fullName: initialProfile.fullName,
    phoneNumber: initialProfile.phoneNumber,
    whatsappNumber: initialProfile.whatsappNumber,
    email: initialProfile.email,
    deliveryMethod: "",
    paymentPreference: "",
    county: initialProfile.county,
    town: initialProfile.town,
    estateLandmark: initialProfile.estateLandmark,
    locationNotes: initialProfile.locationNotes,
  });
  const availableTowns = useMemo(() => getTownsForCounty(form.county), [form.county]);

  useEffect(() => {
    setHydrated(true);
    const profile = getShopCustomerProfile();
    const [storedCounty = "", storedTown = ""] = String(profile?.countyTown || "")
      .split("/")
      .map((value) => value.trim())
      .filter(Boolean);
    setForm((current) => ({
      ...current,
      fullName: initialProfile.fullName || profile?.fullName || current.fullName,
      phoneNumber: initialProfile.phoneNumber || profile?.phone || current.phoneNumber,
      whatsappNumber: initialProfile.whatsappNumber || profile?.whatsappNumber || profile?.phone || current.whatsappNumber,
      email: initialProfile.email || profile?.email || current.email,
      county: initialProfile.county || storedCounty || current.county,
      town: initialProfile.town || storedTown || current.town,
      estateLandmark: initialProfile.estateLandmark || profile?.estateLandmark || current.estateLandmark,
      locationNotes: initialProfile.locationNotes || profile?.locationNotes || current.locationNotes,
    }));
  }, [initialProfile]);

  useEffect(() => {
    if (!detailedItems.length) return;
    trackCheckoutStarted({
      itemCount: detailedItems.length,
      subtotal,
    });
  }, [detailedItems.length, subtotal]);

  function resolveFieldClass(fieldError?: string) {
    return `${inputBaseClass} ${fieldError ? "border-red-300 ring-2 ring-red-100" : "border-[#7a0000]/10 focus:border-[#7a0000]/30"}`;
  }

  function validateForm() {
    const nextErrors: CheckoutFieldErrors = {};
    if (!form.fullName.trim()) nextErrors.fullName = "Please enter the customer name for this Betech Solar order.";
    if (!form.phoneNumber.trim()) nextErrors.phoneNumber = "Please enter a phone number so our solar team can confirm the order.";
    if (!form.whatsappNumber.trim()) nextErrors.whatsappNumber = "Please enter a WhatsApp number for fast order follow-up.";
    if (!form.county.trim()) nextErrors.county = "Please select the customer county.";
    if (!form.town.trim()) nextErrors.town = "Please select the customer town.";
    if (!form.deliveryMethod.trim()) nextErrors.deliveryMethod = "Please choose how you want Betech Solar to deliver or prepare pickup.";
    if (!form.paymentPreference.trim()) nextErrors.paymentPreference = "Please choose your preferred payment arrangement.";
    if (!detailedItems.length) nextErrors.cart = "Your cart is empty. Add products before submitting this order.";
    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  if (!hydrated) {
    return (
      <div className="rounded-[20px] border border-[#7a0000]/10 bg-white p-5 shadow-[0_14px_32px_rgba(15,23,42,0.05)]">
        <div className={shopStyles.sectionEyebrow}>Checkout</div>
        <div className="mt-3 text-sm text-slate-600">Loading your Betech Solar checkout...</div>
      </div>
    );
  }

  if (!detailedItems.length) {
    return (
      <div className="rounded-[20px] border border-[#7a0000]/10 bg-[linear-gradient(180deg,#fffaf2_0%,#ffffff_100%)] p-5 shadow-[0_14px_32px_rgba(15,23,42,0.06)] sm:p-6">
        <div className={shopStyles.sectionEyebrow}>Cart required</div>
        <h1 className="mt-3 text-2xl font-black tracking-tight text-slate-950">Your checkout is ready when your cart is ready.</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Add solar products to continue with checkout, or request a quote if you need help choosing the right system.
        </p>
        <div className="mt-4 flex flex-col gap-2.5 sm:flex-row">
          <Link href={SHOP_HOME_HREF} className={shopStyles.primaryButton}>
            Continue Shopping
          </Link>
          <Link href={SHOP_REQUEST_QUOTE_HREF} className={shopStyles.secondaryButton}>
            Request Quote
          </Link>
        </div>
      </div>
    );
  }

  const summaryWhatsappHref = `https://wa.me/254722151083?text=${encodeURIComponent(
    `Hello Betech Solar, I want to complete checkout for ${detailedItems.map((item) => `${item.product.name} x${item.quantity}`).join(", ")}.`,
  )}`;

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_340px]">
      <form
        id="shop-checkout-form"
        className="rounded-[20px] border border-[#7a0000]/10 bg-white p-4 shadow-[0_14px_32px_rgba(15,23,42,0.05)] sm:p-5"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!validateForm()) return;
          setSubmitting(true);
          setError(null);

          try {
            const countyTownLabel = [form.county.trim(), form.town.trim()].filter(Boolean).join(" / ");
            const locationSummary = [form.town.trim(), form.county.trim(), form.estateLandmark.trim()].filter(Boolean).join(" - ");
            if (isSignedIn) {
              await fetch("/api/account/complete-profile", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  name: form.fullName.trim(),
                  phone: form.phoneNumber.trim(),
                  whatsappNumber: form.whatsappNumber.trim(),
                  email: form.email.trim(),
                  county: form.county.trim(),
                  town: form.town.trim(),
                  estateLandmark: form.estateLandmark.trim(),
                  locationNotes: form.locationNotes.trim(),
                }),
              }).catch(() => null);
            }

            const orderResponse = await createShopOrder({
              items: detailedItems.map((item) => ({
                productId: item.product.id,
                quantity: item.quantity,
              })),
              customerName: form.fullName,
              customerPhone: form.phoneNumber,
              customerEmail: form.email.trim() || undefined,
              customerLocation: locationSummary || countyTownLabel,
              deliveryMethod: form.deliveryMethod,
              paymentMethod: form.paymentPreference,
              notes: [form.locationNotes.trim(), `WhatsApp: ${form.whatsappNumber.trim()}`, form.email.trim() ? `Email: ${form.email.trim()}` : ""]
                .filter(Boolean)
                .join(" | "),
            });

            saveShopCustomerProfile({
              fullName: form.fullName.trim(),
              phone: form.phoneNumber.trim(),
              whatsappNumber: form.whatsappNumber.trim(),
              email: form.email.trim() || undefined,
              countyTown: countyTownLabel,
              estateLandmark: form.estateLandmark.trim() || undefined,
              locationNotes: form.locationNotes.trim() || undefined,
            });

            const savedOrder = saveMockOrder({
              orderRef: orderResponse.orderRef,
              customerName: form.fullName.trim(),
              phone: form.phoneNumber.trim(),
              whatsappNumber: form.whatsappNumber.trim(),
              email: form.email.trim() || undefined,
              location: locationSummary || countyTownLabel,
              countyTown: countyTownLabel,
              estateLandmark: form.estateLandmark.trim() || undefined,
              locationNotes: form.locationNotes.trim() || undefined,
              deliveryMethod: form.deliveryMethod,
              paymentPreference: form.paymentPreference,
              notes: form.locationNotes.trim() || undefined,
              subtotal,
              source: "website",
              status: "PENDING",
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
            router.push(orderResponse.successUrl || getShopOrderSuccessHref(savedOrder.orderRef));
          } catch (submissionError) {
            setError(submissionError instanceof Error ? submissionError.message : "Unable to create the order request.");
          } finally {
            setSubmitting(false);
          }
        }}
      >
        <div className={shopStyles.sectionEyebrow}>Checkout</div>
        <h1 className="mt-3 text-[1.75rem] font-black tracking-tight text-slate-950 sm:text-[2rem]">Complete your Betech Solar checkout.</h1>
        <p className="mt-2 text-[13px] leading-5 text-slate-600 sm:text-[15px] sm:leading-6">
          Customer details, delivery preferences, and payment intent are collected here first. Payment is not processed automatically on this page, and a Betech Solar team member confirms the next steps with you directly.
        </p>
        <div className="mt-3 rounded-[16px] border border-amber-400/20 bg-amber-400/5 px-3 py-2.5 text-sm font-semibold leading-6 text-slate-700">
          {availabilityNotice}
        </div>

        <div className="mt-4 grid gap-4">
          <section className="rounded-[16px] border border-[#7a0000]/10 bg-[#fcfaf7] p-4">
            <div className="text-[11px] font-black uppercase tracking-[0.16em] text-[#7a0000]">Customer details</div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Full name
                <input value={form.fullName} onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))} className={resolveFieldClass(fieldErrors.fullName)} />
                {fieldErrors.fullName ? <span className="text-xs font-semibold text-red-600">{fieldErrors.fullName}</span> : null}
              </label>
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Phone number
                <input value={form.phoneNumber} onChange={(event) => setForm((current) => ({ ...current, phoneNumber: event.target.value }))} className={resolveFieldClass(fieldErrors.phoneNumber)} />
                {fieldErrors.phoneNumber ? <span className="text-xs font-semibold text-red-600">{fieldErrors.phoneNumber}</span> : null}
              </label>
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                WhatsApp number
                <input value={form.whatsappNumber} onChange={(event) => setForm((current) => ({ ...current, whatsappNumber: event.target.value }))} className={resolveFieldClass(fieldErrors.whatsappNumber)} />
                {fieldErrors.whatsappNumber ? <span className="text-xs font-semibold text-red-600">{fieldErrors.whatsappNumber}</span> : null}
              </label>
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Email address
                <input value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} className={resolveFieldClass()} />
              </label>
            </div>
          </section>

          <section className="rounded-[16px] border border-[#7a0000]/10 bg-[#fcfaf7] p-4">
            <div className="text-[11px] font-black uppercase tracking-[0.16em] text-[#7a0000]">Delivery and location</div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Delivery method
                <select value={form.deliveryMethod} onChange={(event) => setForm((current) => ({ ...current, deliveryMethod: event.target.value }))} className={resolveFieldClass(fieldErrors.deliveryMethod)}>
                  <option value="">Select delivery method</option>
                  <option>Nairobi rider delivery</option>
                  <option>Shop pickup</option>
                  <option>Countrywide courier</option>
                </select>
                {fieldErrors.deliveryMethod ? <span className="text-xs font-semibold text-red-600">{fieldErrors.deliveryMethod}</span> : null}
              </label>
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                County
                <select
                  value={form.county}
                  onChange={(event) => {
                    const nextCounty = event.target.value;
                    const nextTowns = getTownsForCounty(nextCounty);
                    setForm((current) => ({
                      ...current,
                      county: nextCounty,
                      town: nextTowns.some((town) => town === current.town) ? current.town : "",
                    }));
                  }}
                  className={resolveFieldClass(fieldErrors.county)}
                >
                  <option value="">Select county</option>
                  {kenyaCountyOptions.map((county) => (
                    <option key={county} value={county}>
                      {county}
                    </option>
                  ))}
                </select>
                {fieldErrors.county ? <span className="text-xs font-semibold text-red-600">{fieldErrors.county}</span> : null}
              </label>
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Town / city
                <select
                  value={form.town}
                  onChange={(event) => setForm((current) => ({ ...current, town: event.target.value }))}
                  disabled={!form.county}
                  className={resolveFieldClass(fieldErrors.town)}
                >
                  <option value="">{form.county ? "Select town / city" : "Choose county first"}</option>
                  {availableTowns.map((town) => (
                    <option key={town} value={town}>
                      {town}
                    </option>
                  ))}
                </select>
                {fieldErrors.town ? <span className="text-xs font-semibold text-red-600">{fieldErrors.town}</span> : null}
              </label>
              <label className="grid gap-2 text-sm font-semibold text-slate-700 sm:col-span-2">
                Specific locality / estate / landmark
                <input value={form.estateLandmark} onChange={(event) => setForm((current) => ({ ...current, estateLandmark: event.target.value }))} className={resolveFieldClass()} />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-slate-700 sm:col-span-2">
                Delivery notes
                <textarea rows={3} value={form.locationNotes} onChange={(event) => setForm((current) => ({ ...current, locationNotes: event.target.value }))} className="rounded-[16px] border border-[#7a0000]/10 bg-white px-4 py-3 outline-none" />
              </label>
            </div>
          </section>

          <section className="rounded-[16px] border border-[#7a0000]/10 bg-[#fcfaf7] p-4">
            <div className="text-[11px] font-black uppercase tracking-[0.16em] text-[#7a0000]">Payment preference</div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-semibold text-slate-700 sm:col-span-2">
                Choose payment arrangement
                <select value={form.paymentPreference} onChange={(event) => setForm((current) => ({ ...current, paymentPreference: event.target.value }))} className={resolveFieldClass(fieldErrors.paymentPreference)}>
                  <option value="">Select payment preference</option>
                  <option>Pay on delivery where available</option>
                  <option>Pay transport fee first</option>
                  <option>Pay deposit</option>
                  <option>Pay full amount</option>
                </select>
                {fieldErrors.paymentPreference ? <span className="text-xs font-semibold text-red-600">{fieldErrors.paymentPreference}</span> : null}
              </label>
            </div>
            <div className="mt-5 grid gap-2.5 xl:hidden">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex min-h-[2.9rem] items-center justify-center gap-2 rounded-[14px] bg-[#7a0000] px-4 py-2.5 text-sm font-bold text-white shadow-[0_12px_28px_rgba(122,0,0,0.16)] transition hover:bg-[#610000]"
              >
                {submitting ? "Submitting Website Order..." : "Place Order"}
              </button>
              <TrackedWhatsAppLink
                href={summaryWhatsappHref}
                className="inline-flex min-h-[2.9rem] items-center justify-center gap-2 rounded-[14px] bg-[linear-gradient(135deg,#11b86a_0%,#0f9d58_55%,#0b7c44_100%)] px-4 py-2.5 text-sm font-bold text-white shadow-[0_12px_28px_rgba(15,157,88,0.22)] transition"
                label="Checkout WhatsApp follow-up"
                context="checkout_summary"
                ariaLabel="Order via WhatsApp"
              >
                <MessageCircle className="h-4 w-4" />
                Order via WhatsApp
              </TrackedWhatsAppLink>
              <Link href={SHOP_CART_HREF} className="inline-flex min-h-[2.9rem] items-center justify-center gap-2 rounded-[14px] border border-[#7a0000]/16 bg-white px-4 py-2.5 text-sm font-bold text-slate-950 shadow-[0_10px_22px_rgba(15,23,42,0.04)] transition">
                Back to Cart
              </Link>
            </div>
          </section>
        </div>

        {fieldErrors.cart ? <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{fieldErrors.cart}</div> : null}
        {error ? <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

        <div className="mt-5 hidden flex-col gap-2.5 xl:flex xl:flex-row">
          <button type="submit" disabled={submitting} className="inline-flex min-h-[2.9rem] items-center justify-center gap-2 rounded-[14px] bg-[#7a0000] px-4 py-2.5 text-sm font-bold text-white shadow-[0_12px_28px_rgba(122,0,0,0.16)] transition hover:bg-[#610000]">
            {submitting ? "Submitting Website Order..." : "Place Order Request"}
          </button>
          <Link href={SHOP_CART_HREF} className="inline-flex min-h-[2.9rem] items-center justify-center gap-2 rounded-[14px] border border-[#7a0000]/16 bg-white px-4 py-2.5 text-sm font-bold text-slate-950 shadow-[0_10px_22px_rgba(15,23,42,0.04)] transition">
            Back to Cart
          </Link>
        </div>
      </form>

      <aside className="order-first h-fit self-start rounded-[20px] border border-[#7a0000]/10 bg-[linear-gradient(180deg,#fffaf2_0%,#ffffff_100%)] p-4 shadow-[0_14px_32px_rgba(15,23,42,0.06)] xl:order-none xl:sticky xl:top-24">
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
        <div className="mt-4 grid gap-2 text-sm text-slate-600">
          <div className="flex items-center justify-between">
            <span>Subtotal</span>
            <span className="font-semibold text-slate-950">{formatCurrency(subtotal)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Delivery</span>
            <span>Confirmed by team</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Estimated total</span>
            <span className="text-lg font-black text-slate-950">{formatCurrency(subtotal)}</span>
          </div>
        </div>
        <div className="mt-3 rounded-[16px] border border-amber-400/20 bg-amber-400/5 px-3 py-2.5 text-sm font-semibold leading-6 text-slate-700">
          {availabilityNotice}
        </div>
        <div className="mt-4 hidden gap-2.5 xl:grid">
          <button
            type="submit"
            form="shop-checkout-form"
            disabled={submitting}
            className="inline-flex min-h-[2.9rem] items-center justify-center gap-2 rounded-[14px] bg-[#7a0000] px-4 py-2.5 text-sm font-bold text-white shadow-[0_12px_28px_rgba(122,0,0,0.16)]"
          >
            Place Order Request
          </button>
          <TrackedWhatsAppLink
            href={summaryWhatsappHref}
            className="inline-flex min-h-[2.9rem] items-center justify-center gap-2 rounded-[14px] bg-[linear-gradient(135deg,#11b86a_0%,#0f9d58_55%,#0b7c44_100%)] px-4 py-2.5 text-sm font-bold text-white shadow-[0_12px_28px_rgba(15,157,88,0.22)] transition"
            label="Checkout WhatsApp follow-up"
            context="checkout_summary"
            ariaLabel="Checkout on WhatsApp"
          >
            <MessageCircle className="h-4 w-4" />
            WhatsApp Checkout
          </TrackedWhatsAppLink>
        </div>
      </aside>
    </div>
  );
}
