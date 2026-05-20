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
  const duplicatedProducts = useMemo(() => [...products, ...products], [products]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container || isPaused) return;

    let frameId = 0;
    let lastTime = 0;
    const loopWidth = container.scrollWidth / 2;
    const speed = loopWidth / 40;

    const step = (time: number) => {
      if (!lastTime) lastTime = time;
      const delta = (time - lastTime) / 1000;
      lastTime = time;
      container.scrollLeft += speed * delta;

      if (container.scrollLeft >= loopWidth) {
        container.scrollLeft -= loopWidth;
      }

      frameId = window.requestAnimationFrame(step);
    };

    frameId = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(frameId);
  }, [isPaused]);

  return (
    <div className="mt-10">
      <div className="mb-4 flex items-center justify-end">
        <button
          type="button"
          onClick={() => setIsPaused((current) => !current)}
          className="inline-flex min-h-[2.5rem] items-center justify-center rounded-full border border-white/16 bg-white/10 px-4 py-2 text-sm font-bold text-white shadow-[0_12px_26px_rgba(0,0,0,0.12)] backdrop-blur transition"
        >
          {isPaused ? "Resume" : "Pause"}
        </button>
      </div>

      <div
        ref={scrollRef}
        className="mobile-product-carousel -mx-4 overflow-x-auto overflow-y-visible px-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        onTouchStart={() => setIsPaused(true)}
        onMouseEnter={() => setIsPaused(true)}
        onFocus={() => setIsPaused(true)}
      >
        <div className="flex min-w-max gap-4 pb-2">
          {duplicatedProducts.map((product, index) => {
            const commission = Math.round(product.price * 0.06);
            return (
              <div
                key={`${product.name}-${index}`}
                className="w-[88vw] max-w-[380px] shrink-0 snap-start overflow-hidden rounded-[30px] border border-white/12 bg-[linear-gradient(180deg,#fffaf1_0%,#ffffff_100%)] text-slate-950 shadow-[0_22px_48px_rgba(0,0,0,0.18)]"
              >
                <div className="relative h-[300px] w-full overflow-hidden border-b border-[#7a0000]/10 bg-[#fff7ed]">
                  <Image
                    src={product.image}
                    alt={product.name}
                    fill
                    sizes="(max-width: 1024px) min(88vw, 380px), 380px"
                    className="object-cover object-top"
                  />
                </div>

                <div className="px-5 pb-5 pt-4">
                  <div className="inline-flex rounded-full bg-[#fff3d8] px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-[#7a0000]">
                    {product.category}
                  </div>
                  <h3 className="mt-3 text-[1.8rem] font-black leading-tight text-slate-950">{product.name}</h3>
                  <div className="mt-3 text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">Product Price</div>
                  <div className="mt-1 text-2xl font-black text-slate-950">{formatCurrency(product.price)}</div>

                  <div className="mt-4 rounded-[22px] bg-[linear-gradient(135deg,#7a0000_0%,#991010_100%)] px-4 py-4 text-white shadow-[0_16px_34px_rgba(122,0,0,0.18)]">
                    <div className="text-sm font-bold uppercase tracking-[0.16em] text-[#ffd761]">Earn 6% Commission</div>
                    <div className="mt-2 text-3xl font-black">{formatCurrency(commission)}</div>
                  </div>

                  <Link
                    href={registerHref}
                    className="mt-4 inline-flex min-h-[3.5rem] w-full items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#0f9d58_0%,#0d884d_100%)] px-5 py-3 text-base font-bold text-white shadow-[0_16px_34px_rgba(15,157,88,0.24)] transition hover:-translate-y-0.5"
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
              touch-action: pan-x pan-y;
              -webkit-overflow-scrolling: touch;
              scroll-snap-type: x proximity;
            }
          `,
        }}
      />
    </div>
  );
}
