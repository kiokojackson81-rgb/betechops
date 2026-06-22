"use client";

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, MessageCircle, Send, X } from "lucide-react";
import type { ShopProduct } from "@/app/shop/shopData";
import { formatCurrency } from "@/app/shop/_components/shopStyles";
import { getShopProductHref } from "@/app/shop/storefrontPaths";
import { getTownsForCounty, kenyaCountyOptions } from "@/lib/agents/kenyaMarkets";
import { normalizeKenyanPhone } from "@/lib/phone";
import { getShopBaseUrl } from "@/lib/runtimeUrls";

type AgentStorefrontProductActionsProps = {
  product: ShopProduct;
  loginHref: string;
  loggedIn: boolean;
  compact?: boolean;
};

type ModalMode = "order" | "refer" | null;
type PaymentOptionValue = "pay_on_delivery" | "full_payment" | "transport_fee" | "shop_pickup";
type ReferralChannel = "whatsapp" | "sms";

type AgentProfilePayload = {
  profile?: {
    referralCode?: string | null;
  } | null;
};

const paymentOptions: Array<{
  value: PaymentOptionValue;
  title: string;
  note: string;
}> = [
  {
    value: "pay_on_delivery",
    title: "Pay on delivery",
    note: "Best where Betech confirms rider delivery or collection first.",
  },
  {
    value: "transport_fee",
    title: "Pay transport fee first",
    note: "Customer pays transport first, then clears the balance on delivery.",
  },
  {
    value: "full_payment",
    title: "Pay full amount",
    note: "Customer clears the full order before dispatch.",
  },
  {
    value: "shop_pickup",
    title: "Shop pickup",
    note: "Customer collects from the Nairobi CBD shop.",
  },
];

const paymentTypeToApiValue: Record<PaymentOptionValue, "transport_fee" | "full_payment" | "deposit"> = {
  pay_on_delivery: "deposit",
  full_payment: "full_payment",
  transport_fee: "transport_fee",
  shop_pickup: "deposit",
};

const inputClassName =
  "w-full rounded-2xl border border-[#e6d7ce] bg-[#fffdfb] px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#7a0000]/35 focus:bg-white focus:ring-4 focus:ring-[#f2b20f]/10";

function buildPublicProductUrl(product: ShopProduct, referralCode: string | null) {
  const baseUrl = getShopBaseUrl();
  const url = new URL(getShopProductHref(product.slug, product.opsProductId), baseUrl);
  if (referralCode) {
    url.searchParams.set("ref", referralCode);
  }
  return url.toString();
}

