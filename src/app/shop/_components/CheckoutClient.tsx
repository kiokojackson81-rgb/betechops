"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { MessageCircle } from "lucide-react";
import { buildDetailedCart, useShopCart } from "@/app/shop/cartStore";
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
import {
  getDeliveryZone,
  isKnownTownForCounty,
  isUnlistedTownSelection,
  kenyaCountyOptions,
  resolveCheckoutTown,
  searchCheckoutTowns,
  UNLISTED_TOWN_OPTION,
} from "@/lib/agents/kenyaMarkets";
import { getProductAvailabilityMessage } from "@/app/shop/shopAvailability";
import { getShopOrderSuccessHref, SHOP_CART_HREF, SHOP_HOME_HREF, SHOP_REQUEST_QUOTE_HREF } from "@/app/shop/storefrontPaths";
import {
  calculateCheckoutPaymentPlan,
  getCheckoutDeliveryMethodLabel,
  getEligibleCheckoutPaymentOptions,
  getEligibleDeliveryMethods,
  normalizeCheckoutDeliveryMethod,
  summarizeCheckoutFulfilment,
  type CheckoutPaymentOption,
} from "@/lib/checkoutDeliveryPayment";

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
  manualTown?: string;
  deliveryMethod?: string;
  paymentPreference?: string;
  cart?: string;
};

type InstallationPricing = {
  productId: string;
  quantity: number;
  bookingType?: "INSTALLATION";
  installation: { status: string; amount: number | null } | null;
  transport: { status: string; amount: number | null } | null;
  accessories: { status: string; amount: number | null; minimum?: number; maximum?: number } | null;
};

const inputBaseClass = "min-h-[3rem] rounded-[16px] border bg-white px-4 outline-none transition";

function getCheckoutAvailabilityCopy(product: ShopProduct) {
  if (product.availabilityType === "WAREHOUSE") {
    return "Available from warehouse - pickup or dispatch within 1 business day.";
  }
  return getProductAvailabilityMessage(product);
}

