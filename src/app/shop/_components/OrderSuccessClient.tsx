"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { MessageCircle, PhoneCall } from "lucide-react";
import ShopSupportStrip from "@/app/shop/_components/ShopSupportStrip";
import TrackedWhatsAppLink from "@/app/shop/_components/TrackedWhatsAppLink";
import { formatCurrency, shopStyles } from "@/app/shop/_components/shopStyles";
import { getLastMockOrder, type MockOrderRecord } from "@/app/shop/shopStorage";
import { SHOP_HOME_HREF } from "@/app/shop/storefrontPaths";

type OrderSuccessClientProps = {
  orderRef?: string;
};

type LiveOrderStatus = "PENDING" | "PROCESSING" | "RECEIPT_ISSUED" | "DISPATCHED" | "PAYMENT_CONFIRMED" | "DELIVERED" | "CANCELLED";

type LiveOrderRecord = {
  orderRef: string;
  customerName: string;
  customerPhone: string;
  customerLocation: string;
  customerEmail: string | null;
  deliveryMethod: string;
  paymentMethod: string;
  orderType: string;
  status: LiveOrderStatus;
  subtotal: number;
  total: number;
  receiptId: string | null;
  receipt: { id: string; receiptNumber: string | null; generatedAt: string } | null;
  processingAt: string | null;
  receiptIssuedAt: string | null;
  dispatchedAt: string | null;
  paymentConfirmedAt: string | null;
  paymentConfirmationMethod: string | null;
  paymentConfirmationReference: string | null;
  deliveredAt: string | null;
  items: Array<{
    id: string;
    productId: string | null;
    productName: string;
    quantity: number;
    unitPrice: number;
    total: number;
    sku: string | null;
    category: string | null;
  }>;
};

const LIVE_ORDER_STEPS: LiveOrderStatus[] = [
  "PENDING",
  "PROCESSING",
  "RECEIPT_ISSUED",
  "DISPATCHED",
  "PAYMENT_CONFIRMED",
  "DELIVERED",
];

function formatStatusLabel(status: string) {
  return status.replace(/_/g, " ");
}

