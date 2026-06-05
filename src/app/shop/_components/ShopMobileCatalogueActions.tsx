"use client";

import { useCallback } from "react";
import { ArrowUpDown, MessageCircle, SlidersHorizontal } from "lucide-react";
import TrackedWhatsAppLink from "@/app/shop/_components/TrackedWhatsAppLink";

const whatsappHref =
  "https://wa.me/254722151083?text=Hello%20Betech%20Solar%2C%20I%20need%20help%20choosing%20the%20right%20solar%20products.";

type ShopMobileCatalogueActionsProps = {
  filterTargetId: string;
  sortTargetId: string;
};

export default function ShopMobileCatalogueActions({
  filterTargetId,
  sortTargetId,
}: ShopMobileCatalogueActionsProps) {
  const openTarget = useCallback((targetId: string) => {
    const target = document.getElementById(targetId);
    if (!target) return;

    const details = target.closest("details");
    if (details instanceof HTMLDetailsElement) {
      details.open = true;
      window.setTimeout(() => {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 30);
      return;
    }

    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return (
    <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+0.85rem)] left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 lg:hidden">
      <div className="flex items-center gap-1 rounded-full border border-[#7a0000]/14 bg-[linear-gradient(135deg,#7a0000_0%,#561010_100%)] px-2 py-2 text-white shadow-[0_20px_42px_rgba(122,0,0,0.26)]">
        <button
          type="button"
          onClick={() => openTarget(sortTargetId)}
          className="inline-flex min-h-[2.7rem] items-center gap-2 rounded-full px-3.5 text-sm font-bold text-white"
        >
          <ArrowUpDown className="h-4 w-4" />
          Sort
        </button>
        <span className="h-6 w-px bg-white/18" />
        <button
          type="button"
          onClick={() => openTarget(filterTargetId)}
          className="inline-flex min-h-[2.7rem] items-center gap-2 rounded-full px-3.5 text-sm font-bold text-white"
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filter
        </button>
      </div>

      <TrackedWhatsAppLink
        href={whatsappHref}
        className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[linear-gradient(135deg,#16c768_0%,#0f9d58_55%,#0c8349_100%)] text-white shadow-[0_20px_42px_rgba(15,157,88,0.28)]"
        label="Mobile catalogue WhatsApp help"
        context="mobile_catalogue_fab"
        ariaLabel="Chat with Betech Solar on WhatsApp"
      >
        <MessageCircle className="h-5 w-5" />
      </TrackedWhatsAppLink>
    </div>
  );
}
