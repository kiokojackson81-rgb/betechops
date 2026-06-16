import { MapPin, MessageCircle, Truck } from "lucide-react";
import TrackedWhatsAppLink from "@/app/shop/_components/TrackedWhatsAppLink";

export default function ShopSupportStrip() {
  return (
    <div className="rounded-[18px] border border-[#7a0000]/10 bg-[linear-gradient(180deg,#fffaf2_0%,#ffffff_100%)] p-3 shadow-[0_10px_24px_rgba(15,23,42,0.05)] sm:p-3.5">
      <div className="grid gap-2 md:grid-cols-3">
        <div className="flex items-start gap-2.5 rounded-[14px] border border-[#7a0000]/8 bg-white/80 px-3 py-2.5">
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#effcf4] text-[#0f9d58]">
            <MessageCircle className="h-4 w-4" />
          </span>
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.14em] text-[#7a0000] sm:text-xs">WhatsApp Support</div>
            <div className="mt-0.5 text-sm leading-5 text-slate-600">
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
        <div className="flex items-start gap-2.5 rounded-[14px] border border-[#7a0000]/8 bg-white/80 px-3 py-2.5">
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#fff3d8] text-[#7a0000]">
            <MapPin className="h-4 w-4" />
          </span>
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.14em] text-[#7a0000] sm:text-xs">Shop Location</div>
            <div className="mt-0.5 text-sm leading-5 text-slate-600">
              Pramukh Plaza, Third Floor, Shop No. 3 at Junction of Munyu Road and Sheikh Karume, Nairobi CBD
            </div>
          </div>
        </div>
        <div className="flex items-start gap-2.5 rounded-[14px] border border-[#7a0000]/8 bg-white/80 px-3 py-2.5">
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#fcf4e4] text-[#7a0000]">
            <Truck className="h-4 w-4" />
          </span>
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.14em] text-[#7a0000] sm:text-xs">Countrywide Delivery</div>
            <div className="mt-0.5 text-sm leading-5 text-slate-600">We can arrange Nairobi rider delivery or courier delivery across Kenya.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
