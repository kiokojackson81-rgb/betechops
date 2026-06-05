import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Headphones, MapPin, MessageCircle, ShieldCheck, Truck } from "lucide-react";
import type { ShopCategory } from "@/app/shop/shopData";
import { getShopCategoryDefinition } from "@/app/shop/shopCatalogConfig";
import { shopStyles } from "@/app/shop/_components/shopStyles";
import { getShopCategoryHref, SHOP_REQUEST_QUOTE_HREF } from "@/app/shop/storefrontPaths";

type ShopHeroProps = {
  categories: ShopCategory[];
  heroImageUrl?: string;
};

function getCategoryHref(slug: string) {
  return slug === "request-quote" ? SHOP_REQUEST_QUOTE_HREF : getShopCategoryHref(slug);
}

const helpCards = [
  {
    title: "Need help choosing solar?",
    copy: "Request a quote and our team will size the right panels, inverter, battery and accessories for you.",
    icon: ShieldCheck,
    href: SHOP_REQUEST_QUOTE_HREF,
  },
  {
    title: "WhatsApp support",
    copy: "Talk to Betech Solar on WhatsApp for quick product guidance before checkout.",
    icon: MessageCircle,
    href: "https://wa.me/254722151083?text=Hello%20Betech%20Solar%2C%20I%20need%20help%20choosing%20the%20right%20solar%20products.",
  },
  {
    title: "Nairobi CBD shop",
    copy: "Visit our Nairobi CBD shop for pickup, product guidance, and order confirmation.",
    icon: MapPin,
    href: SHOP_REQUEST_QUOTE_HREF,
  },
  {
    title: "Delivery and installation countrywide",
    copy: "We deliver and install solar systems countrywide across Kenya, with support for homes, businesses, farms, and institutions.",
    icon: Truck,
    href: SHOP_REQUEST_QUOTE_HREF,
  },
];

export default function ShopHero({ categories, heroImageUrl = "/agents/hero-generated-v2.png" }: ShopHeroProps) {
  const categoryList = categories.slice(0, 10);
  const isRemoteImage = /^https?:\/\//i.test(heroImageUrl);

  return (
    <section className="pt-2.5 sm:pt-4">
      <div className={shopStyles.shell}>
        <div className="grid gap-3 lg:grid-cols-[0.24fr_0.52fr_0.24fr]">
          <aside className={`${shopStyles.lightCard} hidden h-fit overflow-hidden lg:block`}>
            <div className="border-b border-[#7a0000]/8 px-4 py-2.5 text-xs font-black uppercase tracking-[0.16em] text-[#7a0000]">
              Shop categories
            </div>
            <nav className="grid">
              {categoryList.map((category) => (
                <div key={category.slug} className="group relative">
                  <Link
                    href={getCategoryHref(category.slug)}
                    className="flex items-center justify-between gap-3 border-b border-[#7a0000]/6 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-[#fff7ea] hover:text-[#7a0000]"
                  >
                    <span>{category.title}</span>
                    <ArrowRight className="h-4 w-4 text-[#7a0000]/50" />
                  </Link>
                  {getShopCategoryDefinition(category.slug)?.subcategories.length ? (
                    <div className="pointer-events-none absolute left-[calc(100%-0.1rem)] top-0 z-30 hidden w-[19rem] rounded-[22px] border border-[#7a0000]/10 bg-white p-3 opacity-0 shadow-[0_22px_44px_rgba(15,23,42,0.12)] transition duration-200 group-hover:pointer-events-auto group-hover:opacity-100 lg:block">
                      <div className="text-[11px] font-black uppercase tracking-[0.16em] text-[#7a0000]">Subcategories</div>
                      <div className="mt-2 grid gap-1.5">
                        {getShopCategoryDefinition(category.slug)?.subcategories.map((subcategory) => (
                          <Link
                            key={subcategory.value}
                            href={`${getShopCategoryHref(category.slug)}?sub=${subcategory.value}`}
                            className="rounded-2xl px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-[#fff7ea] hover:text-[#7a0000]"
                          >
                            {subcategory.label}
                          </Link>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ))}
            </nav>
          </aside>

          <div className={`${shopStyles.darkPanel} overflow-hidden p-3 sm:p-4 lg:p-5`}>
            <div className="grid gap-3 md:grid-cols-[1.08fr_0.92fr] md:items-center">
              <div>
                <div className="inline-flex w-fit rounded-full border border-[#f2b20f]/30 bg-[#fff3d8] px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#7a0000] shadow-[0_10px_18px_rgba(242,178,15,0.16)]">
                  Betech Solar Online Store
                </div>
                <h1 className="mt-3 max-w-2xl text-[1.8rem] font-black tracking-tight text-white sm:text-3xl lg:text-[2rem]">
                  Shop Genuine Solar Products
                </h1>
                <p className="mt-2 max-w-2xl text-[13px] leading-5 text-white/78 sm:text-sm sm:leading-6">
                  Genuine solar products with warranty support, Nairobi pickup and countrywide delivery.
                </p>
                <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
                  <Link href="#featured-deals" className={`${shopStyles.goldButton} min-h-[2.9rem] w-full`}>
                    Shop Products
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link href={SHOP_REQUEST_QUOTE_HREF} className={`${shopStyles.secondaryButton} min-h-[2.9rem] w-full bg-white/92`}>
                    Request Free Quote
                    <Headphones className="h-4 w-4" />
                  </Link>
                </div>
                <div className="mt-3 text-[12px] leading-5 text-white/72 sm:text-sm">We deliver and install solar systems anywhere in Kenya, with support for both small orders and complete system setups.</div>
              </div>

              <div className="overflow-hidden rounded-[22px] border border-white/10 bg-white/8 shadow-[0_18px_40px_rgba(0,0,0,0.18)] backdrop-blur sm:rounded-[24px]">
                <div className="relative h-44 sm:h-52 md:h-[18rem]">
                  <Image
                    src={heroImageUrl}
                    alt="Betech Solar ecommerce banner"
                    fill
                    unoptimized={isRemoteImage}
                    sizes="(max-width: 768px) 100vw, 42vw"
                    className="object-cover object-center"
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-[#2a0700]/50 via-transparent to-[#2a0700]/18" />
                  <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-4">
                    <div className="inline-flex rounded-full bg-white/92 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#7a0000]">
                      Solar deals and support
                    </div>
                    <div className="mt-2 max-w-sm text-base font-black leading-5 text-white sm:text-xl sm:leading-6">Panels, batteries, inverters, pumps and full kits in one place.</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-1">
            {helpCards.map((card) => {
              const Icon = card.icon;
              const external = card.href.startsWith("http");

              return (
                <Link
                  key={card.title}
                  href={card.href}
                  target={external ? "_blank" : undefined}
                  rel={external ? "noreferrer" : undefined}
                  className={`${shopStyles.lightCard} flex items-start gap-3 p-3.5 transition hover:-translate-y-0.5`}
                >
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[#fff3d8] text-[#7a0000]">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div>
                    <div className="text-sm font-black text-slate-950">{card.title}</div>
                    <div className="mt-1 text-xs leading-5 text-slate-600">{card.copy}</div>
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
