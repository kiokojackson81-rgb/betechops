"use client";

import Link from "next/link";
import { useMemo } from "react";
import { MessageCircle, PhoneCall } from "lucide-react";
import ShopSupportStrip from "@/app/shop/_components/ShopSupportStrip";
import TrackedWhatsAppLink from "@/app/shop/_components/TrackedWhatsAppLink";
import { shopStyles } from "@/app/shop/_components/shopStyles";
import { SHOP_HOME_HREF } from "@/app/shop/storefrontPaths";

type QuoteSuccessClientProps = {
  quoteRef?: string;
};

export default function QuoteSuccessClient({ quoteRef }: QuoteSuccessClientProps) {
  const whatsappHref = useMemo(() => {
    const ref = quoteRef || "BT-QUOTE-REF";
    return `https://wa.me/254722151083?text=${encodeURIComponent(
      `Hello Betech Solar, I requested a solar quote ${ref}. Kindly assist.`,
    )}`;
  }, [quoteRef]);

  return (
    <div className="grid gap-5">
      <div className={`${shopStyles.darkPanel} p-6 sm:p-10`}>
        <div className="inline-flex rounded-full bg-[#fff3d8] px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-[#7a0000]">
          Quote request received
        </div>
        <h1 className="mt-4 text-4xl font-black tracking-tight text-white">Our solar sizing team will contact you shortly.</h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-white/76">
          We have logged your quote request and a Betech Solar team member will follow up with the right panel, inverter, battery, and accessory guidance.
        </p>
        <div className="mt-6 rounded-[26px] border border-white/10 bg-white/10 p-5">
          <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#ffd761]">Quote reference</div>
          <div className="mt-2 text-2xl font-black text-white">{quoteRef || "BT-QUOTE-REF"}</div>
          <div className="mt-4 grid gap-2 text-sm leading-6 text-white/76">
            <div>Your quotation request is now in the Betech Solar follow-up queue.</div>
            <div>Our team will contact you using the phone number or email you shared.</div>
            <div>When you log in to your account later, your quotation follow-up updates will appear there.</div>
          </div>
        </div>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <TrackedWhatsAppLink
            href={whatsappHref}
            className={shopStyles.whatsappButton}
            label="Quote follow-up WhatsApp"
            context="quote_success"
            ariaLabel="Follow up on this quote on WhatsApp"
          >
            <MessageCircle className="h-4 w-4" />
            Follow Up on WhatsApp
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
