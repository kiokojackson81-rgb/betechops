import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Headphones, MapPin, MessageCircle, ShieldCheck, Truck } from "lucide-react";
import type { ShopCategory } from "@/app/shop/shopData";
import { shopStyles } from "@/app/shop/_components/shopStyles";

type ShopHeroProps = {
  categories: ShopCategory[];
};

function getCategoryHref(slug: string) {
  return slug === "request-quotation" ? "/shop/request-quote" : `/shop/category/${slug}`;
}

const sidebarCategories = [
  "solar-panels",
  "solar-inverters",
  "solar-batteries",
  "lithium-batteries",
  "solar-full-kits",
  "solar-water-pumps",
  "solar-water-heaters",
  "solar-lights",
  "accessories",
  "request-quotation",
];

const helpCards = [
  {
    title: "Need help choosing solar?",
    copy: "Request a quote and our team will size the right panels, inverter, battery and accessories for you.",
    icon: ShieldCheck,
    href: "/shop/request-quote",
  },
  {
    title: "WhatsApp support",
    copy: "Talk to Betech Solar on WhatsApp for quick product guidance before checkout.",
    icon: MessageCircle,
    href: "https://wa.me/254722151083?text=Hello%20Betech%20Solar%2C%20I%20need%20help%20choosing%20the%20right%20solar%20products.",
  },
  {
    title: "Nairobi CBD shop",
    copy: "Visit our Nairobi CBD shop for pickup, guidance and product confirmation.",
    icon: MapPin,
    href: "/shop/request-quote",
  },
  {
    title: "Delivery countrywide",
    copy: "We deliver solar panels, batteries, inverters, pumps and kits across Kenya.",
    icon: Truck,
    href: "/shop/request-quote",
  },
];

export default function ShopHero({ categories }: ShopHeroProps) {
  const categoryList = sidebarCategories
    .map((slug) => categories.find((category) => category.slug === slug))
    .filter((category): category is ShopCategory => Boolean(category));

  return (
    <section className="pt-4 sm:pt-5">
      <div className={shopStyles.shell}>
        <div className="grid gap-4 lg:grid-cols-[0.24fr_0.52fr_0.24fr]">
          <aside className={`${shopStyles.lightCard} hidden h-fit overflow-hidden lg:block`}>
            <div className="border-b border-[#7a0000]/8 px-4 py-3 text-sm font-black uppercase tracking-[0.16em] text-[#7a0000]">
              Shop categories
            </div>
            <nav className="grid">
              {categoryList.map((category) => (
                <Link
                  key={category.slug}
                  href={getCategoryHref(category.slug)}
                  className="flex items-center justify-between gap-3 border-b border-[#7a0000]/6 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-[#fff7ea] hover:text-[#7a0000]"
                >
                  <span>{category.title}</span>
                  <ArrowRight className="h-4 w-4 text-[#7a0000]/50" />
                </Link>
              ))}
            </nav>
          </aside>

          <div className={`${shopStyles.darkPanel} overflow-hidden p-4 sm:p-5 lg:p-6`}>
            <div className="grid gap-4 md:grid-cols-[1.05fr_0.95fr] md:items-center">
              <div>
                <div className="inline-flex w-fit rounded-full border border-[#f2b20f]/30 bg-[#fff3d8] px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.18em] text-[#7a0000] shadow-[0_12px_24px_rgba(242,178,15,0.18)]">
                  Betech Solar Online Store
                </div>
                <h1 className="mt-4 max-w-2xl text-3xl font-black tracking-tight text-white sm:text-4xl lg:text-5xl">
                  Shop Genuine Solar Products
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-white/78 sm:text-base sm:leading-7">
                  Shop genuine solar products with warranty support, Nairobi pickup, and countrywide delivery.
                </p>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <Link href="#featured-deals" className={`${shopStyles.goldButton} min-h-[3.25rem] w-full`}>
                    Shop Products
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link href="/shop/request-quote" className={`${shopStyles.secondaryButton} min-h-[3.25rem] w-full bg-white/92`}>
                    Request Free Quote
                    <Headphones className="h-4 w-4" />
                  </Link>
                </div>
                <div className="mt-4 text-sm text-white/75">We deliver solar panels, batteries, inverters, pumps and kits across Kenya.</div>
              </div>

              <div className="overflow-hidden rounded-[28px] border border-white/10 bg-white/8 shadow-[0_24px_60px_rgba(0,0,0,0.18)] backdrop-blur">
                <div className="relative h-40 sm:h-48 md:h-64">
                  <Image
                    src="/agents/hero-generated-v2.png"
                    alt="Betech Solar ecommerce banner"
                    fill
                    sizes="(max-width: 768px) 100vw, 42vw"
                    className="object-cover object-center"
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-[#2a0700]/50 via-transparent to-[#2a0700]/18" />
                  <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5">
                    <div className="inline-flex rounded-full bg-white/92 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-[#7a0000]">
                      Nairobi pickup and delivery
                    </div>
                    <div className="mt-3 max-w-sm text-xl font-black text-white sm:text-2xl">Panels, batteries, inverters, pumps and full kits in one place.</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-3">
            {helpCards.map((card) => {
              const Icon = card.icon;
              const external = card.href.startsWith("http");

              return (
                <Link
                  key={card.title}
                  href={card.href}
                  target={external ? "_blank" : undefined}
                  rel={external ? "noreferrer" : undefined}
                  className={`${shopStyles.lightCard} flex items-start gap-3 p-4 transition hover:-translate-y-0.5`}
                >
                  <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#fff3d8] text-[#7a0000]">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div>
                    <div className="text-sm font-black text-slate-950">{card.title}</div>
                    <div className="mt-1 text-xs leading-5 text-slate-600 sm:text-sm">{card.copy}</div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
