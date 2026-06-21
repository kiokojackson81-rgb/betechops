import Image from "next/image";
import Link from "next/link";
import {
  BadgeCheck,
  CircleDollarSign,
  Headphones,
  MapPinned,
  PanelsTopLeft,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import AgentCatalogueProductCard from "@/app/agents/_components/AgentCatalogueProductCard";
import AgentStorefrontAuthActions from "@/app/agents/_components/AgentStorefrontAuthActions";
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

const productHighlights = [
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
  {
    title: "Nationwide delivery & installation",
    copy: "Betech handles fulfillment across Kenya",
    tone: "maroon",
  },
] as const;

const trustPoints = [
  { label: "Nationwide delivery", icon: MapPinned },
  { label: "Real-time commission tracking", icon: PanelsTopLeft },
  { label: "M-Pesa payouts", icon: Smartphone },
  { label: "Installation support", icon: BadgeCheck },
] as const;

const howItWorksSteps = [
  {
    title: "Submit order & earn",
    copy: "Capture customer details from any live product and send the order straight into the Betech workflow.",
    icon: CircleDollarSign,
  },
  {
    title: "Refer now",
    copy: "Share the tracked public product link through WhatsApp or SMS without exposing the internal commission flow.",
    icon: Smartphone,
  },
  {
    title: "Track completion",
    copy: "Follow delivery, payment, and final commission status from the agent dashboard after the sale closes.",
    icon: PanelsTopLeft,
  },
] as const;

const faqItems = [
  {
    question: "How do I earn commission?",
    answer:
      "You earn after a referred or submitted customer order is successfully completed and payment is confirmed by Betech.",
  },
  {
    question: "Can I refer without logging in first?",
    answer:
      "If you are not logged in, the system first prompts OTP sign-in so the referral or submitted order is linked back to your agent profile.",
  },
  {
    question: "Do customers see the agent commission?",
    answer:
      "No. Customers receive the public Betech product link, while referral attribution stays attached behind the scenes.",
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
  const homeHref = agentPath("/", useRootPaths);
  const productsHref = agentPath("/products", useRootPaths);
  const totalCommissionVisible = featuredProducts.filter(
    (product) => getAgentCommissionValue(product) > 0,
  ).length;

  return (
    <div className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_right,rgba(242,178,15,0.20),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(122,0,0,0.12),transparent_26%),linear-gradient(180deg,#fffdf9_0%,#fff5ea_100%)] px-4 py-4 text-slate-950 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-5 flex flex-wrap items-center justify-between gap-4 sm:mb-6">
          <Link href={agentPath("/", useRootPaths)} className="flex items-center gap-3">
            <div className="overflow-hidden rounded-2xl border border-[#7a0000]/10 bg-white px-2 py-1 shadow-[0_14px_28px_rgba(122,0,0,0.10)]">
              <Image
                src="/agents/betech-logo-crop.png"
                alt="Betech Solar Solutions"
                width={112}
                height={84}
                className="h-12 w-auto object-contain"
              />
            </div>
            <div className="hidden leading-tight sm:block">
              <div className="text-sm font-black uppercase tracking-[0.18em] text-[#7a0000]">
                Betech Agents
              </div>
              <div className="text-xs text-slate-500">Solar sales network</div>
            </div>
          </Link>

          <nav className="hidden items-center gap-6 text-sm font-semibold text-slate-700 lg:flex">
            <a href="#home" className="transition hover:text-[#7a0000]">Home</a>
            <a href="#how-it-works" className="transition hover:text-[#7a0000]">How It Works</a>
            <a href="#benefits" className="transition hover:text-[#7a0000]">Benefits</a>
            <a href="#products" className="transition hover:text-[#7a0000]">Products</a>
            <a href="#earnings" className="transition hover:text-[#7a0000]">Earnings</a>
            <a href="#faqs" className="transition hover:text-[#7a0000]">FAQs</a>
            <a href="#contact" className="transition hover:text-[#7a0000]">Contact</a>
          </nav>

          <AgentStorefrontAuthActions
            dashboardHref={dashboardHref}
            loginHref={otpHref}
            homeHref={homeHref}
            loggedIn={isLoggedInAgent}
          />
        </header>

        <section
          id="home"
          className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-stretch lg:gap-8"
        >
          <div className="space-y-6">
            <div className="rounded-[2rem] border border-[#7a0000]/10 bg-[linear-gradient(180deg,#fff9ef_0%,#ffffff_100%)] p-5 shadow-[0_28px_70px_rgba(122,0,0,0.10)] sm:p-7">
              <div className="inline-flex rounded-full border border-[#f2b20f]/30 bg-[#fff3d8] px-4 py-2 text-xs font-black uppercase tracking-[0.24em] text-[#7a0000]">
                BETECH AGENTS
              </div>
              <h1 className="mt-5 max-w-2xl text-3xl font-black leading-tight text-slate-950 sm:text-4xl md:text-5xl">
                Earn commission by referring solar customers across Kenya.
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
                Share Betech Solar products, submit customer orders, and earn 6% commission after successful delivery and payment.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <Link href={productsHref} className={shopStyles.primaryButton}>
                  Browse products
                </Link>
                <Link href={dashboardHref} className={shopStyles.secondaryButton}>
                  Track commissions
                </Link>
              </div>

              <div className="mt-6 hidden gap-3 sm:mt-8 sm:gap-4 md:grid md:grid-cols-2">
                {productHighlights.map((item) => (
                  <div
                    key={item.title}
                    className={`rounded-[1.6rem] border p-4 shadow-[0_16px_34px_rgba(15,23,42,0.06)] transition duration-300 hover:-translate-y-1 sm:p-5 ${
                      item.tone === "gold"
                        ? "border-[#f2b20f]/25 bg-[linear-gradient(180deg,#fff5de_0%,#fffdfa_100%)]"
                        : "border-[#7a0000]/12 bg-[linear-gradient(180deg,#fff8f5_0%,#ffffff_100%)]"
                    }`}
                  >
                    <div
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.18em] ${
                        item.tone === "gold"
                          ? "bg-[#f2b20f] text-slate-950"
                          : "bg-[#7a0000] text-white"
                      }`}
                    >
                      Opportunity
                    </div>
                    <div className="mt-4 text-xl font-black text-slate-950 sm:text-2xl">
                      {item.title}
                    </div>
                    <div className="mt-2 text-sm leading-7 text-slate-600">{item.copy}</div>
                  </div>
                ))}
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3 sm:mt-8 sm:gap-4 sm:grid-cols-4">
                {trustPoints.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.label}
                      className="rounded-[1.4rem] border border-[#7a0000]/8 bg-white px-4 py-4 text-center shadow-[0_12px_26px_rgba(15,23,42,0.05)]"
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
          </div>

          <div className="space-y-6">
            <div className="rounded-[2rem] border border-[#7a0000]/10 bg-[linear-gradient(180deg,#fff9ef_0%,#ffffff_100%)] p-5 shadow-[0_32px_80px_rgba(122,0,0,0.12)] sm:p-8">
              <div className="inline-flex rounded-full bg-[#fff3d8] px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-[#7a0000]">
                Agent portal
              </div>
              <h2 className="mt-5 text-3xl font-black leading-tight sm:text-4xl">
                Submit real customer orders and track referrals from one dashboard.
              </h2>
              <p className="mt-4 text-base leading-8 text-slate-600">
                Existing agents continue with OTP and go straight to the dashboard. New agents can sign in with phone or email OTP and complete their profile without passwords.
              </p>

              <div className="mt-8 grid gap-4 sm:grid-cols-3">
                <div className="rounded-[1.6rem] border border-[#7a0000]/10 bg-white px-4 py-4 shadow-[0_12px_26px_rgba(15,23,42,0.05)]">
                  <div className="text-xs font-black uppercase tracking-[0.16em] text-[#7a0000]">
                    Live products
                  </div>
                  <div className="mt-2 text-3xl font-black text-slate-950">
                    {sortedProducts.length}
                  </div>
                </div>
                <div className="rounded-[1.6rem] border border-[#7a0000]/10 bg-white px-4 py-4 shadow-[0_12px_26px_rgba(15,23,42,0.05)]">
                  <div className="text-xs font-black uppercase tracking-[0.16em] text-[#7a0000]">
                    Featured products
                  </div>
                  <div className="mt-2 text-3xl font-black text-slate-950">
                    {featuredProducts.length}
                  </div>
                </div>
                <div className="rounded-[1.6rem] border border-[#f2b20f]/20 bg-[#fff8e8] px-4 py-4 shadow-[0_12px_26px_rgba(242,178,15,0.10)]">
                  <div className="text-xs font-black uppercase tracking-[0.16em] text-[#7a0000]">
                    Commission visible
                  </div>
                  <div className="mt-2 text-3xl font-black text-slate-950">
                    {totalCommissionVisible}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[2rem] border border-[#7a0000]/10 bg-[linear-gradient(180deg,#7a0000_0%,#4d0000_100%)] p-5 text-white shadow-[0_30px_70px_rgba(122,0,0,0.18)] sm:p-6">
              <div className="inline-flex rounded-full bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-[#ffd761]">
                Why agents stay
              </div>
              <h2 className="mt-5 text-2xl font-black leading-tight sm:text-3xl">
                Betech handles fulfilment while you focus on closing customers.
              </h2>
              <p className="mt-4 text-base leading-8 text-white/75">
                Refer products, submit paid orders, and let the Betech team manage logistics, support, and post-sale follow-up.
              </p>
              <div className="mt-8 space-y-4">
                {[
                  "Premium solar products customers already need",
                  "Warm leads from homes, farms, and businesses",
                  "Fast M-Pesa withdrawals after completed sales",
                ].map((line) => (
                  <div
                    key={line}
                    className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/6 px-4 py-4"
                  >
                    <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#ffd761]" />
                    <div className="text-sm leading-7 text-white/85">{line}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="py-8 sm:py-10">
          <div className="rounded-[2rem] border border-[#7a0000]/10 bg-white p-5 shadow-[0_24px_50px_rgba(15,23,42,0.06)] sm:p-7">
            <div className="inline-flex rounded-full border border-[#f2b20f]/30 bg-[#fff3d8] px-4 py-2 text-xs font-black uppercase tracking-[0.24em] text-[#7a0000]">
              How It Works
            </div>
            <h2 className="mt-5 text-3xl font-black tracking-tight text-slate-950">
              Simple flow from product sharing to commission payout
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

        <section id="benefits" className="py-2 sm:py-4">
          <div className="grid gap-5 md:grid-cols-3">
            <div className="rounded-[2rem] border border-[#7a0000]/10 bg-white p-5 shadow-[0_24px_50px_rgba(15,23,42,0.06)]">
              <ShieldCheck className="h-8 w-8 text-[#7a0000]" />
              <h3 className="mt-4 text-2xl font-black text-slate-950">Trusted Betech brand</h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                Sell against a recognised solar brand with products customers already see on betech.co.ke.
              </p>
            </div>
            <div className="rounded-[2rem] border border-[#7a0000]/10 bg-white p-5 shadow-[0_24px_50px_rgba(15,23,42,0.06)]">
              <CircleDollarSign className="h-8 w-8 text-[#7a0000]" />
              <h3 className="mt-4 text-2xl font-black text-slate-950">Clear commission visibility</h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                Every product card shows earnings potential so you can pitch accurately and prioritize high-value referrals.
              </p>
            </div>
            <div className="rounded-[2rem] border border-[#7a0000]/10 bg-white p-5 shadow-[0_24px_50px_rgba(15,23,42,0.06)]">
              <Headphones className="h-8 w-8 text-[#7a0000]" />
              <h3 className="mt-4 text-2xl font-black text-slate-950">Support handled centrally</h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                Customer support, dispatch, installation, and payment confirmation remain inside the Betech operations flow.
              </p>
            </div>
          </div>
        </section>

        <section id="products" className="py-8 sm:py-10">
          <div className="rounded-[2rem] border border-[#7a0000]/10 bg-white p-5 shadow-[0_24px_50px_rgba(15,23,42,0.06)] sm:p-7">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="inline-flex rounded-full border border-[#f2b20f]/30 bg-[#fff3d8] px-4 py-2 text-xs font-black uppercase tracking-[0.24em] text-[#7a0000]">
                  Products
                </div>
                <h2 className="mt-5 text-3xl font-black tracking-tight text-slate-950">
                  Live products ready for referral or direct order capture
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

        <section id="earnings" className="py-2 sm:py-4">
          <div className="grid gap-5 lg:grid-cols-3">
            {solarKitProducts.length ? (
              <div className="rounded-[2rem] border border-[#7a0000]/10 bg-white p-5 shadow-[0_24px_50px_rgba(15,23,42,0.06)]">
                <div className="text-xs font-black uppercase tracking-[0.2em] text-[#7a0000]">
                  Solar full kits
                </div>
                <div className="mt-3 space-y-3 text-sm text-slate-700">
                  {solarKitProducts.map((product) => (
                    <div key={product.id} className="rounded-2xl border border-[#7a0000]/8 bg-[#fcfaf7] px-4 py-3">
                      <div className="font-bold text-slate-950">{product.name}</div>
                      <div className="mt-1 text-[#7a0000]">
                        Commission visible: {getAgentCommissionValue(product) > 0 ? "Yes" : "Review required"}
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
                    <div key={product.id} className="rounded-2xl border border-[#7a0000]/8 bg-[#fcfaf7] px-4 py-3">
                      <div className="font-bold text-slate-950">{product.name}</div>
                      <div className="mt-1 text-slate-600">Best for backup and lithium upgrades.</div>
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
                    <div key={product.id} className="rounded-2xl border border-[#7a0000]/8 bg-[#fcfaf7] px-4 py-3">
                      <div className="font-bold text-slate-950">{product.name}</div>
                      <div className="mt-1 text-slate-600">Good for farms, boreholes, and irrigation referrals.</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </section>

        <section id="faqs" className="py-8 sm:py-10">
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

        <section id="contact" className="py-2 sm:py-4">
          <div className="rounded-[2rem] border border-[#7a0000]/10 bg-[linear-gradient(180deg,#fff9ef_0%,#ffffff_100%)] p-5 shadow-[0_24px_50px_rgba(15,23,42,0.06)] sm:p-7">
            <div className="inline-flex rounded-full border border-[#f2b20f]/30 bg-[#fff3d8] px-4 py-2 text-xs font-black uppercase tracking-[0.24em] text-[#7a0000]">
              Contact
            </div>
            <h2 className="mt-5 text-3xl font-black tracking-tight text-slate-950">
              Need help before sending a customer?
            </h2>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div className="rounded-[1.6rem] border border-[#7a0000]/10 bg-white px-5 py-4">
                <div className="text-xs font-black uppercase tracking-[0.18em] text-[#7a0000]">Phone</div>
                <div className="mt-2 text-lg font-bold text-slate-950">0722 151 083</div>
                <div className="mt-1 text-sm text-slate-600">Main Betech Solar support line</div>
              </div>
              <div className="rounded-[1.6rem] border border-[#7a0000]/10 bg-white px-5 py-4">
                <div className="text-xs font-black uppercase tracking-[0.18em] text-[#7a0000]">Alternative line</div>
                <div className="mt-2 text-lg font-bold text-slate-950">0703 241 917</div>
                <div className="mt-1 text-sm text-slate-600">Use for delivery and product follow-up</div>
              </div>
              <div className="rounded-[1.6rem] border border-[#7a0000]/10 bg-white px-5 py-4">
                <div className="text-xs font-black uppercase tracking-[0.18em] text-[#7a0000]">Email</div>
                <div className="mt-2 text-lg font-bold text-slate-950">info@betech.co.ke</div>
                <div className="mt-1 text-sm text-slate-600">For quotation, operations, and customer support</div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <AgentWhatsAppFloat />
    </div>
  );
}
