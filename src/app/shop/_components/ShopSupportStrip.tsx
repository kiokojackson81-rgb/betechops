import { MapPin, MessageCircle, Truck } from "lucide-react";
import { shopStyles } from "@/app/shop/_components/shopStyles";
import TrackedWhatsAppLink from "@/app/shop/_components/TrackedWhatsAppLink";

export default function ShopSupportStrip() {
  return (
    <div className={`${shopStyles.softCard} p-3.5 sm:p-4`}>
      <div className="grid gap-2.5 md:grid-cols-3">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[#effcf4] text-[#0f9d58]">
            <MessageCircle className="h-4 w-4" />
          </span>
          <div>
            <div className="text-xs font-black uppercase tracking-[0.14em] text-[#7a0000] sm:text-sm">WhatsApp Support</div>
            <div className="mt-1 text-sm leading-6 text-slate-600">
              <TrackedWhatsAppLink
                href="https://wa.me/254722151083"
                className="font-semibold text-slate-950"
                label="Support strip WhatsApp 0722"
                context="support_strip"
                ariaLabel="Chat with Betech Solar on WhatsApp using 0722 151 083"
              >
                0722 151 083
              </TrackedWhatsAppLink>
              {" / "}
              <TrackedWhatsAppLink
                href="https://wa.me/254703241917"
                className="font-semibold text-slate-950"
                label="Support strip WhatsApp 0703"
                context="support_strip"
                ariaLabel="Chat with Betech Solar on WhatsApp using 0703 241 917"
              >
                0703 241 917
              </TrackedWhatsAppLink>
            </div>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[#fff3d8] text-[#7a0000]">
            <MapPin className="h-4 w-4" />
          </span>
          <div>
            <div className="text-xs font-black uppercase tracking-[0.14em] text-[#7a0000] sm:text-sm">Nairobi CBD Pickup</div>
            <div className="mt-1 text-sm leading-6 text-slate-600">Shop pickup is available from our Nairobi CBD shop.</div>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[#fcf4e4] text-[#7a0000]">
            <Truck className="h-4 w-4" />
          </span>
          <div>
            <div className="text-xs font-black uppercase tracking-[0.14em] text-[#7a0000] sm:text-sm">Countrywide Delivery</div>
            <div className="mt-1 text-sm leading-6 text-slate-600">We can arrange Nairobi rider delivery or courier delivery across Kenya.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
