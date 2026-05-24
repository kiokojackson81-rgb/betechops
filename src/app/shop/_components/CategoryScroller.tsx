import Image from "next/image";
import Link from "next/link";
import {
  ArrowUpRight,
  BatteryCharging,
  Camera,
  Cable,
  FileText,
  Lightbulb,
  PanelsTopLeft,
  Shield,
  SunMedium,
  Tv,
  Waves,
  Warehouse,
} from "lucide-react";
import type { ShopCategory } from "@/app/shop/shopData";
import { shopStyles } from "@/app/shop/_components/shopStyles";

const iconMap = {
  "solar-panels": SunMedium,
  "solar-inverters": PanelsTopLeft,
  "solar-batteries": Lightbulb,
  "solar-full-kits": PanelsTopLeft,
  "solar-water-heaters": Waves,
  "solar-water-pumps": Waves,
  "solar-lights": Lightbulb,
  "solar-cameras-security": Camera,
  "dc-appliances": Tv,
  "solar-charge-controllers": Shield,
  "solar-accessories": Cable,
  "portable-power-stations": BatteryCharging,
  "commercial-industrial-solar": Warehouse,
  "request-quote": FileText,
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
  const getCategoryHref = (slug: string) => (slug === "request-quote" ? "/shop/request-quote" : `/shop/category/${slug}`);

  return (
    <section className="py-4 sm:py-5">
      <div className={shopStyles.shell}>
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className={shopStyles.sectionEyebrow}>Categories</div>
            <h2 className="mt-3 text-xl font-black tracking-tight text-slate-950 sm:text-2xl">Shop by product type</h2>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {categories.map((category) => {
            const Icon = iconMap[category.slug as keyof typeof iconMap] ?? PanelsTopLeft;

            return (
              <Link
                key={category.slug}
                href={getCategoryHref(category.slug)}
                className="group relative overflow-hidden rounded-[22px] border border-[#7a0000]/10 bg-white shadow-[0_12px_24px_rgba(15,23,42,0.04)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_32px_rgba(122,0,0,0.08)]"
              >
                <div className="relative h-40 bg-slate-100 sm:h-44">
                  <Image
                    src={category.image}
                    alt={category.title}
                    fill
                    sizes="(max-width: 640px) 50vw, (max-width: 1280px) 25vw, 16vw"
                    className="object-cover transition duration-500 group-hover:scale-[1.04]"
                  />
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.08)_0%,rgba(15,23,42,0.22)_42%,rgba(15,23,42,0.82)_100%)]" />
                  <div className="absolute inset-x-0 top-0 flex items-center justify-between p-3">
                    <div className={`inline-flex h-9 w-9 items-center justify-center rounded-xl shadow-[0_8px_20px_rgba(15,23,42,0.18)] ${accentMap[category.accent]}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="rounded-full border border-white/25 bg-black/20 p-2 text-white/90 backdrop-blur-sm">
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </div>
                  </div>
                  <div className="absolute inset-x-0 bottom-0 p-3.5">
                    <div className="max-w-[14ch] text-base font-black leading-[1.05] tracking-tight text-white drop-shadow-[0_3px_12px_rgba(15,23,42,0.45)] sm:text-[1.05rem]">
                      {category.title}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
