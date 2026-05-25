"use client";

import { useEffect, useMemo, useRef, useState, type SyntheticEvent, type TouchEvent } from "react";
import { ChevronLeft, ChevronRight, Expand, PlayCircle, X } from "lucide-react";
import ShopProductVisual from "@/app/shop/_components/ShopProductVisual";
import type { ShopProductVisualType } from "@/app/shop/shopData";

type GalleryMediaItem =
  | { type: "image"; src: string }
  | { type: "video"; src: string };

type ShopProductGalleryProps = {
  images: string[];
  productName: string;
  visualType: ShopProductVisualType;
  videoEmbedUrl?: string | null;
  videoSourceUrl?: string | null;
};

type ImageMeta = {
  orientation: "portrait" | "landscape" | "square";
};

function getImageOrientation(width: number, height: number): ImageMeta["orientation"] {
  if (!width || !height) return "landscape";
  const ratio = width / height;
  if (ratio < 0.92) return "portrait";
  if (ratio > 1.08) return "landscape";
  return "square";
}

function buildVideoSrc(src: string, autoplay: boolean) {
  if (!src) return src;
  const separator = src.includes("?") ? "&" : "?";
  return `${src}${separator}autoplay=${autoplay ? "1" : "0"}&muted=0`;
}

function getTouchDelta(startX: number | null, endX: number) {
  if (startX == null) return 0;
  return endX - startX;
}

