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
    <section className="py-6 sm:py-8">
      <div className={shopStyles.shell}>
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className={shopStyles.sectionEyebrow}>Browse categories</div>
            <h2 className="mt-4 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Shop by product type</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Browse solar panels, inverters, batteries, pumps, lights and quote-first options from the Betech Solar store.
            </p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {categories.map((category) => {
            const Icon = iconMap[category.slug];

            return (
              <Link
                key={category.slug}
                href={getCategoryHref(category.slug)}
                className="group overflow-hidden rounded-[26px] border border-[#7a0000]/10 bg-white shadow-[0_16px_34px_rgba(15,23,42,0.05)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_22px_48px_rgba(122,0,0,0.10)]"
              >
                <div className="relative h-24 border-b border-[#7a0000]/10 bg-[linear-gradient(135deg,#fff7e6_0%,#ffffff_100%)] sm:h-28">
                  <Image src={category.image} alt={category.title} fill sizes="(max-width: 1024px) 50vw, 20vw" className="object-contain p-3 sm:p-4" />
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl ${accentMap[category.accent]}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full border border-[#7a0000]/8 bg-[#fcfaf7] px-3 py-1 text-xs font-semibold text-slate-500">
                      Explore
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                  <div className="mt-3 text-base font-black tracking-tight text-slate-950 sm:text-lg">{category.title}</div>
                  <p className="mt-2 text-xs leading-5 text-slate-600 sm:text-sm">{category.blurb}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
