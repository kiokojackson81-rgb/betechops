import Image from "next/image";
import Link from "next/link";
import {
  BadgeCheck,
  CirclePlay,
  CircleDollarSign,
  Headphones,
  MapPinned,
  PanelsTopLeft,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import AgentCatalogueProductCard from "@/app/agents/_components/AgentCatalogueProductCard";
import AgentWhatsAppFloat from "@/app/agents/_components/AgentWhatsAppFloat";
import {
  getAgentCommissionValue,
  getPopularitySignalsByProduct,
  sortAgentProductsBySignals,
} from "@/app/agents/agentCatalogue";
import { shopStyles } from "@/app/shop/_components/shopStyles";
import { type ShopProduct } from "@/app/shop/shopData";
import { getShopProducts } from "@/app/shop/shopApi";
import { auth } from "@/lib/auth";
import { agentPath } from "@/lib/agents/host";

type AgentsLandingPageProps = {
  useRootPaths?: boolean;
};

const featureCards = [
  {
    title: "Earn up to Ksh 57,000",
    copy: "SRNE 20KW Solar System",
    tone: "gold",
  },
  {
    title: "Track referrals in real time",
    copy: "Follow every order from submission to payout",
    tone: "maroon",
  },
  {
    title: "Withdraw commission through M-Pesa",
    copy: "Fast payout flow after completed sales",
    tone: "gold",
  },
];

const heroTrustPoints = [
  { label: "Nationwide delivery", icon: MapPinned },
  { label: "Real-time commission tracking", icon: PanelsTopLeft },
  { label: "M-Pesa payouts", icon: Smartphone },
  { label: "Installation support", icon: BadgeCheck },
] as const;

const howItWorksSteps = [
  {
    title: "Submit order & earn",
    copy: "Capture the customer details directly from any live product and send the sale into the Betech fulfilment flow.",
    icon: CircleDollarSign,
  },
  {
    title: "Refer now",
    copy: "Generate a clean WhatsApp or SMS message using the public betech.co.ke product link while attribution stays hidden.",
    icon: Smartphone,
  },
  {
    title: "Track delivery and payout",
    copy: "Follow every linked order through dispatch, payment confirmation, and final commission release on your dashboard.",
    icon: PanelsTopLeft,
  },
] as const;

const benefits = [
  {
    title: "Trusted Betech brand",
    copy: "Pitch against the same public catalogue customers already browse on betech.co.ke.",
    icon: ShieldCheck,
  },
  {
    title: "Clear commission visibility",
    copy: "Each live product surfaces the commission amount so you can prioritize stronger referrals fast.",
    icon: CircleDollarSign,
  },
  {
    title: "Operations handled centrally",
    copy: "Betech manages support, delivery, installation, and payment follow-up after you secure the customer.",
    icon: Headphones,
  },
] as const;

const faqItems = [
  {
    question: "How do I earn commission?",
    answer:
      "Commission is released after the referred or submitted customer order is completed and payment is confirmed by Betech.",
  },
  {
    question: "Can I refer a customer before creating a password?",
    answer:
      "Yes. Agent access is passwordless. OTP login links the order or referral to your agent profile before the action is sent.",
  },
  {
    question: "Do customers see my commission?",
    answer:
      "No. Customers only see the public Betech product page and normal order communication. Commission tracking remains internal.",
  },
] as const;

function getSectionProducts(products: ShopProduct[], keywords: string[], limit = 4) {
  const lowerKeywords = keywords.map((keyword) => keyword.toLowerCase());
  return products
    .filter((product) => {
      const haystack = [
        product.category,
        product.subcategory,
        product.name,
        product.brand,
        ...product.tags,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return lowerKeywords.some((keyword) => haystack.includes(keyword));
    })
    .slice(0, limit);
}

export default async function AgentsLandingPage({
  useRootPaths = false,
}: AgentsLandingPageProps) {
  const [products, session] = await Promise.all([
    getShopProducts(),
    auth().catch(() => null),
  ]);

  const isLoggedInAgent = Boolean(
    (session?.user as { isAgent?: boolean } | undefined)?.isAgent,
  );

  const popularitySignals = await getPopularitySignalsByProduct(products);
  const sortedProducts = sortAgentProductsBySignals(
    products,
    popularitySignals,
    "featured",
  );

  const featuredProducts = sortedProducts.slice(0, 8);
  const solarKitProducts = getSectionProducts(sortedProducts, ["solar full kits"], 4);
  const batteryProducts = getSectionProducts(
    sortedProducts,
    ["solar batteries", "lithium batteries"],
    4,
  );
  const pumpProducts = getSectionProducts(sortedProducts, ["solar water pumps"], 4);

  const otpHref = `/login/phone?callbackUrl=${encodeURIComponent(
    agentPath("/dashboard", useRootPaths),
  )}`;
  const dashboardHref = agentPath("/dashboard", useRootPaths);
  const productsHref = agentPath("/products", useRootPaths);
  const totalCommissionVisible = featuredProducts.filter(
    (product) => getAgentCommissionValue(product) > 0,
  ).length;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,rgba(242,178,15,0.16),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(122,0,0,0.10),transparent_26%),linear-gradient(180deg,#fffdf9_0%,#fff6ed_100%)] text-slate-950">
      <header className="sticky top-0 z-40 border-b border-[#7a0000]/8 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link href={agentPath("/", useRootPaths)} className="flex items-center gap-4">
            <div className="overflow-hidden rounded-[1.7rem] border border-[#7a0000]/10 bg-white px-2 py-1 shadow-[0_14px_28px_rgba(122,0,0,0.10)]">
              <Image
                src="/agents/betech-logo-crop.png"
                alt="Betech Solar Solutions"
                width={126}
                height={94}
                className="h-16 w-auto object-contain sm:h-20"
              />
            </div>
            <div className="hidden leading-tight sm:block">
              <div className="text-sm font-black uppercase tracking-[0.18em] text-[#7a0000]">
                Betech Solar
              </div>
              <div className="text-xs text-slate-500">Solutions Kenya</div>
            </div>
          </Link>

          <nav className="hidden items-center gap-8 text-sm font-semibold text-slate-700 xl:flex">
            <a href="#home" className="transition hover:text-[#7a0000]">Home</a>
            <a href="#how-it-works" className="transition hover:text-[#7a0000]">How It Works</a>
            <a href="#benefits" className="transition hover:text-[#7a0000]">Benefits</a>
            <a href="#products" className="transition hover:text-[#7a0000]">Products</a>
            <a href="#earnings" className="transition hover:text-[#7a0000]">Earnings</a>
            <a href="#faqs" className="transition hover:text-[#7a0000]">FAQs</a>
            <a href="#contact" className="transition hover:text-[#7a0000]">Contact</a>
          </nav>

          <div className="flex flex-wrap justify-end gap-2.5">
            {isLoggedInAgent ? (
              <>
                <Link href={dashboardHref} className={shopStyles.secondaryButton}>
                  Go to dashboard
                </Link>
                <Link href={productsHref} className={shopStyles.primaryButton}>
                  Browse products
                </Link>
              </>
            ) : (
              <>
                <Link href={otpHref} className={shopStyles.secondaryButton}>
                  Sign In
                </Link>
                <Link href={otpHref} className={shopStyles.primaryButton}>
                  Start Earning
                </Link>
              </>
            )}
          </div>
        </div>

        <div className="border-t border-[#7a0000]/8 xl:hidden">
          <div className="overflow-x-auto px-4 py-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:px-6 lg:px-8">
            <div className="flex min-w-max items-center gap-2">
              <a
                href="#home"
                className="inline-flex items-center gap-1.5 rounded-full border border-[#7a0000]/18 bg-[#fff3d8] px-3 py-2 text-[11px] font-semibold text-[#7a0000] shadow-[0_8px_20px_rgba(15,23,42,0.04)]"
              >
                Home
                <span className="h-1.5 w-1.5 rounded-full bg-[#f2b20f]" />
              </a>
              <a
                href="#how-it-works"
                className="inline-flex items-center rounded-full border border-[#7a0000]/12 bg-white px-3 py-2 text-[11px] font-semibold text-slate-700 shadow-[0_8px_20px_rgba(15,23,42,0.04)]"
              >
                How It Works
              </a>
              <a
                href="#benefits"
                className="inline-flex items-center rounded-full border border-[#7a0000]/12 bg-white px-3 py-2 text-[11px] font-semibold text-slate-700 shadow-[0_8px_20px_rgba(15,23,42,0.04)]"
              >
                Benefits
              </a>
              <a
                href="#products"
                className="inline-flex items-center rounded-full border border-[#7a0000]/12 bg-white px-3 py-2 text-[11px] font-semibold text-slate-700 shadow-[0_8px_20px_rgba(15,23,42,0.04)]"
              >
                Products
              </a>
              <a
                href="#earnings"
                className="inline-flex items-center rounded-full border border-[#7a0000]/12 bg-white px-3 py-2 text-[11px] font-semibold text-slate-700 shadow-[0_8px_20px_rgba(15,23,42,0.04)]"
              >
                Earnings
              </a>
              <a
                href="#faqs"
                className="inline-flex items-center rounded-full border border-[#7a0000]/12 bg-white px-3 py-2 text-[11px] font-semibold text-slate-700 shadow-[0_8px_20px_rgba(15,23,42,0.04)]"
              >
                FAQs
              </a>
              <a
                href="#contact"
                className="inline-flex items-center rounded-full border border-[#7a0000]/12 bg-white px-3 py-2 text-[11px] font-semibold text-slate-700 shadow-[0_8px_20px_rgba(15,23,42,0.04)]"
              >
                Contact
              </a>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-12">
        <section
          id="home"
          className="grid gap-8 lg:grid-cols-[1.02fr_0.98fr] lg:items-center"
        >
          <div className="space-y-6">
            <div className="inline-flex rounded-full border border-[#f2b20f]/30 bg-[#fff3d8] px-5 py-2.5 text-xs font-black uppercase tracking-[0.24em] text-[#7a0000]">
              Betech Agents Program
            </div>
            <div className="max-w-3xl">
              <h1 className="text-4xl font-black leading-[0.95] tracking-[-0.04em] text-slate-950 sm:text-5xl lg:text-[4.5rem]">
                Earn Money By <span className="text-[#7a0000]">Referring Solar</span>{" "}
                Customers <span className="text-[#f2b20f]">☀️</span>
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">
                Help customers access trusted solar products and earn commission directly to M-Pesa. Refer customers, submit orders, and earn from every successful sale.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              {isLoggedInAgent ? (
                <>
                  <Link href={dashboardHref} className={shopStyles.primaryButton}>
                    Go to dashboard
                  </Link>
                  <Link href={productsHref} className={shopStyles.secondaryButton}>
                    Browse products
                  </Link>
                </>
              ) : (
                <>
                  <Link href={otpHref} className={shopStyles.primaryButton}>
                    Start Earning With Betech
                  </Link>
                  <Link href={otpHref} className={shopStyles.secondaryButton}>
                    Sign In
                  </Link>
                </>
              )}
              <a href="#how-it-works" className={shopStyles.goldButton}>
                <CirclePlay className="h-5 w-5" />
                How It Works
              </a>
            </div>

            <p className="text-sm font-medium text-slate-600 sm:hidden">
              Join free, refer products, and start unlocking 6% commission across
              Kenya.
            </p>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {heroTrustPoints.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.label}
                    className="rounded-[1.5rem] border border-[#7a0000]/8 bg-white px-4 py-4 text-center shadow-[0_12px_26px_rgba(15,23,42,0.05)]"
                  >
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fff3d8] text-[#7a0000]">
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="mt-3 text-sm font-semibold text-slate-700">
                      {item.label}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 rounded-[2.4rem] bg-[radial-gradient(circle_at_top,rgba(242,178,15,0.18),transparent_44%),radial-gradient(circle_at_bottom_left,rgba(122,0,0,0.12),transparent_38%)] blur-2xl" />
            <div className="relative rounded-[2.4rem] border border-[#7a0000]/10 bg-[linear-gradient(180deg,#fff9ef_0%,#ffffff_100%)] p-4 shadow-[0_32px_80px_rgba(122,0,0,0.12)] sm:p-6">
              <div className="overflow-hidden rounded-[2rem] border border-[#7a0000]/10 bg-[#fcfaf7]">
                <div className="relative aspect-[4/3]">
                  <Image
                    src="/agents/product-solar-kit-generated.png"
                    alt="Betech Solar installation products"
                    fill
                    className="object-cover"
                    sizes="(max-width: 1024px) 100vw, 42vw"
                  />
                </div>
              </div>

              <div className="pointer-events-none absolute -left-4 top-8 w-44 rounded-[1.6rem] border border-[#7a0000]/10 bg-white px-4 py-4 shadow-[0_18px_40px_rgba(15,23,42,0.12)] sm:-left-6 sm:w-52">
                <div className="text-xs font-black uppercase tracking-[0.16em] text-[#7a0000]">
                  Products shown
                </div>
                <div className="mt-2 text-3xl font-black text-slate-950">
                  {sortedProducts.length}
                </div>
              </div>

              <div className="pointer-events-none absolute -right-4 top-16 w-44 rounded-[1.6rem] border border-[#f2b20f]/20 bg-[#fff8e8] px-4 py-4 shadow-[0_18px_40px_rgba(242,178,15,0.12)] sm:-right-6 sm:w-56">
                <div className="text-xs font-black uppercase tracking-[0.16em] text-[#7a0000]">
                  With commission visible
                </div>
                <div className="mt-2 text-3xl font-black text-slate-950">
                  {totalCommissionVisible}
                </div>
              </div>

              <div className="pointer-events-none absolute -bottom-5 left-8 right-8 grid gap-3 sm:grid-cols-3">
                {featureCards.map((item) => (
                  <div
                    key={item.title}
                    className={`rounded-[1.4rem] border px-4 py-4 shadow-[0_18px_40px_rgba(15,23,42,0.10)] ${
                      item.tone === "gold"
                        ? "border-[#f2b20f]/25 bg-[linear-gradient(180deg,#fff5de_0%,#fffdfa_100%)]"
                        : "border-[#7a0000]/12 bg-[linear-gradient(180deg,#fff8f5_0%,#ffffff_100%)]"
                    }`}
                  >
                    <div
                      className={`inline-flex rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${
                        item.tone === "gold"
                          ? "bg-[#f2b20f] text-slate-950"
                          : "bg-[#7a0000] text-white"
                      }`}
                    >
                      Opportunity
                    </div>
                    <div className="mt-3 text-base font-black text-slate-950">
                      {item.title}
                    </div>
                    <div className="mt-1 text-xs leading-6 text-slate-600">{item.copy}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="pt-28 sm:pt-32">
          <div className="rounded-[2rem] border border-[#7a0000]/10 bg-white p-5 shadow-[0_24px_50px_rgba(15,23,42,0.06)] sm:p-7">
            <div className="inline-flex rounded-full border border-[#f2b20f]/30 bg-[#fff3d8] px-4 py-2 text-xs font-black uppercase tracking-[0.24em] text-[#7a0000]">
              How It Works
            </div>
            <h2 className="mt-5 text-3xl font-black tracking-tight text-slate-950">
              Simple flow from customer lead to earned commission
            </h2>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {howItWorksSteps.map((step) => {
                const Icon = step.icon;
                return (
                  <div
                    key={step.title}
                    className="rounded-[1.6rem] border border-[#7a0000]/10 bg-[linear-gradient(180deg,#fff9ef_0%,#ffffff_100%)] p-5 shadow-[0_16px_34px_rgba(15,23,42,0.06)]"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fff3d8] text-[#7a0000]">
                      <Icon className="h-6 w-6" />
                    </div>
                    <h3 className="mt-4 text-xl font-black text-slate-950">{step.title}</h3>
                    <p className="mt-2 text-sm leading-7 text-slate-600">{step.copy}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section id="benefits" className="py-8 sm:py-10">
          <div className="grid gap-5 md:grid-cols-3">
            {benefits.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.title}
                  className="rounded-[2rem] border border-[#7a0000]/10 bg-white p-5 shadow-[0_24px_50px_rgba(15,23,42,0.06)]"
                >
                  <Icon className="h-8 w-8 text-[#7a0000]" />
                  <h3 className="mt-4 text-2xl font-black text-slate-950">{item.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-slate-600">{item.copy}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section id="products" className="py-2 sm:py-4">
          <div className="rounded-[2rem] border border-[#7a0000]/10 bg-white p-5 shadow-[0_24px_50px_rgba(15,23,42,0.06)] sm:p-7">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="inline-flex rounded-full border border-[#f2b20f]/30 bg-[#fff3d8] px-4 py-2 text-xs font-black uppercase tracking-[0.24em] text-[#7a0000]">
                  Products
                </div>
                <h2 className="mt-5 text-3xl font-black tracking-tight text-slate-950">
                  Submit orders or send tracked referrals from live Betech products
                </h2>
              </div>
              <Link href={productsHref} className={shopStyles.secondaryButton}>
                View full catalogue
              </Link>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {featuredProducts.map((product) => (
                <AgentCatalogueProductCard
                  key={product.id}
                  product={product}
                  loginHref={otpHref}
                  loggedIn={isLoggedInAgent}
                  useRootPaths={useRootPaths}
                />
              ))}
            </div>
          </div>
        </section>

        <section id="earnings" className="py-8 sm:py-10">
          <div className="grid gap-5 lg:grid-cols-3">
            {solarKitProducts.length ? (
              <div className="rounded-[2rem] border border-[#7a0000]/10 bg-white p-5 shadow-[0_24px_50px_rgba(15,23,42,0.06)]">
                <div className="text-xs font-black uppercase tracking-[0.2em] text-[#7a0000]">
                  Solar full kits
                </div>
                <div className="mt-3 space-y-3 text-sm text-slate-700">
                  {solarKitProducts.map((product) => (
                    <div
                      key={product.id}
                      className="rounded-2xl border border-[#7a0000]/8 bg-[#fcfaf7] px-4 py-3"
                    >
                      <div className="font-bold text-slate-950">{product.name}</div>
                      <div className="mt-1 text-[#7a0000]">
                        Commission visible:{" "}
                        {getAgentCommissionValue(product) > 0 ? "Yes" : "Review required"}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {batteryProducts.length ? (
              <div className="rounded-[2rem] border border-[#7a0000]/10 bg-white p-5 shadow-[0_24px_50px_rgba(15,23,42,0.06)]">
                <div className="text-xs font-black uppercase tracking-[0.2em] text-[#7a0000]">
                  Solar batteries
                </div>
                <div className="mt-3 space-y-3 text-sm text-slate-700">
                  {batteryProducts.map((product) => (
                    <div
                      key={product.id}
                      className="rounded-2xl border border-[#7a0000]/8 bg-[#fcfaf7] px-4 py-3"
                    >
                      <div className="font-bold text-slate-950">{product.name}</div>
                      <div className="mt-1 text-slate-600">
                        Best for backup and lithium upgrades.
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {pumpProducts.length ? (
              <div className="rounded-[2rem] border border-[#7a0000]/10 bg-white p-5 shadow-[0_24px_50px_rgba(15,23,42,0.06)]">
                <div className="text-xs font-black uppercase tracking-[0.2em] text-[#7a0000]">
                  Water pumps
                </div>
                <div className="mt-3 space-y-3 text-sm text-slate-700">
                  {pumpProducts.map((product) => (
                    <div
                      key={product.id}
                      className="rounded-2xl border border-[#7a0000]/8 bg-[#fcfaf7] px-4 py-3"
                    >
                      <div className="font-bold text-slate-950">{product.name}</div>
                      <div className="mt-1 text-slate-600">
                        Good for farms, boreholes, and irrigation referrals.
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </section>

        <section id="faqs" className="py-2 sm:py-4">
          <div className="rounded-[2rem] border border-[#7a0000]/10 bg-white p-5 shadow-[0_24px_50px_rgba(15,23,42,0.06)] sm:p-7">
            <div className="inline-flex rounded-full border border-[#f2b20f]/30 bg-[#fff3d8] px-4 py-2 text-xs font-black uppercase tracking-[0.24em] text-[#7a0000]">
              FAQs
            </div>
            <div className="mt-6 grid gap-4">
              {faqItems.map((item) => (
                <details
                  key={item.question}
                  className="rounded-[1.5rem] border border-[#7a0000]/10 bg-[#fffdfb] px-5 py-4"
                >
                  <summary className="cursor-pointer list-none text-lg font-black text-slate-950">
                    {item.question}
                  </summary>
                  <p className="mt-3 text-sm leading-7 text-slate-600">{item.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section id="contact" className="py-8 sm:py-10">
          <div className="rounded-[2rem] border border-[#7a0000]/10 bg-[linear-gradient(180deg,#fff9ef_0%,#ffffff_100%)] p-5 shadow-[0_24px_50px_rgba(15,23,42,0.06)] sm:p-7">
            <div className="inline-flex rounded-full border border-[#f2b20f]/30 bg-[#fff3d8] px-4 py-2 text-xs font-black uppercase tracking-[0.24em] text-[#7a0000]">
              Contact
            </div>
            <h2 className="mt-5 text-3xl font-black tracking-tight text-slate-950">
              Need help before sending a customer?
            </h2>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div className="rounded-[1.6rem] border border-[#7a0000]/10 bg-white px-5 py-4">
                <div className="text-xs font-black uppercase tracking-[0.18em] text-[#7a0000]">
                  Phone
                </div>
                <div className="mt-2 text-lg font-bold text-slate-950">0722 151 083</div>
                <div className="mt-1 text-sm text-slate-600">
                  Main Betech Solar support line
                </div>
              </div>
              <div className="rounded-[1.6rem] border border-[#7a0000]/10 bg-white px-5 py-4">
                <div className="text-xs font-black uppercase tracking-[0.18em] text-[#7a0000]">
                  Alternative line
                </div>
                <div className="mt-2 text-lg font-bold text-slate-950">0703 241 917</div>
                <div className="mt-1 text-sm text-slate-600">
                  Use for delivery and product follow-up
                </div>
              </div>
              <div className="rounded-[1.6rem] border border-[#7a0000]/10 bg-white px-5 py-4">
                <div className="text-xs font-black uppercase tracking-[0.18em] text-[#7a0000]">
                  Email
                </div>
                <div className="mt-2 text-lg font-bold text-slate-950">info@betech.co.ke</div>
                <div className="mt-1 text-sm text-slate-600">
                  For quotation, operations, and customer support
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <AgentWhatsAppFloat />
    </div>
  );
}