export default function ShopProductGallery({ images, productName, visualType, videoEmbedUrl, videoSourceUrl }: ShopProductGalleryProps) {
  const mediaItems = useMemo<GalleryMediaItem[]>(() => {
    const baseImages = (images.length ? images : [""]).map((src) => ({ type: "image" as const, src }));
    if (!videoEmbedUrl) return baseImages;
    const insertAt = Math.min(2, baseImages.length);
    return [
      ...baseImages.slice(0, insertAt),
      { type: "video", src: videoEmbedUrl },
      ...baseImages.slice(insertAt),
    ];
  }, [images, videoEmbedUrl]);

  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [imageMeta, setImageMeta] = useState<Record<string, ImageMeta>>({});
  const touchStartXRef = useRef<number | null>(null);

  const activeItem = mediaItems[activeIndex] || { type: "image" as const, src: "" };
  const activeOrientation = activeItem.type === "image" ? imageMeta[activeItem.src]?.orientation ?? "landscape" : "portrait";

  function setMediaIndex(index: number) {
    const nextIndex = (index + mediaItems.length) % mediaItems.length;
    setActiveIndex(nextIndex);
  }

  function moveGallery(step: number) {
    setMediaIndex(activeIndex + step);
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!mediaItems.length) return;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        moveGallery(-1);
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        moveGallery(1);
      }
      if (event.key === "Escape") {
        setLightboxOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeIndex, mediaItems.length]);

  useEffect(() => {
    if (!lightboxOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [lightboxOpen]);

  function handleImageLoad(src: string, event: SyntheticEvent<HTMLImageElement>) {
    const { naturalWidth, naturalHeight } = event.currentTarget;
    setImageMeta((current) => ({
      ...current,
      [src]: { orientation: getImageOrientation(naturalWidth, naturalHeight) },
    }));
  }

  function renderActiveMedia(expanded: boolean) {
    const isVideo = activeItem.type === "video";
    const frameHeight = expanded
      ? "h-[82vh]"
      : activeOrientation === "portrait"
        ? "h-[16rem] sm:h-[19rem] lg:h-[22rem] xl:h-[24rem]"
        : activeOrientation === "square"
          ? "h-[15rem] sm:h-[18rem] lg:h-[20rem] xl:h-[22rem]"
          : "h-[13.5rem] sm:h-[16rem] lg:h-[18rem] xl:h-[20rem]";
    const imageShellWidth = expanded
      ? "max-w-[92vw]"
      : activeOrientation === "portrait"
        ? "max-w-[18rem] sm:max-w-[21rem] lg:max-w-[23rem] xl:max-w-[25rem]"
        : activeOrientation === "square"
          ? "max-w-[21rem] sm:max-w-[24rem] lg:max-w-[28rem] xl:max-w-[30rem]"
          : "max-w-[23rem] sm:max-w-[28rem] md:max-w-[34rem] lg:max-w-[38rem] xl:max-w-[42rem]";
    const videoShellWidth = expanded ? "max-w-[26rem] sm:max-w-[30rem] md:max-w-[34rem]" : "max-w-[18rem] sm:max-w-[21rem] lg:max-w-[24rem] xl:max-w-[26rem]";

    return (
      <div className={`relative flex ${frameHeight} items-center justify-center overflow-hidden rounded-[26px]`}>
        {isVideo ? (
          <>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.12),transparent_34%),linear-gradient(180deg,#221411_0%,#0b0d11_100%)]" />
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.05),transparent_28%,transparent_72%,rgba(255,255,255,0.05))]" />
            <div className={`relative z-10 w-full ${videoShellWidth} overflow-hidden rounded-[24px] border border-white/10 bg-black shadow-[0_24px_48px_rgba(0,0,0,0.3)]`}>
              <div className="aspect-[9/16] w-full">
                <iframe
                  src={buildVideoSrc(activeItem.src, true)}
                  title={`${productName} product video`}
                  className="h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
              {videoSourceUrl ? (
                <div className="border-t border-white/10 bg-black px-3 py-2 text-center">
                  <a
                    href={videoSourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-semibold text-white/88 underline underline-offset-4 hover:text-white"
                  >
                    Open TikTok video directly
                  </a>
                </div>
              ) : null}
            </div>
          </>
        ) : activeItem.src ? (
          <>
            <div className="absolute inset-0 bg-[linear-gradient(180deg,#fffaf3_0%,#fffefe_100%)]" />
            <div className={`relative z-10 w-full ${imageShellWidth} overflow-hidden rounded-[24px] bg-white shadow-[0_16px_34px_rgba(15,23,42,0.08)]`}>
              <img
                src={activeItem.src}
                alt={productName}
                className="h-full max-h-[82vh] w-full object-contain p-1.5 sm:p-2"
                loading="eager"
                onLoad={(event) => handleImageLoad(activeItem.src, event)}
              />
            </div>
          </>
        ) : (
          <div className="relative z-10 h-full w-full overflow-hidden rounded-[24px] bg-white p-4 shadow-[inset_0_0_0_1px_rgba(122,0,0,0.06)]">
            <ShopProductVisual visualType={visualType} productName={productName} className="h-full w-full" />
          </div>
        )}
      </div>
    );
  }

  function handleTouchStart(event: TouchEvent<HTMLElement>) {
    touchStartXRef.current = event.touches[0]?.clientX ?? null;
  }

  function handleTouchEnd(event: TouchEvent<HTMLElement>) {
    const endX = event.changedTouches[0]?.clientX ?? null;
    if (endX == null) return;
    const delta = getTouchDelta(touchStartXRef.current, endX);
    touchStartXRef.current = null;
    if (Math.abs(delta) < 36) return;
    moveGallery(delta > 0 ? -1 : 1);
  }

  return (
    <>
      <div className="lg:sticky lg:top-24">
        <div className="overflow-hidden rounded-[28px] border border-[#7a0000]/10 bg-[linear-gradient(180deg,#fff7ef_0%,#fffdf9_100%)] shadow-[0_20px_44px_rgba(15,23,42,0.08)] sm:rounded-[32px]">
          <div className="relative overflow-hidden rounded-[26px] border border-[#7a0000]/8 bg-[linear-gradient(180deg,#fffaf4_0%,#fffefe_100%)] sm:rounded-[30px]">
            <div className="absolute left-4 top-4 z-20 inline-flex items-center rounded-full border border-white/12 bg-black/26 px-3 py-1 text-[11px] font-semibold text-white/82 shadow-[0_10px_22px_rgba(0,0,0,0.22)] backdrop-blur">
              {activeIndex + 1} / {mediaItems.length}
            </div>
            <button
              type="button"
              aria-label="Open fullscreen media viewer"
              onClick={() => setLightboxOpen(true)}
              className="absolute right-4 top-4 z-20 inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/12 bg-black/26 text-white shadow-[0_16px_30px_rgba(0,0,0,0.22)] transition hover:scale-[1.02] hover:bg-black/36"
            >
              <Expand className="h-5 w-5" />
            </button>
            {mediaItems.length > 1 ? (
              <>
                <button
                  type="button"
                  aria-label="Previous product media"
                  onClick={() => moveGallery(-1)}
                  className="absolute left-4 top-1/2 z-20 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/12 bg-black/26 text-white shadow-[0_16px_30px_rgba(0,0,0,0.22)] transition hover:scale-[1.02] hover:bg-black/36"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  aria-label="Next product media"
                  onClick={() => moveGallery(1)}
                  className="absolute right-4 top-1/2 z-20 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/12 bg-black/26 text-white shadow-[0_16px_30px_rgba(0,0,0,0.22)] transition hover:scale-[1.02] hover:bg-black/36"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </>
            ) : null}
            <button
              type="button"
              className="block w-full p-2 sm:p-3"
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              onClick={() => setLightboxOpen(true)}
            >
              <div className="transition duration-300 ease-out">{renderActiveMedia(false)}</div>
            </button>
          </div>

          <div className="border-t border-white/8 bg-[#f7efe4] px-2 py-2 sm:px-3 sm:py-2.5">
            <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {mediaItems.map((item, index) => {
                const isActive = index === activeIndex;
                return (
                  <button
                    key={`${item.type}-${item.src}-${index}`}
                    type="button"
                    onClick={() => setMediaIndex(index)}
                    className={`group relative h-14 w-14 shrink-0 overflow-hidden rounded-[14px] border bg-white/82 p-1 sm:h-16 sm:w-16 sm:rounded-[16px] sm:p-1 transition ${
                      isActive
                        ? "border-[#7a0000]/35 shadow-[0_14px_28px_rgba(122,0,0,0.12)]"
                        : "border-[#7a0000]/10 hover:-translate-y-0.5 hover:border-[#7a0000]/24 hover:shadow-[0_10px_18px_rgba(15,23,42,0.08)]"
                    }`}
                    aria-label={item.type === "video" ? "Play product video" : `View product image ${index + 1}`}
                  >
                    {item.type === "video" ? (
                      <div className="relative h-full w-full overflow-hidden rounded-[16px] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.16),transparent_45%),linear-gradient(180deg,#2a120e_0%,#111111_100%)]">
                        <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,rgba(255,255,255,0.06)_100%)]" />
                        <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-white">
                          <PlayCircle className="h-7 w-7 transition group-hover:scale-105" />
                          <span className="text-[10px] font-bold uppercase tracking-[0.14em]">Video</span>
                        </div>
                      </div>
                    ) : item.src ? (
                      <div className="relative h-full w-full overflow-hidden rounded-[16px] bg-white">
                        <img src={item.src} alt={`${productName} thumbnail ${index + 1}`} className="h-full w-full object-contain" onLoad={(event) => handleImageLoad(item.src, event)} />
                      </div>
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

      {lightboxOpen ? (
        <div className="fixed inset-0 z-[90] bg-[rgba(8,10,14,0.92)] backdrop-blur-md">
          <div className="absolute inset-x-0 top-0 flex items-center justify-between px-4 py-4 sm:px-6">
            <div className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-white/82">
              {activeIndex + 1} / {mediaItems.length}
            </div>
            <button
              type="button"
              onClick={() => setLightboxOpen(false)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white transition hover:bg-white/16"
              aria-label="Close fullscreen media viewer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {mediaItems.length > 1 ? (
            <>
              <button
                type="button"
                aria-label="Previous fullscreen media"
                onClick={() => moveGallery(-1)}
                className="absolute left-4 top-1/2 z-20 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white transition hover:bg-white/16"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                aria-label="Next fullscreen media"
                onClick={() => moveGallery(1)}
                className="absolute right-4 top-1/2 z-20 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white transition hover:bg-white/16"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          ) : null}

          <div
            className="flex h-full items-center justify-center px-4 pb-24 pt-20 sm:px-6"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            <div className="w-full max-w-[96rem]">{renderActiveMedia(true)}</div>
          </div>

          <div className="absolute inset-x-0 bottom-0 px-4 pb-4 sm:px-6">
            <div className="mx-auto flex max-w-3xl gap-2 overflow-x-auto rounded-[24px] border border-white/10 bg-white/8 p-2 backdrop-blur">
              {mediaItems.map((item, index) => {
                const isActive = index === activeIndex;
                return (
                  <button
                    key={`lightbox-${item.type}-${item.src}-${index}`}
                    type="button"
                    onClick={() => setMediaIndex(index)}
                    className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border p-1 ${
                      isActive ? "border-white/60 bg-white/12" : "border-white/10 bg-white/6"
                    }`}
                  >
                    {item.type === "video" ? (
                      <div className="flex h-full w-full items-center justify-center rounded-xl bg-[linear-gradient(180deg,#2a120e_0%,#111111_100%)] text-white">
                        <PlayCircle className="h-6 w-6" />
                      </div>
                    ) : item.src ? (
                      <img src={item.src} alt={`${productName} fullscreen thumbnail ${index + 1}`} className="h-full w-full rounded-xl object-contain bg-white" />
                    ) : (
                      <div className="h-full w-full rounded-xl bg-white p-1">
                        <ShopProductVisual visualType={visualType} productName={productName} compact className="h-full w-full" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
