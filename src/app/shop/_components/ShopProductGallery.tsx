"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import ShopProductVisual from "@/app/shop/_components/ShopProductVisual";
import type { ShopProductVisualType } from "@/app/shop/shopData";

type ShopProductGalleryProps = {
  images: string[];
  productName: string;
  visualType: ShopProductVisualType;
};

export default function ShopProductGallery({ images, productName, visualType }: ShopProductGalleryProps) {
  const galleryImages = useMemo(() => (images.length ? images : [""]), [images]);
  const [activeIndex, setActiveIndex] = useState(0);
  const activeImage = galleryImages[activeIndex] || "";

  function moveGallery(step: number) {
    setActiveIndex((current) => (current + step + galleryImages.length) % galleryImages.length);
  }

  return (
    <div className="lg:sticky lg:top-24">
      <div className="overflow-hidden rounded-[32px] border border-[#7a0000]/10 bg-[linear-gradient(180deg,#fff6ea_0%,#ffffff_100%)] shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
        <div className="relative overflow-hidden rounded-[30px] border border-white/80 bg-[#f8f2e9]">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.95),transparent_72%)]" />
          <div className="absolute left-4 top-4 z-20 inline-flex items-center rounded-full border border-white/80 bg-white/90 px-3 py-1 text-[11px] font-semibold text-slate-600 shadow-[0_10px_22px_rgba(15,23,42,0.08)] backdrop-blur">
            {activeIndex + 1} / {galleryImages.length}
          </div>
          {galleryImages.length > 1 ? (
            <>
              <button
                type="button"
                aria-label="Previous product image"
                onClick={() => moveGallery(-1)}
                className="absolute left-4 top-1/2 z-20 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/80 bg-white/88 text-slate-700 shadow-[0_16px_30px_rgba(15,23,42,0.12)] transition hover:scale-[1.02] hover:text-[#7a0000]"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                aria-label="Next product image"
                onClick={() => moveGallery(1)}
                className="absolute right-4 top-1/2 z-20 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/80 bg-white/88 text-slate-700 shadow-[0_16px_30px_rgba(15,23,42,0.12)] transition hover:scale-[1.02] hover:text-[#7a0000]"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          ) : null}
          <div className="relative h-[20rem] p-4 sm:h-[26rem] sm:p-5 lg:h-[35rem]">
            {activeImage ? (
              <div className="group h-full w-full overflow-hidden rounded-[26px] bg-white shadow-[inset_0_0_0_1px_rgba(122,0,0,0.06)]">
                <img
                  src={activeImage}
                  alt={productName}
                  className="h-full w-full object-contain p-5 transition duration-500 group-hover:scale-[1.035]"
                  loading="eager"
                />
              </div>
            ) : (
              <div className="h-full w-full overflow-hidden rounded-[26px] bg-white p-5 shadow-[inset_0_0_0_1px_rgba(122,0,0,0.06)]">
                <ShopProductVisual visualType={visualType} productName={productName} className="h-full w-full" />
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-[#7a0000]/8 bg-white/92 px-3 py-3 sm:px-4">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {galleryImages.map((imageUrl, index) => {
              const isActive = index === activeIndex;
              return (
                <button
                  key={`${imageUrl}-${index}`}
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  className={`relative h-20 w-20 shrink-0 overflow-hidden rounded-[20px] border bg-[#f7efe4] p-1.5 transition sm:h-24 sm:w-24 ${
                    isActive
                      ? "border-[#7a0000]/35 shadow-[0_14px_28px_rgba(122,0,0,0.12)]"
                      : "border-[#7a0000]/10 hover:border-[#7a0000]/20"
                  }`}
                  aria-label={`View product image ${index + 1}`}
                >
                  {imageUrl ? (
                    <img src={imageUrl} alt={`${productName} thumbnail ${index + 1}`} className="h-full w-full rounded-[16px] object-contain bg-white" />
                  ) : (
                    <div className="h-full w-full rounded-[16px] bg-white p-1">
                      <ShopProductVisual visualType={visualType} productName={productName} compact className="h-full w-full" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