export default function CheckoutClient({ products, isSignedIn, initialProfile }: CheckoutClientProps) {
  const router = useRouter();
  const { items, hydrated: cartHydrated } = useShopCart();
  const detailedItems = useMemo(() => buildDetailedCart(items, products), [items, products]);
  const subtotal = detailedItems.reduce((sum, item) => sum + item.lineTotal, 0);
  const installationItems = useMemo(() => detailedItems.filter((item) => item.bookingType === "INSTALLATION"), [detailedItems]);
  const priceableItems = useMemo(() => detailedItems.filter((item) => item.product.opsProductId), [detailedItems]);
  const hasInstallationBooking = installationItems.length > 0;
  const hasWarehouseItems = detailedItems.some((item) => item.product.availabilityType === "WAREHOUSE");
  const warehouseAvailabilityNotice = hasWarehouseItems
    ? "Warehouse items are available for pickup or dispatch within 1 business day."
    : null;
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<CheckoutFieldErrors>({});
  const [installationPricing, setInstallationPricing] = useState<InstallationPricing[]>([]);
  const [pricingLoading, setPricingLoading] = useState(false);
  const [form, setForm] = useState({
    fullName: initialProfile.fullName,
    phoneNumber: initialProfile.phoneNumber,
    whatsappNumber: initialProfile.whatsappNumber,
    email: initialProfile.email,
    deliveryMethod: "",
    paymentPreference: "",
    county: initialProfile.county,
    town: initialProfile.town,
    manualTown: "",
    nearestMajorTown: "",
    estateLandmark: initialProfile.estateLandmark,
    locationNotes: initialProfile.locationNotes,
  });
  const [townSearch, setTownSearch] = useState("");
  const isManualTown = isUnlistedTownSelection(form.town);
  const resolvedTown = useMemo(
    () => resolveCheckoutTown(form.county, form.town, form.manualTown),
    [form.county, form.manualTown, form.town],
  );
  const availableTowns = useMemo(() => searchCheckoutTowns(form.county, townSearch), [form.county, townSearch]);
  const deliveryZone = resolvedTown?.zone ?? (isManualTown ? getDeliveryZone(form.county, UNLISTED_TOWN_OPTION) : getDeliveryZone(form.county, form.town));
  const effectiveTown = resolvedTown?.town ?? (isManualTown ? form.manualTown.trim() : form.town.trim());
  const selectedDeliveryMethod = normalizeCheckoutDeliveryMethod(form.deliveryMethod);
  const isShopPickup = selectedDeliveryMethod === "SHOP_PICKUP";
  const installationPricingItems = installationPricing.filter((item) => item.bookingType === "INSTALLATION");
  const installationFee = installationPricingItems.reduce((sum, item) => sum + (item.installation?.amount ?? 0) * item.quantity, 0);
  const accessoriesFee = installationPricingItems.reduce((sum, item) => sum + (item.accessories?.amount ?? 0) * item.quantity, 0);
  const calculatedTransportFee = installationPricing.reduce((highest, item) => Math.max(highest, item.transport?.amount ?? 0), 0);
  const transportFee = isShopPickup ? 0 : calculatedTransportFee;
  const hasConfiguredDeliveryFee = !isShopPickup && Boolean(deliveryZone) && installationPricing.some((item) => item.transport?.amount != null);
  const accessoriesPendingAssessment = installationPricingItems.some((item) => item.accessories?.status === "ASSESSMENT");
  const installationPendingAssessment = installationPricingItems.some((item) => item.installation?.status === "ASSESSMENT");
  const projectTotal = subtotal + installationFee + accessoriesFee + transportFee;
  const orderDeliveryFee = isShopPickup ? 0 : hasConfiguredDeliveryFee ? transportFee : 0;
  const fulfilment = useMemo(() => summarizeCheckoutFulfilment(detailedItems.map((item) => ({
    quantity: item.quantity,
    unitPrice: item.product.price,
    availabilityType: item.product.availabilityType,
    warehouseFulfillmentSource: item.product.warehouseFulfillmentSource,
  }))), [detailedItems]);
  const eligibleDeliveryMethods = useMemo(() => getEligibleDeliveryMethods(deliveryZone?.id), [deliveryZone?.id]);
  const eligiblePaymentOptions = useMemo(() => getEligibleCheckoutPaymentOptions({
    zone: deliveryZone?.id,
    deliveryMethod: selectedDeliveryMethod,
    fulfilment,
    deliveryFee: orderDeliveryFee,
    // Courier COD is deliberately unavailable until it is configured for a carrier.
    supportsCourierPayOnDelivery: false,
  }), [deliveryZone?.id, fulfilment, orderDeliveryFee, selectedDeliveryMethod]);
  const selectedPaymentOption = eligiblePaymentOptions.includes(form.paymentPreference as CheckoutPaymentOption)
    ? form.paymentPreference as CheckoutPaymentOption
    : null;
  const paymentPlan = selectedPaymentOption ? calculateCheckoutPaymentPlan({
    option: selectedPaymentOption,
    productSubtotal: subtotal,
    deliveryFee: orderDeliveryFee,
    fulfilment,
  }) : null;
  const estimatedTotal = hasInstallationBooking ? projectTotal : subtotal + orderDeliveryFee;
  const depositAmount = Math.round(projectTotal * 0.3);
  const paymentDueNow = form.paymentPreference.startsWith("30%") ? depositAmount : projectTotal;

  useEffect(() => {
    const profile = getShopCustomerProfile();
    const [storedCounty = "", storedTown = ""] = String(profile?.countyTown || "")
      .split("/")
      .map((value) => value.trim())
      .filter(Boolean);
    setForm((current) => {
      const county = initialProfile.county || storedCounty || current.county;
      const storedTownValue = initialProfile.town || storedTown || current.town;
      // Earlier profiles store only the actual town. Treat a value outside the
      // expanded list as a manual area so it remains usable at checkout.
      const storedTownIsKnown = isKnownTownForCounty(county, storedTownValue);
      return {
        ...current,
        fullName: initialProfile.fullName || profile?.fullName || current.fullName,
        phoneNumber: initialProfile.phoneNumber || profile?.phone || current.phoneNumber,
        whatsappNumber: initialProfile.whatsappNumber || profile?.whatsappNumber || profile?.phone || current.whatsappNumber,
        email: initialProfile.email || profile?.email || current.email,
        county,
        town: storedTownValue && !storedTownIsKnown ? UNLISTED_TOWN_OPTION : storedTownValue,
        manualTown: storedTownValue && !storedTownIsKnown ? storedTownValue : current.manualTown,
        estateLandmark: initialProfile.estateLandmark || profile?.estateLandmark || current.estateLandmark,
        locationNotes: initialProfile.locationNotes || profile?.locationNotes || current.locationNotes,
      };
    });
  }, [initialProfile]);

  useEffect(() => {
    if (!deliveryZone || !priceableItems.length) {
      setInstallationPricing([]);
      return;
    }
    const controller = new AbortController();
    setPricingLoading(true);
    Promise.all(priceableItems.map(async (item) => {
      const productId = item.product.opsProductId;
      if (!productId) throw new Error(`${item.product.name} is missing its catalogue pricing link.`);
      const response = await fetch(`/api/shop/products/${encodeURIComponent(productId)}/pricing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zone: deliveryZone.id, includeInstallation: item.bookingType === "INSTALLATION" }),
        signal: controller.signal,
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(String(payload?.error || `Unable to price ${item.product.name}.`));
      return { productId: item.product.id, quantity: item.quantity, bookingType: item.bookingType, ...payload } as InstallationPricing;
    }))
      .then(setInstallationPricing)
      .catch((pricingError) => {
        if (pricingError instanceof DOMException && pricingError.name === "AbortError") return;
        setError(pricingError instanceof Error ? pricingError.message : "Unable to calculate installation pricing.");
      })
      .finally(() => setPricingLoading(false));
    return () => controller.abort();
  }, [deliveryZone, priceableItems]);

  useEffect(() => {
    setForm((current) => {
      const deliveryMethod = normalizeCheckoutDeliveryMethod(current.deliveryMethod);
      if (deliveryMethod && eligibleDeliveryMethods.includes(deliveryMethod)) return current;
      if (!current.deliveryMethod && !current.paymentPreference) return current;
      return { ...current, deliveryMethod: "", paymentPreference: "" };
    });
  }, [eligibleDeliveryMethods]);

  useEffect(() => {
    setForm((current) => (
      eligiblePaymentOptions.includes(current.paymentPreference as CheckoutPaymentOption)
        ? current
        : current.paymentPreference
          ? { ...current, paymentPreference: "" }
          : current
    ));
  }, [eligiblePaymentOptions]);

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
    if (!form.town.trim()) nextErrors.town = "Please select the customer town or area.";
    if (isManualTown && !form.manualTown.trim()) nextErrors.manualTown = "Enter your town or area so we can confirm delivery.";
    if (form.town.trim() && !resolvedTown) nextErrors.town = "Choose a valid town or enter your unlisted area.";
    if (!resolvedTown) nextErrors.town = "Select a valid town or enter your area before choosing delivery.";
    if (!selectedDeliveryMethod) nextErrors.deliveryMethod = "Choose an available delivery method for your area.";
    if (selectedDeliveryMethod && !eligibleDeliveryMethods.includes(selectedDeliveryMethod)) nextErrors.deliveryMethod = "Choose one of the delivery methods available for your area.";
    if (pricingLoading) nextErrors.deliveryMethod = "Please wait while your delivery fee is calculated.";
    if (fulfilment.unavailableSubtotal > 0) nextErrors.cart = "Your cart includes an unavailable item. Please update the cart before checkout.";
    if (!selectedPaymentOption) nextErrors.paymentPreference = "Choose an eligible payment option for this order.";
    if (!detailedItems.length) nextErrors.cart = "Your cart is empty. Add products before submitting this order.";
    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  if (!cartHydrated) {
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

  const whatsappCheckoutMessage = [
    `Hello Betech Solar, I want to complete checkout for ${detailedItems.map((item) => `${item.product.name} x${item.quantity}`).join(", ")}.`,
    form.fullName.trim() ? `Customer: ${form.fullName.trim()}.` : "",
    effectiveTown || form.county.trim()
      ? `Delivery location: ${[effectiveTown, form.county.trim()].filter(Boolean).join(", ")}.`
      : "",
  ].filter(Boolean).join(" ");
  const summaryWhatsappHref = `https://wa.me/254722151083?text=${encodeURIComponent(whatsappCheckoutMessage)}`;

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
            const countyTownLabel = [form.county.trim(), effectiveTown].filter(Boolean).join(" / ");
            const locationSummary = [effectiveTown, form.county.trim(), form.estateLandmark.trim()].filter(Boolean).join(" - ");
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
                  town: effectiveTown,
                  estateLandmark: form.estateLandmark.trim(),
                  locationNotes: form.locationNotes.trim(),
                }),
              }).catch(() => null);
            }

            const orderResponse = await createShopOrder({
              items: detailedItems.map((item) => ({
                productId: item.product.id,
                quantity: item.quantity,
                bookingType: item.bookingType,
              })),
              customerName: form.fullName,
              customerPhone: form.phoneNumber,
              customerEmail: form.email.trim() || undefined,
              customerLocation: locationSummary || countyTownLabel,
              deliveryMethod: form.deliveryMethod,
              deliveryZone: deliveryZone?.id,
              deliveryCounty: form.county.trim(),
              deliveryTown: effectiveTown,
              townSource: resolvedTown?.townSource,
              nearestMajorTown: isManualTown ? form.nearestMajorTown.trim() || undefined : undefined,
              paymentMethod: paymentPlan?.label || form.paymentPreference,
              paymentOption: selectedPaymentOption || undefined,
              notes: [form.locationNotes.trim(), `WhatsApp: ${form.whatsappNumber.trim()}`, form.email.trim() ? `Email: ${form.email.trim()}` : ""]
                .filter(Boolean)
                .join(" | "),
              projectBooking: hasInstallationBooking && deliveryZone ? {
                zone: deliveryZone.id,
                paymentStructure: selectedPaymentOption === "PAY_30_PERCENT_DEPOSIT" ? "DEPOSIT_30" : "FULL_UPFRONT",
              } : undefined,
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
              paymentPreference: paymentPlan?.label || form.paymentPreference,
              notes: form.locationNotes.trim() || undefined,
              subtotal: hasInstallationBooking ? projectTotal : subtotal,
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
            setError(submissionError instanceof Error ? submissionError.message : "Unable to place your order.");
          } finally {
            setSubmitting(false);
          }
        }}
      >
        {warehouseAvailabilityNotice ? <div className="rounded-[16px] border border-amber-400/20 bg-amber-400/5 px-3 py-2.5 text-sm font-semibold leading-6 text-slate-700">
          {warehouseAvailabilityNotice}
        </div> : null}

        <div className={`${warehouseAvailabilityNotice ? "mt-4" : ""} grid gap-4`}>
          <section className="rounded-[16px] border border-[#7a0000]/10 bg-[#fcfaf7] p-4">
            <h2 className="text-[11px] font-black uppercase tracking-[0.16em] text-[#7a0000]">Customer Details</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Full Name
                <input value={form.fullName} onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))} className={resolveFieldClass(fieldErrors.fullName)} />
                {fieldErrors.fullName ? <span className="text-xs font-semibold text-red-600">{fieldErrors.fullName}</span> : null}
              </label>
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Phone Number
                <input value={form.phoneNumber} onChange={(event) => setForm((current) => ({ ...current, phoneNumber: event.target.value }))} className={resolveFieldClass(fieldErrors.phoneNumber)} />
                {fieldErrors.phoneNumber ? <span className="text-xs font-semibold text-red-600">{fieldErrors.phoneNumber}</span> : null}
              </label>
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                WhatsApp Number
                <input value={form.whatsappNumber} onChange={(event) => setForm((current) => ({ ...current, whatsappNumber: event.target.value }))} className={resolveFieldClass(fieldErrors.whatsappNumber)} />
                {fieldErrors.whatsappNumber ? <span className="text-xs font-semibold text-red-600">{fieldErrors.whatsappNumber}</span> : null}
              </label>
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Email Address
                <input value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} className={resolveFieldClass()} />
              </label>
            </div>
          </section>

          <section className="rounded-[16px] border border-[#7a0000]/10 bg-[#fcfaf7] p-4">
            <h2 className="text-[11px] font-black uppercase tracking-[0.16em] text-[#7a0000]">Delivery Details</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                County
                <select
                  value={form.county}
                  onChange={(event) => {
                    const nextCounty = event.target.value;
                    setTownSearch("");
                    setForm((current) => ({
                      ...current,
                      county: nextCounty,
                      town: "",
                      manualTown: "",
                      nearestMajorTown: "",
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
                Search town / area
                <input
                  value={townSearch}
                  onChange={(event) => setTownSearch(event.target.value)}
                  disabled={!form.county}
                  placeholder={form.county ? "Type to filter towns and areas" : "Choose county first"}
                  className={resolveFieldClass()}
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Town / City / Area
                <select
                  value={form.town}
                  onChange={(event) => {
                    const nextTown = event.target.value;
                    setTownSearch("");
                    setForm((current) => ({
                      ...current,
                      town: nextTown,
                      manualTown: isUnlistedTownSelection(nextTown) ? current.manualTown : "",
                      nearestMajorTown: isUnlistedTownSelection(nextTown) ? current.nearestMajorTown : "",
                    }));
                  }}
                  disabled={!form.county}
                  className={resolveFieldClass(fieldErrors.town)}
                >
                  <option value="">{form.county ? "Select town, city or area" : "Choose county first"}</option>
                  {availableTowns.map((town) => (
                    <option key={town} value={town}>
                      {town}
                    </option>
                  ))}
                </select>
                {fieldErrors.town ? <span className="text-xs font-semibold text-red-600">{fieldErrors.town}</span> : null}
              </label>
              {isManualTown ? <>
                <label className="grid gap-2 text-sm font-semibold text-slate-700 sm:col-span-2">
                  Enter your town / area
                  <input value={form.manualTown} onChange={(event) => setForm((current) => ({ ...current, manualTown: event.target.value }))} className={resolveFieldClass(fieldErrors.manualTown)} />
                  {fieldErrors.manualTown ? <span className="text-xs font-semibold text-red-600">{fieldErrors.manualTown}</span> : null}
                </label>
                <label className="grid gap-2 text-sm font-semibold text-slate-700 sm:col-span-2">
                  Nearest major town <span className="font-normal text-slate-500">(optional)</span>
                  <input value={form.nearestMajorTown} onChange={(event) => setForm((current) => ({ ...current, nearestMajorTown: event.target.value }))} className={resolveFieldClass()} />
                </label>
                <div className="rounded-[16px] border border-amber-300/40 bg-amber-50 p-3 text-sm leading-6 text-slate-700 sm:col-span-2">We will confirm delivery availability and timing for your area. Your delivery fee still uses the selected county’s service zone.</div>
              </> : null}
              {resolvedTown && deliveryZone ? <>
                <div className="rounded-[16px] border border-amber-300/40 bg-amber-50 p-3 text-sm text-slate-700 sm:col-span-2">
                  <b className="text-[#7a0000]">Delivery Area</b>
                  <div className="mt-1 font-semibold">{effectiveTown}, {form.county} County</div>
                  <div className="mt-1">{deliveryZone.name}</div>
                </div>
                <label className="grid gap-2 text-sm font-semibold text-slate-700 sm:col-span-2">
                  Delivery Method
                  <select value={form.deliveryMethod} onChange={(event) => setForm((current) => ({ ...current, deliveryMethod: event.target.value, paymentPreference: "" }))} className={resolveFieldClass(fieldErrors.deliveryMethod)}>
                    <option value="">Select delivery method</option>
                    {eligibleDeliveryMethods.map((method) => <option key={method} value={method}>{getCheckoutDeliveryMethodLabel(method)}</option>)}
                  </select>
                  <span className="text-xs font-medium text-slate-500">{isShopPickup ? "Shop Pickup — Betech Solar Solutions, Pramukh Plaza, 3rd Floor, Shop 3, Munyu Road & Sheikh Karume Road, Nairobi CBD. No delivery fee." : pricingLoading ? "Calculating the configured delivery fee..." : hasConfiguredDeliveryFee ? `Configured delivery fee: ${formatCurrency(transportFee)}.` : "Select a delivery method to see the applicable delivery charge."}</span>
                  {fieldErrors.deliveryMethod ? <span className="text-xs font-semibold text-red-600">{fieldErrors.deliveryMethod}</span> : null}
                </label>
              </> : <div className="rounded-[16px] border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600 sm:col-span-2">Select your county and town / area first. We will then show only the delivery methods available for your location.</div>}
              <label className="grid gap-2 text-sm font-semibold text-slate-700 sm:col-span-2">
                Specific locality / estate / village / landmark
                <input value={form.estateLandmark} onChange={(event) => setForm((current) => ({ ...current, estateLandmark: event.target.value }))} className={resolveFieldClass()} />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-slate-700 sm:col-span-2">
                Delivery Notes
                <textarea rows={3} value={form.locationNotes} onChange={(event) => setForm((current) => ({ ...current, locationNotes: event.target.value }))} className="rounded-[16px] border border-[#7a0000]/10 bg-white px-4 py-3 outline-none" />
                <span className="text-xs font-medium text-slate-500">Optional instructions to help us locate or deliver your order.</span>
              </label>
            </div>
          </section>

          <section className="rounded-[16px] border border-[#7a0000]/10 bg-[#fcfaf7] p-4">
            <h2 className="text-[11px] font-black uppercase tracking-[0.16em] text-[#7a0000]">Payment Method</h2>
            {!resolvedTown || !selectedDeliveryMethod ? <div className="mt-3 rounded-[16px] border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-600">Choose a valid delivery area and delivery method first. We will then show only payment options available for this order.</div> : pricingLoading ? <div className="mt-3 rounded-[16px] border border-amber-300/40 bg-amber-50 p-3 text-sm text-slate-700">Calculating delivery and payment options...</div> : fulfilment.unavailableSubtotal > 0 ? <div className="mt-3 rounded-[16px] border border-red-200 bg-red-50 p-3 text-sm text-red-700">An item in this cart is unavailable. Update the cart before checkout.</div> : <>
              {fulfilment.commitmentEligibleSubtotal > 0 ? <div className="mt-3 rounded-[16px] border border-amber-300/40 bg-amber-50 p-3 text-sm leading-6 text-slate-700">Warehouse or order-on-request items total {formatCurrency(fulfilment.commitmentEligibleSubtotal)}. A 10% commitment payment is required before we reserve or transfer those items.</div> : null}
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {eligiblePaymentOptions.map((option) => {
                  const plan = calculateCheckoutPaymentPlan({ option, productSubtotal: subtotal, deliveryFee: orderDeliveryFee, fulfilment });
                  const selected = selectedPaymentOption === option;
                  return <button key={option} type="button" onClick={() => setForm((current) => ({ ...current, paymentPreference: option }))} className={`rounded-[16px] border p-3 text-left transition ${selected ? "border-[#7a0000] bg-[#fff6ed] ring-2 ring-[#7a0000]/10" : "border-[#7a0000]/10 bg-white hover:border-[#7a0000]/30"}`}>
                    <div className="font-bold text-slate-950">{plan.label}</div>
                    <div className="mt-1 text-xs leading-5 text-slate-600">{plan.description}</div>
                    <div className="mt-2 text-sm font-black text-[#7a0000]">Pay now: {formatCurrency(plan.amountDueNow)}</div>
                  </button>;
                })}
              </div>
              {fieldErrors.paymentPreference ? <span className="mt-2 block text-xs font-semibold text-red-600">{fieldErrors.paymentPreference}</span> : null}
              {paymentPlan ? <div className="mt-3 rounded-[16px] border border-emerald-300/40 bg-emerald-50 p-3 text-sm text-slate-700"><div className="text-[11px] font-black uppercase tracking-[0.14em] text-emerald-800">Payment Summary</div><div className="mt-2 grid gap-1"><div className="flex justify-between"><span>Products</span><b>{formatCurrency(subtotal)}</b></div><div className="flex justify-between"><span>Delivery / transport</span><b>{formatCurrency(orderDeliveryFee)}</b></div><div className="flex justify-between border-t border-emerald-900/10 pt-2 text-base"><span>Amount due now</span><b className="text-emerald-900">{formatCurrency(paymentPlan.amountDueNow)}</b></div><div className="flex justify-between"><span>Remaining product balance</span><b>{formatCurrency(paymentPlan.remainingProductBalance)}</b></div><div className="flex justify-between"><span>Remaining delivery balance</span><b>{formatCurrency(paymentPlan.remainingDeliveryBalance)}</b></div></div></div> : null}
            </>}
            <div className="mt-5 grid gap-2.5 xl:hidden">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex min-h-[2.9rem] items-center justify-center gap-2 rounded-[14px] bg-[#7a0000] px-4 py-2.5 text-sm font-bold text-white shadow-[0_12px_28px_rgba(122,0,0,0.16)] transition hover:bg-[#610000]"
              >
                {submitting ? "Placing Order..." : "Place Order"}
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
            {submitting ? "Placing Order..." : "Place Order"}
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
                <div className="mt-1 text-[11px] font-medium text-slate-500">{getCheckoutAvailabilityCopy(item.product)}</div>
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
            <span>{isShopPickup ? "KSh 0 — shop pickup" : pricingLoading ? "Calculating..." : resolvedTown && hasConfiguredDeliveryFee ? formatCurrency(orderDeliveryFee) : "Select delivery area and method"}</span>
          </div>
          {hasInstallationBooking ? <>
            <div className="flex items-center justify-between"><span>Installation</span><span>{installationPendingAssessment ? "Site assessment required" : formatCurrency(installationFee)}</span></div>
            <div className="flex items-center justify-between"><span>Accessories</span><span>{accessoriesPendingAssessment ? "Site assessment required" : `${formatCurrency(accessoriesFee)} estimate`}</span></div>
          </> : null}
          <div className="flex items-center justify-between">
            <span>Estimated Total</span>
            <span className="text-lg font-black text-slate-950">{pricingLoading ? "Calculating..." : isShopPickup || hasConfiguredDeliveryFee ? formatCurrency(estimatedTotal) : `${formatCurrency(subtotal)} + delivery, where applicable`}</span>
          </div>
          {paymentPlan ? <div className="mt-1 rounded-xl border border-[#7a0000]/10 bg-white p-3"><div className="flex items-center justify-between text-xs font-bold uppercase tracking-wide text-[#7a0000]"><span>{paymentPlan.label}</span><span>Pay now</span></div><div className="mt-1 flex items-center justify-between text-lg font-black text-slate-950"><span>{formatCurrency(paymentPlan.amountDueNow)}</span><span>Later: {formatCurrency(paymentPlan.totalOutstanding)}</span></div></div> : null}
          {hasInstallationBooking ? <div className="mt-1 rounded-xl border border-[#7a0000]/10 bg-white p-3">
            <div className="flex items-center justify-between font-bold text-[#7a0000]"><span>Amount due before scheduling</span><span>{formatCurrency(paymentDueNow)}</span></div>
            {selectedPaymentOption === "PAY_30_PERCENT_DEPOSIT" ? <div className="mt-1 flex items-center justify-between text-xs"><span>Balance after installation</span><span>{formatCurrency(projectTotal - depositAmount)}</span></div> : null}
            <div className="mt-2 border-t border-[#7a0000]/10 pt-2 text-xs leading-5 text-slate-600">Accessories are estimated and the final materials scope is agreed before installation.</div>
          </div> : null}
        </div>
        <div className="mt-4 hidden gap-2.5 xl:grid">
          <button
            type="submit"
            form="shop-checkout-form"
            disabled={submitting}
            className="inline-flex min-h-[2.9rem] items-center justify-center gap-2 rounded-[14px] bg-[#7a0000] px-4 py-2.5 text-sm font-bold text-white shadow-[0_12px_28px_rgba(122,0,0,0.16)]"
          >
            {submitting ? "Placing Order..." : "Place Order"}
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