export default function OrderSuccessClient({ orderRef }: OrderSuccessClientProps) {
  const [order, setOrder] = useState<MockOrderRecord | null>(null);
  const [liveOrder, setLiveOrder] = useState<LiveOrderRecord | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(Boolean(orderRef));

  useEffect(() => {
    const stored = getLastMockOrder();
    if (!stored) return;
    // A URL carrying an order reference must be verified by the canonical
    // order store. Local storage is only a convenience for legacy pages that
    // do not have a server-issued reference.
    if (!orderRef) {
      setOrder(stored);
    }
  }, [orderRef]);

  useEffect(() => {
    if (!orderRef) return;
    let active = true;
    setIsVerifying(true);
    fetch(`/api/shop/orders?ref=${encodeURIComponent(orderRef)}`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        if (!response.ok || !data?.ok) {
          throw new Error(data?.error || "Failed to load live order status.");
        }
        if (!active) return;
        setLiveOrder(data.order);
        setStatusError(null);
      })
      .catch((error: Error) => {
        if (!active) return;
        setStatusError(error.message);
      })
      .finally(() => {
        if (!active) return;
        setIsVerifying(false);
      });

    return () => {
      active = false;
    };
  }, [orderRef]);

  const whatsappHref = useMemo(() => {
    const ref = liveOrder?.orderRef || order?.orderRef || orderRef || "BT-SHOP-REF";
    return `https://wa.me/254722151083?text=${encodeURIComponent(
      `Hello Betech Solar, I have placed order ${ref}. Kindly confirm availability and delivery.`,
    )}`;
  }, [liveOrder, order, orderRef]);

  const hasVerifiedOrder = Boolean(liveOrder);
  const summaryItems = liveOrder?.items?.length
    ? liveOrder.items.map((item) => ({
        productId: item.productId || item.id,
        productName: item.productName,
        quantity: item.quantity,
        lineTotal: item.total,
      }))
    : !orderRef
      ? order?.items ?? []
      : [];

  const currentStatus = liveOrder?.status || (isVerifying ? "VERIFYING" : "UNVERIFIED");
  const currentRef = liveOrder?.orderRef || (!orderRef ? order?.orderRef : null) || orderRef || "BT-SHOP-REF";
  const customerName = liveOrder?.customerName || (!orderRef ? order?.customerName : null);
  const customerPhone = liveOrder?.customerPhone || (!orderRef ? order?.phone : null);
  const deliveryMethod = liveOrder?.deliveryMethod || (!orderRef ? order?.deliveryMethod : null);
  const paymentMethod = liveOrder?.paymentMethod || (!orderRef ? order?.paymentPreference : null);
  const subtotal = liveOrder?.subtotal ?? (!orderRef ? order?.subtotal : undefined);
  const heading = hasVerifiedOrder
    ? "Your order has been received. Our Betech Solar team will confirm availability, delivery, and payment details shortly."
    : isVerifying
      ? "We are verifying your order with Betech Solar."
      : "We could not verify your order with Betech Solar.";
  const intro = hasVerifiedOrder
    ? "Payment has not been processed automatically on this page. Your website checkout stays pending until a Betech Solar admin confirms the order and issues the correct receipt."
    : isVerifying
      ? "Please wait while we confirm that your order reached the customer service queue."
      : "Your order has not been confirmed. Please return to checkout and try again, or contact Betech Solar with the reference shown below.";

  return (
    <div className="grid gap-5">
      <div className={`${shopStyles.darkPanel} p-6 sm:p-10`}>
        <div className="inline-flex rounded-full bg-[#fff3d8] px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-[#7a0000]">
          {hasVerifiedOrder ? "Order received" : isVerifying ? "Verifying order" : "Order verification needed"}
        </div>
        <h1 className="mt-4 text-4xl font-black tracking-tight text-white">{heading}</h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-white/76">
          {intro}
        </p>
        <div className="mt-6 grid gap-4 lg:grid-cols-[0.92fr_1.08fr]">
          <div className="rounded-[26px] border border-white/10 bg-white/10 p-5">
            <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#ffd761]">Order reference</div>
            <div className="mt-2 text-2xl font-black text-white">{currentRef}</div>
            <div className="mt-4 inline-flex rounded-full border border-[#f2b20f]/30 bg-[#fff3d8]/12 px-4 py-2 text-sm font-black uppercase tracking-[0.14em] text-[#ffd761]">
              {formatStatusLabel(currentStatus)}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {LIVE_ORDER_STEPS.map((step) => {
                const currentIndex = LIVE_ORDER_STEPS.indexOf(currentStatus as LiveOrderStatus);
                const stepIndex = LIVE_ORDER_STEPS.indexOf(step);
                const completed = currentIndex >= stepIndex;
                return (
                  <span
                    key={step}
                    className={`inline-flex rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] ${
                      completed ? "bg-emerald-500/15 text-emerald-300" : "bg-white/8 text-white/45"
                    }`}
                  >
                    {formatStatusLabel(step)}
                  </span>
                );
              })}
            </div>
            {customerName ? (
              <div className="mt-5 grid gap-2 text-sm leading-6 text-white/76">
                <div>{customerName}</div>
                <div>{customerPhone}</div>
                <div>{deliveryMethod}</div>
                <div>{paymentMethod}</div>
                {liveOrder?.paymentConfirmationMethod ? (
                  <div className="text-emerald-300">
                    Payment confirmed: {liveOrder.paymentConfirmationMethod}
                    {liveOrder.paymentConfirmationReference ? ` · ${liveOrder.paymentConfirmationReference}` : ""}
                  </div>
                ) : null}
              </div>
            ) : null}
            {statusError ? <div className="mt-4 text-sm text-amber-300">Order verification failed: {statusError}</div> : null}
          </div>
          <div className="rounded-[26px] border border-white/10 bg-white/10 p-5">
            <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#ffd761]">Order summary</div>
            {summaryItems.length ? (
              <div className="mt-4 grid gap-3">
                {summaryItems.map((item) => (
                  <div key={`${item.productId}-${item.quantity}`} className="flex items-start justify-between gap-3 border-b border-white/10 pb-3 text-sm text-white/80">
                    <div>
                      <div className="font-bold text-white">{item.productName}</div>
                      <div>Qty {item.quantity}</div>
                    </div>
                    <div className="font-bold text-white">{formatCurrency(item.lineTotal)}</div>
                  </div>
                ))}
                <div className="flex items-center justify-between text-base font-black text-white">
                  <span>Subtotal</span>
                  <span>{formatCurrency(subtotal ?? 0)}</span>
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm leading-6 text-white/76">Your latest order summary will appear here after checkout submission.</p>
            )}
          </div>
        </div>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <TrackedWhatsAppLink
            href={whatsappHref}
            className={shopStyles.whatsappButton}
            label="Order confirmation WhatsApp"
            context="order_success"
            ariaLabel="Confirm this order on WhatsApp"
          >
            <MessageCircle className="h-4 w-4" />
            Confirm on WhatsApp
          </TrackedWhatsAppLink>
          <Link href="tel:+254722151083" className={`${shopStyles.goldButton} gap-2`}>
            <PhoneCall className="h-4 w-4" />
            Call Betech Solar
          </Link>
          <Link href={SHOP_HOME_HREF} className={`${shopStyles.secondaryButton} bg-white/92`}>
            Continue Shopping
          </Link>
        </div>
      </div>
      <ShopSupportStrip />
    </div>
  );
}
