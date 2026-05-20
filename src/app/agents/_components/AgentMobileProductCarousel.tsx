"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";

type ProductItem = {
  name: string;
  price: number;
  image: string;
  category: string;
};

type AgentMobileProductCarouselProps = {
  products: ProductItem[];
  registerHref: string;
};

function formatCurrency(value: number) {
  return `Ksh ${value.toLocaleString()}`;
}

export default function AgentMobileProductCarousel({
  products,
  registerHref,
}: AgentMobileProductCarouselProps) {
  const [isPaused, setIsPaused] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const resumeTimerRef = useRef<number | null>(null);
  const duplicatedProducts = useMemo(() => [...products, ...products], [products]);

  const pauseTemporarily = () => {
    setIsPaused(true);
    if (resumeTimerRef.current) {
      window.clearTimeout(resumeTimerRef.current);
    }
    resumeTimerRef.current = window.setTimeout(() => {
      setIsPaused(false);
      resumeTimerRef.current = null;
    }, 3200);
  };

  useEffect(() => {
    const container = scrollRef.current;
    if (!container || isPaused) return;

    let frameId = 0;
    let lastTime = 0;
    const loopWidth = container.scrollWidth / 2;
    const speed = loopWidth / 42;

    if (container.scrollLeft === 0) {
      container.scrollLeft = loopWidth;
    }

    const step = (time: number) => {
      if (!lastTime) lastTime = time;
      const delta = (time - lastTime) / 1000;
      lastTime = time;
      container.scrollLeft -= speed * delta;

      if (container.scrollLeft <= 0) {
        container.scrollLeft += loopWidth;
      }

      frameId = window.requestAnimationFrame(step);
    };

    frameId = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(frameId);
  }, [isPaused]);

  useEffect(() => {
    return () => {
      if (resumeTimerRef.current) {
        window.clearTimeout(resumeTimerRef.current);
      }
    };
  }, []);

  return (
    <div className="mt-6">
      <div
        ref={scrollRef}
        className="mobile-product-carousel -mx-4 overflow-x-auto overflow-y-visible px-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        onTouchStart={pauseTemporarily}
        onPointerDown={pauseTemporarily}
        onMouseEnter={pauseTemporarily}
        onFocus={pauseTemporarily}
      >
        <div className="flex min-w-max gap-4 pb-2">
          {duplicatedProducts.map((product, index) => {
            const commission = Math.round(product.price * 0.06);
            return (
              <div
                key={`${product.name}-${index}`}
                className="w-[88vw] min-w-[88vw] max-w-[380px] shrink-0 snap-start overflow-hidden rounded-[30px] border border-white/12 bg-[linear-gradient(180deg,#fffaf1_0%,#ffffff_100%)] text-slate-950 shadow-[0_22px_48px_rgba(0,0,0,0.18)]"
              >
                <div className="rounded-t-[30px] border-b border-[#7a0000]/10 bg-[#fff7ed]">
                  <Image
                    src={product.image}
                    alt={product.name}
                    width={760}
                    height={1120}
                    sizes="(max-width: 1024px) min(88vw, 380px), 380px"
                    className="mobile-product-image h-auto w-full object-contain object-center"
                  />
                </div>

                <div className="px-4 pb-4 pt-3">
                  <div className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">Product Price</div>
                  <div className="mt-1 text-2xl font-black text-slate-950">{formatCurrency(product.price)}</div>

                  <div className="mt-4 rounded-[22px] bg-[linear-gradient(135deg,#7a0000_0%,#991010_100%)] px-4 py-3.5 text-white shadow-[0_16px_34px_rgba(122,0,0,0.18)]">
                    <div className="text-sm font-bold uppercase tracking-[0.16em] text-[#ffd761]">Earn 6% Commission</div>
                    <div className="mt-2 text-3xl font-black">{formatCurrency(commission)}</div>
                  </div>

                  <Link
                    href={registerHref}
                    className="mt-4 inline-flex min-h-[3.45rem] w-full items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#0f9d58_0%,#0d884d_100%)] px-5 py-3 text-base font-bold text-white shadow-[0_16px_34px_rgba(15,157,88,0.24)] transition hover:-translate-y-0.5"
                  >
                    Refer This Product
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            .mobile-product-carousel {
              touch-action: pan-y;
              -webkit-overflow-scrolling: touch;
              scroll-snap-type: x proximity;
              scroll-padding-inline: 1rem;
            }

            .mobile-product-image {
              width: 100%;
              height: auto;
              object-fit: contain;
              object-position: center;
              display: block;
            }
          `,
        }}
      />
    </div>
  );
}
