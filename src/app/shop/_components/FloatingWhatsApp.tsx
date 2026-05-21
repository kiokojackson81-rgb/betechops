"use client";

import { MessageCircle } from "lucide-react";
import TrackedWhatsAppLink from "@/app/shop/_components/TrackedWhatsAppLink";

const whatsappHref =
  "https://wa.me/254722151083?text=Hello%20Betech%20Solar%2C%20I%20want%20help%20choosing%20the%20right%20solar%20system.";

type FloatingWhatsAppProps = {
  hideOnMobile?: boolean;
};

export default function FloatingWhatsApp({ hideOnMobile = false }: FloatingWhatsAppProps) {
  return (
    <div className={`fixed bottom-[calc(env(safe-area-inset-bottom)+1rem)] right-4 z-40 sm:right-6 ${hideOnMobile ? "hidden sm:block" : ""}`}>
      <TrackedWhatsAppLink
        href={whatsappHref}
        className="inline-flex min-h-[3.5rem] items-center gap-3 rounded-full border border-[#f2b20f]/22 bg-[linear-gradient(135deg,#16c768_0%,#0f9d58_55%,#0c8349_100%)] px-4 py-3 text-sm font-bold text-white shadow-[0_20px_45px_rgba(15,157,88,0.28)] transition duration-300 hover:-translate-y-0.5"
        label="Floating WhatsApp help"
        context="floating_button"
        ariaLabel="Talk to Betech Solar on WhatsApp"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/12">
          <MessageCircle className="h-4 w-4 sm:h-5 sm:w-5" />
        </span>
        <span className="hidden sm:block">
          <span className="block text-[11px] font-black uppercase tracking-[0.12em]">WhatsApp Help</span>
          <span className="block text-[11px] text-white/85">Ask for a solar quote</span>
        </span>
      </TrackedWhatsAppLink>
    </div>
  );
}
