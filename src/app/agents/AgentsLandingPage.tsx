import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BadgeCheck, CircleDollarSign, Headphones, MapPin, PanelsTopLeft, ShieldCheck, Users } from "lucide-react";
import AgentCatalogueProductCard from "@/app/agents/_components/AgentCatalogueProductCard";
import AgentWhatsAppFloat from "@/app/agents/_components/AgentWhatsAppFloat";
import { getAgentCommissionValue, getPopularitySignalsByProduct, sortAgentProductsBySignals } from "@/app/agents/agentCatalogue";
import { shopStyles } from "@/app/shop/_components/shopStyles";
import { buildShopCategories, type ShopProduct } from "@/app/shop/shopData";
import { getShopProducts } from "@/app/shop/shopApi";
import { getShopImageOverrides } from "@/lib/shopImageOverrides";
import { agentPath } from "@/lib/agents/host";

type AgentsLandingPageProps = {
  useRootPaths?: boolean;
};

function slugify(value: string) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function getProductsForCategory(
  products: ShopProduct[],
  categorySlugs: string[],
  limit = 4,
) {
  const allowed = new Set(categorySlugs);
  return products.filter((product) => allowed.has(slugify(product.category))).slice(0, limit);
}

export default async function AgentsLandingPage({
  useRootPaths = false,
}: AgentsLandingPageProps) {
  const [products, imageOverrides] = await Promise.all([
    getShopProducts(),
    getShopImageOverrides(),
  ]);

  const popularitySignals = await getPopularitySignalsByProduct(products);
  const sortedProducts = sortAgentProductsBySignals(products, popularitySignals, "featured");
  const categories = buildShopCategories(imageOverrides.categoryImages);

  const featuredCategories = categories.slice(0, 8);
  const featuredProducts = sortedProducts.slice(0, 8);
  const solarKitProducts = getProductsForCategory(sortedProducts, ["solar-full-kits"]);
  const batteryProducts = getProductsForCategory(sortedProducts, ["solar-batteries", "lithium-batteries"]);
  const inverterProducts = getProductsForCategory(sortedProducts, ["solar-inverters"]);
  const pumpProducts = getProductsForCategory(sortedProducts, ["solar-water-pumps"]);

  const otpHref = `/login/phone?callbackUrl=${encodeURIComponent(agentPath("/dashboard", useRootPaths))}`;
  const dashboardHref = agentPath("/dashboard", useRootPaths);
  const productsHref = agentPath("/products", useRootPaths);
  const totalCommissionVisible = featuredProducts.filter((product) => getAgentCommissionValue(product) > 0).length;

  const trustItems = [
    { title: "Same live catalogue", icon: PanelsTopLeft },
    { title: "Commission visible", icon: CircleDollarSign },
    { title: "Trusted Betech brand", icon: ShieldCheck },
    { title: "Customer support handled", icon: Headphones },
  ] as const;

  const quickReasons = [
    "Share the same live products customers see on betech.co.ke.",
    "Track referrals and commissions from your agent dashboard.",
    "Let Betech handle fulfilment, delivery coordination, and support.",
  ] as const;

  return (
    <div className={`${shopStyles.page} pb-32`}>
      <section className={shopStyles.headerGlass}>
        <div className={`${shopStyles.shell} py-4`}>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <Link href={agentPath("/", useRootPaths)} className="flex items-center gap-4">
                <div className="relative h-20 w-20 overflow-hidden rounded-[24px] border border-[#7a0000]/10 bg-white shadow-[0_16px_38px_rgba(15,23,42,0.08)] sm:h-24 sm:w-24">
                  <Image
                    src="/agents/betech-logo-crop.png"
                    alt="Betech Solar Solutions"
                    fill
                    sizes="96px"
                    className="object-contain p-2.5"
                  />
                </div>
                <div>
                  <div className="text-[11px] font-black uppercase tracking-[0.22em] text-[#7a0000]">
                    Betech Agents
                  </div>
                  <div className="mt-1 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
                    Agent Storefront
                  </div>
                  <p className="mt-1 text-sm text-slate-600 sm:text-[15px]">
                    Refer from the same live Betech catalogue and earn commission after completed sales.
                  </p>
                </div>
              </Link>

              <div className="flex flex-wrap gap-2.5">
                <Link href={productsHref} className={shopStyles.secondaryButton}>
                  Browse products
                </Link>
                <Link href={otpHref} className={shopStyles.primaryButton}>
                  Login with OTP
                </Link>
              </div>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1">
              {featuredCategories.map((category) => (
                <Link
                  key={category.slug}
                  href={`${productsHref}?category=${encodeURIComponent(category.slug)}`}
                  className="shrink-0 rounded-full border border-[#7a0000]/10 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-[#7a0000]/25 hover:text-[#7a0000]"
                >
                  {category.title}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="py-5 sm:py-6">
        <div className={shopStyles.shell}>
          <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
            <aside className={`${shopStyles.lightCard} p-4 sm:p-5`}>
              <div className={shopStyles.sectionEyebrow}>Categories</div>
              <div className="mt-4 grid gap-2">
                {featuredCategories.map((category) => (
                  <Link
                    key={category.slug}
                    href={`${productsHref}?category=${encodeURIComponent(category.slug)}`}
                    className="flex items-center justify-between rounded-[18px] border border-[#7a0000]/8 bg-[#fcfaf7] px-4 py-3 text-sm font-semibold text-slate-800 transition hover:border-[#7a0000]/18 hover:bg-white hover:text-[#7a0000]"
                  >
                    <span>{category.title}</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                ))}
              </div>

              <div className="mt-5 rounded-[22px] border border-[#f2b20f]/20 bg-[#fff8e8] p-4">
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#7a0000]">
                  Why agents use this
                </div>
                <div className="mt-3 grid gap-2.5 text-sm leading-6 text-slate-700">
                  {quickReasons.map((reason) => (
                    <div key={reason} className="flex gap-2.5">
                      <BadgeCheck className="mt-1 h-4 w-4 shrink-0 text-[#7a0000]" />
                      <span>{reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            </aside>

            <div className={`${shopStyles.softCard} overflow-hidden p-5 sm:p-6 lg:p-7`}>
              <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_310px] xl:items-center">
                <div>
                  <div className={shopStyles.sectionEyebrow}>Earn commission with the live Betech catalogue</div>
                  <h1 className="mt-4 max-w-4xl text-4xl font-black tracking-tight text-slate-950 sm:text-5xl lg:text-[3.5rem] lg:leading-[1.02]">
                    Share solar products across Kenya and manage referrals from one dashboard.
                  </h1>
                  <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">
                    The agent website now follows the same cleaner catalogue structure as betech.co.ke so categories, products, and customer-facing pricing feel familiar and easy to pitch.
                  </p>

                  <div className="mt-5 flex flex-wrap gap-3">
                    <Link href={otpHref} className={shopStyles.primaryButton}>
                      Continue with OTP
                    </Link>
                    <Link href={dashboardHref} className={shopStyles.secondaryButton}>
                      Go to dashboard
                    </Link>
                    <Link href={productsHref} className={shopStyles.goldButton}>
                      Open full catalogue
                    </Link>
                  </div>

                  <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {trustItems.map((item) => {
                      const Icon = item.icon;
                      return (
                        <div
                          key={item.title}
                          className="flex items-center gap-2 rounded-[18px] border border-[#7a0000]/8 bg-white px-3 py-3"
                        >
                          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[#fff3d8] text-[#7a0000]">
                            <Icon className="h-4 w-4" />
                          </span>
                          <span className="text-sm font-bold text-slate-800">{item.title}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                  <div className="rounded-[24px] border border-[#7a0000]/10 bg-white p-4 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
                    <div className="text-[11px] font-black uppercase tracking-[0.16em] text-[#7a0000]">
                      Live products
                    </div>
                    <div className="mt-2 text-3xl font-black tracking-tight text-slate-950">
                      {sortedProducts.length}
                    </div>
                    <p className="mt-1 text-sm text-slate-600">Same products customers browse on the main shop.</p>
                  </div>
                  <div className="rounded-[24px] border border-[#7a0000]/10 bg-white p-4 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
                    <div className="text-[11px] font-black uppercase tracking-[0.16em] text-[#7a0000]">
                      Categories
                    </div>
                    <div className="mt-2 text-3xl font-black tracking-tight text-slate-950">
                      {featuredCategories.length}
                    </div>
                    <p className="mt-1 text-sm text-slate-600">Fast access to the most referred solar categories.</p>
                  </div>
                  <div className="rounded-[24px] border border-[#f2b20f]/20 bg-[#fff8e8] p-4 shadow-[0_18px_45px_rgba(242,178,15,0.12)]">
                    <div className="text-[11px] font-black uppercase tracking-[0.16em] text-[#7a0000]">
                      Commission visible
                    </div>
                    <div className="mt-2 text-3xl font-black tracking-tight text-slate-950">
                      {totalCommissionVisible}
                    </div>
                    <p className="mt-1 text-sm text-slate-600">Featured products already showing earning visibility.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-1 sm:py-2">
        <div className={shopStyles.shell}>
          <div className={`${shopStyles.lightCard} p-4 sm:p-5`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className={shopStyles.sectionEyebrow}>Popular right now</div>
                <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
                  Best products to start referring
                </h2>
              </div>
              <Link href={productsHref} className="hidden sm:inline-flex sm:items-center sm:gap-2 sm:font-bold sm:text-[#7a0000]">
                View full catalogue
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {featuredProducts.map((product) => (
                <AgentCatalogueProductCard
                  key={product.id}
                  product={product}
                  primaryHref={otpHref}
                  primaryLabel="Refer & earn"
                  useRootPaths={useRootPaths}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {solarKitProducts.length ? (
        <section className="py-4">
          <div className={shopStyles.shell}>
            <div className={`${shopStyles.lightCard} p-4 sm:p-5`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className={shopStyles.sectionEyebrow}>Solar full kits</div>
                  <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-950">
                    Complete kits customers ask for most
                  </h2>
                </div>
                <Link
                  href={`${productsHref}?category=solar-full-kits`}
                  className="hidden sm:inline-flex sm:items-center sm:gap-2 sm:font-bold sm:text-[#7a0000]"
                >
                  See all kits
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
              <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {solarKitProducts.map((product) => (
                  <AgentCatalogueProductCard
                    key={product.id}
                    product={product}
                    primaryHref={otpHref}
                    primaryLabel="Refer kit"
                    useRootPaths={useRootPaths}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {(batteryProducts.length || inverterProducts.length || pumpProducts.length) ? (
        <section className="py-4">
          <div className={shopStyles.shell}>
            <div className="grid gap-4 xl:grid-cols-3">
              {batteryProducts.length ? (
                <div className={`${shopStyles.lightCard} p-4 sm:p-5`}>
                  <div className={shopStyles.sectionEyebrow}>Batteries</div>
                  <h3 className="mt-3 text-xl font-black tracking-tight text-slate-950">Storage options</h3>
                  <div className="mt-4 grid gap-4">
                    {batteryProducts.map((product) => (
                      <AgentCatalogueProductCard
                        key={product.id}
                        product={product}
                        primaryHref={otpHref}
                        primaryLabel="Refer battery"
                        useRootPaths={useRootPaths}
                      />
                    ))}
                  </div>
                </div>
              ) : null}

              {inverterProducts.length ? (
                <div className={`${shopStyles.lightCard} p-4 sm:p-5`}>
                  <div className={shopStyles.sectionEyebrow}>Inverters</div>
                  <h3 className="mt-3 text-xl font-black tracking-tight text-slate-950">Backup control</h3>
                  <div className="mt-4 grid gap-4">
                    {inverterProducts.map((product) => (
                      <AgentCatalogueProductCard
                        key={product.id}
                        product={product}
                        primaryHref={otpHref}
                        primaryLabel="Refer inverter"
                        useRootPaths={useRootPaths}
                      />
                    ))}
                  </div>
                </div>
              ) : null}

              {pumpProducts.length ? (
                <div className={`${shopStyles.lightCard} p-4 sm:p-5`}>
                  <div className={shopStyles.sectionEyebrow}>Water pumps</div>
                  <h3 className="mt-3 text-xl font-black tracking-tight text-slate-950">Farm and borehole demand</h3>
                  <div className="mt-4 grid gap-4">
                    {pumpProducts.map((product) => (
                      <AgentCatalogueProductCard
                        key={product.id}
                        product={product}
                        primaryHref={otpHref}
                        primaryLabel="Refer pump"
                        useRootPaths={useRootPaths}
                      />
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      <section className="py-5">
        <div className={shopStyles.shell}>
          <div className={`${shopStyles.darkPanel} overflow-hidden p-5 sm:p-6 lg:p-8`}>
            <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
              <div>
                <div className="inline-flex rounded-full bg-white/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-[#ffd761]">
                  Agent support
                </div>
                <h2 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">
                  Start with OTP, then manage referrals from the agent dashboard.
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-white/80 sm:text-[15px]">
                  Existing agents go straight to the dashboard after OTP. New agents can finish a short profile and begin referring products immediately.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-[22px] border border-white/10 bg-white/6 p-4">
                  <Users className="h-5 w-5 text-[#ffd761]" />
                  <div className="mt-3 text-lg font-black">Referral dashboard</div>
                  <p className="mt-2 text-sm leading-6 text-white/75">
                    Track submitted customers, commissions, and withdrawals in one place.
                  </p>
                </div>
                <div className="rounded-[22px] border border-white/10 bg-white/6 p-4">
                  <MapPin className="h-5 w-5 text-[#ffd761]" />
                  <div className="mt-3 text-lg font-black">Nationwide selling</div>
                  <p className="mt-2 text-sm leading-6 text-white/75">
                    Refer customers from any county while Betech handles product fulfilment and support.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <AgentWhatsAppFloat />
    </div>
  );
}
