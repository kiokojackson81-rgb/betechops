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
    <section className="py-4 sm:py-5">
      <div className={shopStyles.shell}>
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className={shopStyles.sectionEyebrow}>Categories</div>
            <h2 className="mt-3 text-xl font-black tracking-tight text-slate-950 sm:text-2xl">Shop by product type</h2>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {categories.map((category) => {
            const Icon = iconMap[category.slug];

            return (
              <Link
                key={category.slug}
                href={getCategoryHref(category.slug)}
                className="group overflow-hidden rounded-[22px] border border-[#7a0000]/10 bg-white shadow-[0_12px_24px_rgba(15,23,42,0.04)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_32px_rgba(122,0,0,0.08)]"
              >
                <div className="relative h-16 border-b border-[#7a0000]/10 bg-[linear-gradient(135deg,#fff7e6_0%,#ffffff_100%)] sm:h-20">
                  <Image src={category.image} alt={category.title} fill sizes="(max-width: 1024px) 50vw, 16vw" className="object-contain p-2.5 sm:p-3" />
                </div>
                <div className="p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className={`inline-flex h-8 w-8 items-center justify-center rounded-xl ${accentMap[category.accent]}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <ArrowUpRight className="h-3.5 w-3.5 text-[#7a0000]/45" />
                  </div>
                  <div className="mt-2.5 line-clamp-2 text-sm font-black leading-5 tracking-tight text-slate-950">{category.title}</div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