export default function AgentStorefrontProductActions({
  product,
  loginHref,
  loggedIn,
  compact = false,
}: AgentStorefrontProductActionsProps) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [mode, setMode] = useState<ModalMode>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [portalReady, setPortalReady] = useState(false);
  const modalCardRef = useRef<HTMLDivElement | null>(null);
  const customerNameInputRef = useRef<HTMLInputElement | null>(null);
  const customerPhoneInputRef = useRef<HTMLInputElement | null>(null);
  const customerCountySelectRef = useRef<HTMLSelectElement | null>(null);
  const customerLocationSelectRef = useRef<HTMLSelectElement | null>(null);
  const referralPhoneInputRef = useRef<HTMLInputElement | null>(null);
  const [orderForm, setOrderForm] = useState({
    customerName: "",
    customerPhone: "",
    customerCounty: "",
    customerLocation: "",
    quantity: "1",
    paymentOption: "pay_on_delivery" as PaymentOptionValue,
  });
  const [referForm, setReferForm] = useState({
    customerPhone: "",
    customerName: "",
    channel: "whatsapp" as ReferralChannel,
  });

  const availableTowns = useMemo(
    () => getTownsForCounty(orderForm.customerCounty),
    [orderForm.customerCounty],
  );
  const quantity = Math.max(Number(orderForm.quantity || 1), 1);
  const totalAmount = Math.round(product.price * quantity * 100) / 100;
  const effectiveLoggedIn =
    loggedIn ||
    Boolean(
      (session?.user as
        | {
            isAgent?: boolean;
            agentStatus?: string | null;
          }
        | undefined)?.isAgent &&
        ((session?.user as { agentStatus?: string | null } | undefined)?.agentStatus || "").toLowerCase() ===
          "approved",
    );
  const selectedPayment =
    paymentOptions.find((option) => option.value === orderForm.paymentOption) ?? paymentOptions[0];

  useEffect(() => {
    setPortalReady(true);
    return () => setPortalReady(false);
  }, []);

  useEffect(() => {
    if (!mode || !portalReady) return;

    const frame = window.requestAnimationFrame(() => {
      modalCardRef.current?.scrollTo({ top: 0 });
      if (mode === "order") {
        customerNameInputRef.current?.focus();
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, [mode, portalReady]);

  useEffect(() => {
    if (mode !== "refer" || !effectiveLoggedIn || referralCode || loadingProfile) return;

    let cancelled = false;
    setLoadingProfile(true);

    void fetch("/api/agents/profile", { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json().catch(() => ({}))) as AgentProfilePayload;
        if (cancelled) return;
        setReferralCode(String(payload?.profile?.referralCode || "").trim() || null);
      })
      .catch(() => {
        if (!cancelled) setReferralCode(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingProfile(false);
      });

    return () => {
      cancelled = true;
    };
  }, [effectiveLoggedIn, loadingProfile, mode, referralCode]);

  function resetFeedback() {
    setError(null);
    setSuccess(null);
  }

  function scrollModalToTop() {
    window.requestAnimationFrame(() => {
      modalCardRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  function showError(message: string) {
    setSuccess(null);
    setError(message);
    scrollModalToTop();
  }

  function showSuccess(message: string) {
    setError(null);
    setSuccess(message);
    scrollModalToTop();
  }

  function handleAuthenticatedAction(event: React.MouseEvent<HTMLButtonElement>, nextMode: Exclude<ModalMode, null>) {
    event.preventDefault();
    event.stopPropagation();

    if (effectiveLoggedIn) {
      openMode(event, nextMode);
      return;
    }

    if (status === "loading") {
      showError("Checking your agent session. Please tap again in a second.");
      return;
    }

    router.push(loginHref);
  }

  function openMode(event: React.MouseEvent<HTMLButtonElement>, nextMode: Exclude<ModalMode, null>) {
    event.preventDefault();
    event.stopPropagation();
    resetFeedback();
    setMode(nextMode);
  }

  function closeModal(event?: React.MouseEvent<HTMLButtonElement | HTMLDivElement>) {
    event?.preventDefault();
    event?.stopPropagation();
    setMode(null);
    setBusy(false);
    resetFeedback();
  }

  function buildReferralMessage() {
    const link = buildPublicProductUrl(product, referralCode);
    const customerName = referForm.customerName.trim();
    const greeting = customerName ? `Hello ${customerName},` : "Hello,";
    return [
      greeting,
      "",
      "I came across this product from Betech Solar Solutions and thought it might be useful for you.",
      "",
      product.name,
      `Price: ${formatCurrency(product.price)}`,
      "",
      "You can view the full product details, confirm pricing, and order directly here:",
      link,
      "",
      "If you need help choosing the right solar product, you can also contact Betech Solar Solutions through the website or call 0722151083.",
    ].join("\n");
  }

  function focusInvalidOrderField(target: "name" | "phone" | "county" | "location") {
    const fieldRefs = {
      name: customerNameInputRef,
      phone: customerPhoneInputRef,
      county: customerCountySelectRef,
      location: customerLocationSelectRef,
    } as const;

    window.requestAnimationFrame(() => {
      modalCardRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      fieldRefs[target].current?.focus();
    });
  }

  async function submitOrder() {
    resetFeedback();
    const customerName = orderForm.customerName.trim();
    const customerPhone = normalizeKenyanPhone(orderForm.customerPhone);
    const customerCounty = orderForm.customerCounty.trim();
    const customerLocation = orderForm.customerLocation.trim();

    if (!customerName) {
      showError("Enter the customer name before submitting this order.");
      focusInvalidOrderField("name");
      return;
    }

    if (!customerPhone) {
      showError("Enter a valid Kenyan customer phone number before submitting this order.");
      focusInvalidOrderField("phone");
      return;
    }

    if (!customerCounty) {
      showError("Select the customer county before submitting this order.");
      focusInvalidOrderField("county");
      return;
    }

    if (!customerLocation) {
      showError("Select the customer town or market centre before submitting this order.");
      focusInvalidOrderField("location");
      return;
    }

    setBusy(true);

    const deliveryMethod =
      orderForm.paymentOption === "shop_pickup"
        ? "shop_pickup"
        : orderForm.paymentOption === "pay_on_delivery"
          ? "rider"
          : "courier";

    try {
      const response = await fetch("/api/agents/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName,
          customerPhone,
          customerCounty,
          customerLocation,
          productName: product.name,
          productCategory: product.category,
          quantity,
          unitPrice: product.price,
          totalAmount,
          paymentType: paymentTypeToApiValue[orderForm.paymentOption],
          amountPaid: 0,
          mpesaReference: "",
          deliveryMethod,
          deliveryNotes:
            orderForm.paymentOption === "pay_on_delivery"
              ? "Customer prefers pay on delivery."
              : orderForm.paymentOption === "full_payment"
                ? "Customer prefers to pay full amount before dispatch."
                : orderForm.paymentOption === "transport_fee"
                  ? "Customer pays transport fee first, then clears balance on delivery."
                  : "Customer will collect from the Nairobi CBD shop.",
          customerNotes: `Submitted from agent storefront. Preferred payment option: ${selectedPayment.title}.`,
          internalAgentNotes: "",
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        showError(payload?.error || "Unable to submit this customer order right now.");
        setBusy(false);
        return;
      }

      showSuccess("Customer order submitted successfully. It will now appear in the agent order workflow.");
      setBusy(false);
    } catch {
      showError("Unable to submit this customer order right now.");
      setBusy(false);
    }
  }

  async function handleSubmitOrder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    await submitOrder();
  }

  function openReferralAction() {
    resetFeedback();

    const normalizedPhone = normalizeKenyanPhone(referForm.customerPhone);
    if (!normalizedPhone) {
      showError("Enter a valid Kenyan phone number for the customer you want to refer.");
      window.requestAnimationFrame(() => {
        referralPhoneInputRef.current?.focus();
      });
      return;
    }

    const message = buildReferralMessage();
    const digits = normalizedPhone.replace(/^\+/, "");
    const encoded = encodeURIComponent(message);

    if (referForm.channel === "whatsapp") {
      const whatsappUrl = `https://wa.me/${digits}?text=${encoded}`;
      const popup = window.open(whatsappUrl, "_blank", "noopener,noreferrer");
      if (!popup) {
        window.location.assign(whatsappUrl);
      }
      showSuccess("WhatsApp referral message prepared. Send it from your phone to complete the referral.");
      return;
    }

    window.location.href = `sms:${normalizedPhone}?body=${encoded}`;
    showSuccess("SMS referral message prepared. Send it from your phone to complete the referral.");
  }

  function handleRefer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    openReferralAction();
  }

  return (
    <>
      <div className={compact ? "grid grid-cols-2 gap-2" : "grid gap-3 sm:grid-cols-2"}>
        <button
          type="button"
          onClick={(event) => handleAuthenticatedAction(event, "order")}
          className="inline-flex min-h-[2.95rem] items-center justify-center gap-2 rounded-2xl bg-[#7a0000] px-4 py-3 text-sm font-bold text-white shadow-[0_16px_34px_rgba(122,0,0,0.18)] transition hover:-translate-y-0.5"
        >
          Submit order & earn
        </button>
        <button
          type="button"
          onClick={(event) => handleAuthenticatedAction(event, "refer")}
          className="inline-flex min-h-[2.95rem] items-center justify-center gap-2 rounded-2xl border border-[#0f9d58]/20 bg-[#effcf4] px-4 py-3 text-sm font-bold text-[#0f9d58] shadow-[0_14px_28px_rgba(15,157,88,0.10)] transition hover:-translate-y-0.5"
        >
          Refer now
        </button>
      </div>

      {mode && portalReady
        ? createPortal(
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/55 px-4 py-6"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
        >
          <div
            ref={modalCardRef}
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[28px] border border-[#7a0000]/10 bg-white shadow-[0_30px_80px_rgba(15,23,42,0.24)]"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
          >
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[#7a0000]/8 bg-white px-5 py-4">
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#7a0000]">
                  {mode === "order" ? "Submit order & earn" : "Refer now"}
                </div>
                <h3 className="mt-1 text-xl font-black tracking-tight text-slate-950">{product.name}</h3>
                <p className="mt-1 text-sm text-slate-600">
                  {mode === "order"
                    ? "Capture the customer details and submit this product into the agent order pipeline."
                    : "Prepare a customer-facing WhatsApp or SMS message with the public Betech product link."}
                </p>
              </div>
              <button
                type="button"
                onClick={(event) => closeModal(event)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#7a0000]/10 text-slate-500 transition hover:bg-[#fcfaf7] hover:text-[#7a0000]"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-4 px-5 py-5">
              {error ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
              ) : null}
              {success ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div>
              ) : null}

              {mode === "order" ? (
                <form noValidate onSubmit={handleSubmitOrder} className="grid gap-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="grid gap-2 sm:col-span-2">
                      <span className="text-sm font-semibold text-slate-700">Customer name</span>
                      <input
                        ref={customerNameInputRef}
                        value={orderForm.customerName}
                        onChange={(event) => setOrderForm((current) => ({ ...current, customerName: event.target.value }))}
                        className={inputClassName}
                        placeholder="Customer full name"
                      />
                    </label>
                    <label className="grid gap-2">
                      <span className="text-sm font-semibold text-slate-700">Customer phone number</span>
                      <input
                        ref={customerPhoneInputRef}
                        value={orderForm.customerPhone}
                        onChange={(event) => setOrderForm((current) => ({ ...current, customerPhone: event.target.value }))}
                        className={inputClassName}
                        placeholder="e.g. 0712345678"
                      />
                    </label>
                    <label className="grid gap-2">
                      <span className="text-sm font-semibold text-slate-700">Quantity</span>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        required
                        value={orderForm.quantity}
                        onChange={(event) => setOrderForm((current) => ({ ...current, quantity: event.target.value }))}
                        className={inputClassName}
                      />
                    </label>
                    <label className="grid gap-2">
                      <span className="text-sm font-semibold text-slate-700">County</span>
                      <select
                        ref={customerCountySelectRef}
                        value={orderForm.customerCounty}
                        onChange={(event) =>
                          setOrderForm((current) => ({
                            ...current,
                            customerCounty: event.target.value,
                            customerLocation: "",
                          }))
                        }
                        className={inputClassName}
                      >
                        <option value="">Select county</option>
                        {kenyaCountyOptions.map((county) => (
                          <option key={county} value={county}>
                            {county}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="grid gap-2">
                      <span className="text-sm font-semibold text-slate-700">Town / market centre</span>
                      <select
                        ref={customerLocationSelectRef}
                        disabled={!orderForm.customerCounty}
                        value={orderForm.customerLocation}
                        onChange={(event) => setOrderForm((current) => ({ ...current, customerLocation: event.target.value }))}
                        className={`${inputClassName} disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400`}
                      >
                        <option value="">
                          {orderForm.customerCounty ? "Select town / market centre" : "Select county first"}
                        </option>
                        {availableTowns.map((town) => (
                          <option key={town} value={town}>
                            {town}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="rounded-[22px] border border-[#7a0000]/10 bg-[#fcfaf7] p-4">
                    <div className="text-[11px] font-black uppercase tracking-[0.16em] text-[#7a0000]">Order summary</div>
                    <div className="mt-3 grid gap-2 text-sm text-slate-700">
                      <div className="flex items-start justify-between gap-3">
                        <span className="font-semibold text-slate-500">Product</span>
                        <span className="max-w-[70%] text-right font-bold text-slate-950">{product.name}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-semibold text-slate-500">Unit price</span>
                        <span className="font-bold text-slate-950">{formatCurrency(product.price)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-semibold text-slate-500">Estimated total</span>
                        <span className="text-lg font-black text-slate-950">{formatCurrency(totalAmount)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3">
                    <div className="text-sm font-semibold text-slate-700">Customer payment arrangement</div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {paymentOptions.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setOrderForm((current) => ({ ...current, paymentOption: option.value }))}
                          className={`rounded-[20px] border px-4 py-3 text-left transition ${
                            orderForm.paymentOption === option.value
                              ? "border-[#7a0000]/24 bg-[#fff3d8] shadow-[0_12px_24px_rgba(122,0,0,0.08)]"
                              : "border-[#e6d7ce] bg-white hover:border-[#7a0000]/20"
                          }`}
                        >
                          <div className="text-sm font-black text-slate-950">{option.title}</div>
                          <div className="mt-1 text-xs leading-5 text-slate-600">{option.note}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        void submitOrder();
                      }}
                      disabled={busy}
                      className="inline-flex min-h-[3rem] flex-1 items-center justify-center gap-2 rounded-2xl bg-[#7a0000] px-5 py-3 text-sm font-bold text-white shadow-[0_16px_34px_rgba(122,0,0,0.18)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {busy ? "Submitting order..." : "Submit order & earn"}
                      <ArrowRight className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={(event) => closeModal(event)}
                      className="inline-flex min-h-[3rem] items-center justify-center rounded-2xl border border-[#7a0000]/12 bg-white px-5 py-3 text-sm font-semibold text-[#7a0000]"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <form noValidate onSubmit={handleRefer} className="grid gap-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="grid gap-2 sm:col-span-2">
                      <span className="text-sm font-semibold text-slate-700">Customer phone number</span>
                      <input
                        ref={referralPhoneInputRef}
                        required
                        value={referForm.customerPhone}
                        onChange={(event) => setReferForm((current) => ({ ...current, customerPhone: event.target.value }))}
                        className={inputClassName}
                        placeholder="e.g. 0712345678"
                      />
                    </label>
                    <label className="grid gap-2 sm:col-span-2">
                      <span className="text-sm font-semibold text-slate-700">Customer name (optional)</span>
                      <input
                        value={referForm.customerName}
                        onChange={(event) => setReferForm((current) => ({ ...current, customerName: event.target.value }))}
                        className={inputClassName}
                        placeholder="Used in the referral message greeting"
                      />
                    </label>
                  </div>

                  <div className="rounded-[22px] border border-[#7a0000]/10 bg-[#fcfaf7] p-4">
                    <div className="text-[11px] font-black uppercase tracking-[0.16em] text-[#7a0000]">Referral message preview</div>
                    <div className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{buildReferralMessage()}</div>
                    <div className="mt-3 text-xs text-slate-500">
                      {loadingProfile
                        ? "Loading your referral tracking link..."
                        : "The customer sees a normal Betech product link, while the referral attribution stays attached in the background."}
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => setReferForm((current) => ({ ...current, channel: "whatsapp" }))}
                      className={`rounded-[20px] border px-4 py-3 text-left transition ${
                        referForm.channel === "whatsapp"
                          ? "border-[#0f9d58]/24 bg-[#effcf4] shadow-[0_12px_24px_rgba(15,157,88,0.08)]"
                          : "border-[#e6d7ce] bg-white hover:border-[#0f9d58]/20"
                      }`}
                    >
                      <div className="flex items-center gap-2 text-sm font-black text-slate-950">
                        <MessageCircle className="h-4 w-4 text-[#0f9d58]" />
                        Refer via WhatsApp
                      </div>
                      <div className="mt-1 text-xs leading-5 text-slate-600">
                        Opens the customer WhatsApp chat with a ready message.
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setReferForm((current) => ({ ...current, channel: "sms" }))}
                      className={`rounded-[20px] border px-4 py-3 text-left transition ${
                        referForm.channel === "sms"
                          ? "border-[#7a0000]/24 bg-[#fff3d8] shadow-[0_12px_24px_rgba(122,0,0,0.08)]"
                          : "border-[#e6d7ce] bg-white hover:border-[#7a0000]/20"
                      }`}
                    >
                      <div className="flex items-center gap-2 text-sm font-black text-slate-950">
                        <Send className="h-4 w-4 text-[#7a0000]" />
                        Refer via SMS
                      </div>
                      <div className="mt-1 text-xs leading-5 text-slate-600">
                        Opens your phone SMS composer with the same tracked product link.
                      </div>
                    </button>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        openReferralAction();
                      }}
                      className="inline-flex min-h-[3rem] flex-1 items-center justify-center gap-2 rounded-2xl bg-[#7a0000] px-5 py-3 text-sm font-bold text-white shadow-[0_16px_34px_rgba(122,0,0,0.18)] transition hover:-translate-y-0.5"
                    >
                      {referForm.channel === "whatsapp" ? "Open WhatsApp referral" : "Open SMS referral"}
                      <ArrowRight className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={(event) => closeModal(event)}
                      className="inline-flex min-h-[3rem] items-center justify-center rounded-2xl border border-[#7a0000]/12 bg-white px-5 py-3 text-sm font-semibold text-[#7a0000]"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )
        : null}
    </>
  );
}
