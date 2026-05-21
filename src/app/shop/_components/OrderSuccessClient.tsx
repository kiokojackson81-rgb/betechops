"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { MessageCircle, PhoneCall } from "lucide-react";
import ShopSupportStrip from "@/app/shop/_components/ShopSupportStrip";
import TrackedWhatsAppLink from "@/app/shop/_components/TrackedWhatsAppLink";
import { formatCurrency, shopStyles } from "@/app/shop/_components/shopStyles";
import { getLastMockOrder, type MockOrderRecord } from "@/app/shop/shopStorage";

type OrderSuccessClientProps = {
  orderRef?: string;
  mode?: string;
};

export default function OrderSuccessClient({ orderRef, mode = "preview" }: OrderSuccessClientProps) {
  const [order, setOrder] = useState<MockOrderRecord | null>(null);

  useEffect(() => {
    const stored = getLastMockOrder();
    if (!stored) return;
    if (!orderRef || stored.orderRef === orderRef) {
      setOrder(stored);
    }
  }, [orderRef]);

  const whatsappHref = useMemo(() => {
    const ref = order?.orderRef || orderRef || "BT-SHOP-REF";
    return `https://wa.me/254722151083?text=${encodeURIComponent(
      `Hello Betech Solar, I have placed order ${ref}. Kindly confirm availability and delivery.`,
    )}`;
  }, [order, orderRef]);

  return (
    <div className="grid gap-5">
      <div className={`${shopStyles.darkPanel} p-6 sm:p-10`}>
        <div className="inline-flex rounded-full bg-[#fff3d8] px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-[#7a0000]">
          Preview order received
        </div>
        <h1 className="mt-4 text-4xl font-black tracking-tight text-white">Your order has been received. Our Betech Solar team will contact you shortly.</h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-white/76">
          This success state is still running in safe {mode} preview mode. Payment has not been processed automatically, and our team will confirm availability, delivery, and next steps with you directly.
        </p>
        <div className="mt-6 grid gap-4 lg:grid-cols-[0.92fr_1.08fr]">
          <div className="rounded-[26px] border border-white/10 bg-white/10 p-5">
            <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#ffd761]">Order reference</div>
            <div className="mt-2 text-2xl font-black text-white">{order?.orderRef || orderRef || "BT-SHOP-REF"}</div>
            <div className="mt-4 inline-flex rounded-full border border-[#f2b20f]/30 bg-[#fff3d8]/12 px-4 py-2 text-sm font-black uppercase tracking-[0.14em] text-[#ffd761]">
              Pending Betech confirmation
            </div>
            {order ? (
              <div className="mt-5 grid gap-2 text-sm leading-6 text-white/76">
                <div>{order.customerName}</div>
                <div>{order.phone}</div>
                <div>{order.deliveryMethod}</div>
                <div>{order.paymentPreference}</div>
              </div>
            ) : null}
          </div>
          <div className="rounded-[26px] border border-white/10 bg-white/10 p-5">
            <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#ffd761]">Order summary</div>
            {order?.items?.length ? (
              <div className="mt-4 grid gap-3">
                {order.items.map((item) => (
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
                  <span>{formatCurrency(order.subtotal)}</span>
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm leading-6 text-white/76">Your latest preview order summary will appear here after checkout submission.</p>
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
          <Link href="/shop" className={`${shopStyles.secondaryButton} bg-white/92`}>
            Continue Shopping
          </Link>
        </div>
      </div>
      <ShopSupportStrip />
    </div>
  );
}
