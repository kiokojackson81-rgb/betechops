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
  const isRemoteImage = (value: string) => /^https?:\/\//i.test(value);

  return (
    <section className="py-3.5 sm:py-5">
      <div className={shopStyles.shell}>
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className={shopStyles.sectionEyebrow}>Categories</div>
            <h2 className="mt-3 text-xl font-black tracking-tight text-slate-950 sm:text-2xl">Shop by product type</h2>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
          {categories.map((category) => {
            const Icon = iconMap[category.slug as keyof typeof iconMap] ?? PanelsTopLeft;

            return (
              <Link
                key={category.slug}
                href={getCategoryHref(category.slug)}
                className="group aspect-[4/5] overflow-hidden rounded-[20px] border border-[#7a0000]/10 bg-white shadow-[0_12px_24px_rgba(15,23,42,0.04)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_32px_rgba(122,0,0,0.08)] sm:rounded-2xl"
              >
                <div className="flex h-full flex-col">
                  <div className="relative basis-[68%] overflow-hidden bg-neutral-100">
                    <Image
                      src={category.image}
                      alt={category.title}
                      fill
                      unoptimized={isRemoteImage(category.image)}
                      sizes="(max-width: 640px) 50vw, (max-width: 1280px) 25vw, 20vw"
                      className="h-full w-full object-cover object-center transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>
                  <div className="flex basis-[32%] items-end justify-between gap-2 p-3 sm:gap-3 sm:p-4">
                    <div className="flex min-w-0 items-end gap-2.5 sm:gap-3">
                      <div className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${accentMap[category.accent]} sm:h-10 sm:w-10`}>
                        <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="line-clamp-2 text-[0.95rem] font-black leading-[1.08] tracking-tight text-slate-950 sm:text-[1.05rem]">
                          {category.title}
                        </div>
                      </div>
                    </div>
                    <div className="mb-0.5 shrink-0 text-[#7a0000]/55 transition group-hover:text-[#7a0000]">
                      <ArrowUpRight className="h-4 w-4" />
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
