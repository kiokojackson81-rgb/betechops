import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, FileText, Lightbulb, PanelsTopLeft, SunMedium, Waves } from "lucide-react";
import type { ShopCategory } from "@/app/shop/shopData";
import { shopStyles } from "@/app/shop/_components/shopStyles";

const iconMap = {
  "solar-panels": SunMedium,
  "solar-inverters": PanelsTopLeft,
  "solar-batteries": Lightbulb,
  "lithium-batteries": Lightbulb,
  "solar-full-kits": PanelsTopLeft,
  "all-in-one-systems": PanelsTopLeft,
  "solar-water-heaters": Waves,
  "solar-water-pumps": Waves,
  "solar-lights": Lightbulb,
  accessories: PanelsTopLeft,
  "request-quotation": FileText,
} as const;

const accentMap = {
  gold: "bg-[#fff3d8] text-[#7a0000]",
  maroon: "bg-[#7a0000] text-white",
  green: "bg-[#e9faf0] text-[#0f9d58]",
} as const;

type CategoryScrollerProps = {
  categories: ShopCategory[];
};

export default function CategoryScroller({ categories }: CategoryScrollerProps) {
  const getCategoryHref = (slug: string) => (slug === "request-quotation" ? "/shop/request-quote" : `/shop/category/${slug}`);

  return (
    <section className="py-12 sm:py-16">
      <div className={shopStyles.shell}>
        <div className="mx-auto max-w-3xl text-center">
          <div className="mx-auto h-1 w-16 rounded-full bg-gradient-to-r from-[#f2b20f] to-[#7a0000]" />
          <h2 className="mt-5 text-3xl font-black tracking-tight text-slate-950 md:text-5xl">Browse shop categories</h2>
          <p className="mt-4 text-base leading-7 text-slate-600">
            Browse Betech Solar Solutions product lines on mobile, tablet, and desktop with a quote-first path built into the store.
          </p>
        </div>

        <div className="mt-8 -mx-4 overflow-x-auto px-4 pb-2 lg:hidden">
          <div className="flex min-w-max gap-4">
            {categories.map((category) => {
              const Icon = iconMap[category.slug];

              return (
                <Link
                  key={category.slug}
                  href={getCategoryHref(category.slug)}
                  className="group w-[15.75rem] shrink-0 overflow-hidden rounded-[28px] border border-[#7a0000]/10 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.06)] transition duration-300 hover:-translate-y-1"
                >
                  <div className="relative h-32 border-b border-[#7a0000]/10 bg-[linear-gradient(135deg,#fff7e6_0%,#ffffff_100%)]">
                    <Image src={category.image} alt={category.title} fill sizes="15.75rem" className="object-contain p-4" />
                  </div>
                  <div className="p-4">
                    <div className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl ${accentMap[category.accent]}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="mt-4 text-lg font-black tracking-tight text-slate-950">{category.title}</div>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{category.blurb}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="mt-10 hidden gap-5 lg:grid lg:grid-cols-3 xl:grid-cols-4">
          {categories.map((category) => {
            const Icon = iconMap[category.slug];

            return (
              <Link
                key={category.slug}
                href={getCategoryHref(category.slug)}
                className="group overflow-hidden rounded-[30px] border border-[#7a0000]/10 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.06)] transition duration-300 hover:-translate-y-1.5 hover:shadow-[0_26px_60px_rgba(122,0,0,0.12)]"
              >
                <div className="relative h-40 border-b border-[#7a0000]/10 bg-[linear-gradient(135deg,#fff7e6_0%,#ffffff_100%)]">
                  <Image src={category.image} alt={category.title} fill sizes="(max-width: 1279px) 33vw, 24vw" className="object-contain p-5" />
                </div>
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${accentMap[category.accent]}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full border border-[#7a0000]/8 bg-[#fcfaf7] px-3 py-1 text-xs font-semibold text-slate-500">
                      Explore
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                  <div className="mt-4 text-xl font-black tracking-tight text-slate-950">{category.title}</div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{category.blurb}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
