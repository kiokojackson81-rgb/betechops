import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  BadgeCheck,
  Banknote,
  CircleDollarSign,
  Headphones,
  House,
  MessageCircleMore,
  MapPinned,
  PanelsTopLeft,
  PhoneCall,
  PlayCircle,
  ShieldCheck,
  Sparkles,
  ShoppingBag,
  ClipboardList,
  Truck,
  Users,
} from "lucide-react";
import AnimatedCount from "@/app/agents/_components/AnimatedCount";
import { agentPath } from "@/lib/agents/host";

const steps = [
  {
    number: "1",
    title: "Refer Customer",
    copy: "Share Betech products online or through your local network.",
    icon: MessageCircleMore,
    tone: "gold",
  },
  {
    number: "2",
    title: "Submit Order",
    copy: "Enter customer and product details in your agent dashboard.",
    icon: ClipboardList,
    tone: "maroon",
  },
  {
    number: "3",
    title: "Betech Delivers",
    copy: "We handle delivery, installation, and customer support.",
    icon: Truck,
    tone: "gold",
  },
  {
    number: "4",
    title: "You Earn",
    copy: "Receive your 6% commission after successful payment and delivery.",
    icon: Sparkles,
    tone: "maroon",
    featured: true,
  },
];

const agentProducts = [
  { name: "SRNE 20KW Lithium Solar System", price: 950000, image: "/agents/products/srne-20kw-lithium-solar-system.jpeg", category: "Solar Kit" },
  { name: "SRNE 10KW Lithium Solar Power System", price: 550000, image: "/agents/products/srne-10kw-lithium-solar-power-system.jpeg", category: "Solar Kit" },
  { name: "8KW Lithium Battery Kit", price: 350000, image: "/agents/products/8kw-lithium-battery-kit.jpeg", category: "Battery Kit" },
  { name: "SRNE 5KW Lithium Solar System", price: 280000, image: "/agents/products/srne-5kw-lithium-solar-system.jpeg", category: "Solar Kit" },
  { name: "SRNE 3KW Lithium Solar System", price: 180000, image: "/agents/products/srne-3kw-lithium-solar-system.jpeg", category: "Solar Kit" },
  { name: "4KW Lithium Solar Kit", price: 90000, image: "/agents/products/4kw-lithium-solar-kit.jpeg", category: "Solar Kit" },
  { name: "2KW Lithium Powerstation", price: 86400, image: "/agents/products/2kw-lithium-powerstation.jpeg", category: "Power Station" },
  { name: "Platinum 2.56KW Lithium Solar Kit", price: 70000, image: "/agents/products/platinum-2-56kw-lithium-solar-kit.jpeg", category: "Solar Kit" },
  { name: "Platinum 1.28KW Lithium Solar Kit", price: 49000, image: "/agents/products/platinum-1-28kw-lithium-solar-kit.jpeg", category: "Solar Kit" },
  { name: "Starmax 300W Full Kit", price: 38999, image: "/agents/products/starmax-300w-full-kit.jpeg", category: "Starter Kit" },
  { name: "Starmax 250W Full Kit", price: 27500, image: "/agents/products/starmax-250w-full-kit.jpeg", category: "Starter Kit" },
  { name: "Starmax 200W Full Kit", price: 21999, image: "/agents/products/starmax-200w-full-kit.jpeg", category: "Starter Kit" },
  { name: "Starmax 150W Full Kit", price: 19999, image: "/agents/products/starmax-150w-full-kit.jpeg", category: "Starter Kit" },
  { name: "Starmax 100W Full Kit", price: 13000, image: "/agents/products/starmax-100w-full-kit.jpeg", category: "Starter Kit" },
];

const benefits = [
  {
    title: "Trusted Brand",
    copy: "A leading solar company with thousands of satisfied customers.",
    icon: ShieldCheck,
    tone: "gold",
  },
  {
    title: "Genuine Products",
    copy: "We deal with top global brands for quality and reliability.",
    icon: BadgeCheck,
    tone: "maroon",
  },
  {
    title: "Full Support",
    copy: "We handle installation, after-sales support and warranty.",
    icon: Headphones,
    tone: "gold",
  },
  {
    title: "Marketing Materials",
    copy: "Get posters, videos, catalogs and content to help you sell more.",
    icon: PanelsTopLeft,
    tone: "maroon",
  },
  {
    title: "Fast Payouts",
    copy: "Withdraw your earnings directly to M-Pesa quickly and securely.",
    icon: Banknote,
    tone: "gold",
  },
  {
    title: "Nationwide Opportunities",
    copy: "Work from anywhere in Kenya. No boundaries.",
    icon: MapPinned,
    tone: "maroon",
  },
];

const activityFeed = [
  "Kisumu agent earned Ksh 12,500",
  "Nakuru agent submitted a solar kit order",
  "Kitui agent earned Ksh 21,000",
  "Eldoret agent payout processed via M-Pesa",
  "Mombasa agent referred a water pump customer",
  "Nyeri agent completed a battery order",
];

const joinAudience = [
  "WhatsApp Marketers",
  "Hardware Shops",
  "Electronics Shops",
  "Solar Technicians",
  "Installers",
  "TikTok/Facebook Creators",
  "Rural Field Agents",
  "Existing Betech Customers",
];

const kenyaOpportunity = [
  "High demand for backup power",
  "Solar water pumps for farms",
  "Homes need reliable lighting",
  "Businesses need power security",
  "Rural areas need affordable energy",
  "Customers trust local recommendations",
];

const brands = [
  { name: "SolarMax", style: "solarmax" },
  { name: "SRNE", style: "srne" },
  { name: "MUST", style: "must" },
  { name: "Felicity Solar", style: "felicity" },
  { name: "ALLTOP ELECTRONICS", style: "alltop" },
  { name: "Deye", style: "deye" },
  { name: "Growatt", style: "growatt" },
  { name: "Jinko Solar", style: "jinko" },
  { name: "JA Solar", style: "ja" },
];

const testimonials = [
  {
    name: "James O.",
    location: "Kisumu",
    quote: "I started referring customers through WhatsApp and now earn extra monthly income without leaving my main work.",
    accent: "from-[#7a0000] to-[#a11d1d]",
    image: "/agents/testimonial-james-generated.png",
  },
  {
    name: "Mercy W.",
    location: "Nakuru",
    quote: "The system is simple. I submit the customer, Betech handles delivery and installation, then I track my commission.",
    accent: "from-[#f3b205] to-[#ffd761]",
    image: "/agents/testimonial-mercy-generated.png",
  },
  {
    name: "Brian K.",
    location: "Eldoret",
    quote: "Fast payouts and genuine products make it easy to build trust with customers and keep referrals growing.",
    accent: "from-[#163b3d] to-[#2d7377]",
    image: "/agents/testimonial-brian-generated.png",
  },
];

type AgentsLandingPageProps = {
  useRootPaths?: boolean;
};

function trustPoint(label: string, note: string) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[#7a0000]/10 bg-white px-4 py-3 shadow-[0_12px_30px_rgba(122,0,0,0.06)]">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#fff3d8] text-[#7a0000]">
        <BadgeCheck className="h-5 w-5" />
      </span>
      <div>
        <div className="text-sm font-semibold text-slate-950">{label}</div>
        <div className="text-xs text-slate-500">{note}</div>
      </div>
    </div>
  );
}

function heroCard(label: string, value: string, note: string) {
  return (
    <div className="rounded-[24px] border border-white/60 bg-white/92 p-4 shadow-[0_24px_60px_rgba(0,0,0,0.10)] backdrop-blur transition duration-300 hover:-translate-y-1 hover:shadow-[0_32px_80px_rgba(0,0,0,0.14)]">
      <div className="text-[11px] font-semibold uppercase tracking-[0.26em] text-[#7a0000]/70">{label}</div>
      <div className="mt-2 text-2xl font-black text-slate-950">{value}</div>
      <div className="mt-1 text-sm text-slate-500">{note}</div>
    </div>
  );
}

function sectionTitle(title: string, copy?: string, dark = false) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <div className="mx-auto h-1 w-16 rounded-full bg-gradient-to-r from-[#f2b20f] to-[#7a0000]" />
      <h2 className={`mt-5 text-3xl font-black tracking-tight md:text-5xl ${dark ? "text-white" : "text-slate-950"}`}>{title}</h2>
      {copy ? <p className={`mt-4 text-base leading-7 ${dark ? "text-white/75" : "text-slate-600"}`}>{copy}</p> : null}
    </div>
  );
}

function formatCurrency(value: number) {
  return `Ksh ${value.toLocaleString()}`;
}

function BrandWordmark({ style, name }: { style: string; name: string }) {
  if (style === "solarmax") {
    return (
      <div className="flex items-center gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#e53935] text-sm font-black text-white">◎</span>
        <span className="text-[2rem] font-semibold tracking-tight text-slate-700">SolarMax</span>
      </div>
    );
  }
  if (style === "srne") {
    return (
      <div className="flex items-center gap-3">
        <span className="relative h-8 w-8 overflow-hidden rounded-full bg-[#ff8f1f]">
          <span className="absolute inset-y-0 left-1/2 w-[0.35rem] -translate-x-1/2 rotate-45 bg-white" />
        </span>
        <span className="text-[2.1rem] font-black tracking-tight text-slate-800">SRNE</span>
      </div>
    );
  }
  if (style === "must") {
    return <span className="text-[2.4rem] font-black uppercase tracking-tight text-[#f2352c]">MUST</span>;
  }
  if (style === "felicity") {
    return (
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f28c28] text-xl font-black text-white">F</span>
        <span className="text-[1.9rem] tracking-tight text-slate-500">
          <span className="font-semibold text-slate-600">Felicity</span>
          <span className="ml-1 text-slate-400">solar</span>
        </span>
      </div>
    );
  }
  if (style === "alltop") {
    return (
      <div className="flex flex-col items-start leading-none">
        <span className="border-t-[0.35rem] border-[#e6362d] pt-1 text-[1.65rem] font-black uppercase tracking-tight text-[#e6362d]">ALLTOP</span>
        <span className="text-[0.95rem] font-semibold uppercase tracking-[0.12em] text-slate-600">Electronics</span>
      </div>
    );
  }
  if (style === "deye") {
    return <span className="text-[2.25rem] font-black tracking-tight text-[#1f6fd1]">Deye</span>;
  }
  if (style === "growatt") {
    return <span className="text-[2.15rem] font-semibold tracking-tight text-[#73b63f]">Growatt</span>;
  }
  if (style === "jinko") {
    return (
      <span className="text-[2.15rem] italic tracking-tight text-[#45a930]">
        <span className="font-semibold">Jinko</span> <span className="text-[1.3rem]">Solar</span>
      </span>
    );
  }
  if (style === "ja") {
    return <span className="text-[2.1rem] font-semibold tracking-tight text-[#2b5fb8]">JA SOLAR</span>;
  }
  return <span className="text-[2rem] font-semibold text-slate-700">{name}</span>;
}

export default function AgentsLandingPage({ useRootPaths = false }: AgentsLandingPageProps) {
  const registerHref = agentPath("/register", useRootPaths);
  const loginHref = agentPath("/login", useRootPaths);

  return (
    <div className="scroll-smooth bg-[#fcfaf7] text-slate-950">
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes float {
              0%, 100% { transform: translateY(0); }
              50% { transform: translateY(-8px); }
            }

            @keyframes marquee {
              0% { transform: translateX(0); }
              100% { transform: translateX(-50%); }
            }

            @keyframes productMarquee {
              0% { transform: translateX(0); }
              100% { transform: translateX(-50%); }
            }

            .product-marquee {
              animation: productMarquee 46s linear infinite;
            }

            .product-marquee:hover {
              animation-play-state: paused;
            }
          `,
        }}
      />
      <header className="sticky top-0 z-40 border-b border-[#7a0000]/10 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link href={agentPath("/", useRootPaths)} className="flex items-center gap-3">
            <div className="overflow-hidden rounded-2xl border border-[#7a0000]/10 bg-white shadow-[0_16px_30px_rgba(122,0,0,0.12)]">
              <Image src="/agents/betech-logo-crop.png" alt="Betech Solar Solutions" width={58} height={58} className="h-12 w-12 object-contain" />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-black uppercase tracking-[0.18em] text-[#7a0000]">Betech Solar</div>
              <div className="text-xs text-slate-500">Solutions Kenya</div>
            </div>
          </Link>

          <nav className="hidden items-center gap-7 text-sm font-medium text-slate-700 lg:flex">
            <a href="#home" className="transition hover:text-[#7a0000]">Home</a>
            <a href="#how-it-works" className="transition hover:text-[#7a0000]">How It Works</a>
            <a href="#benefits" className="transition hover:text-[#7a0000]">Benefits</a>
            <a href="#products" className="transition hover:text-[#7a0000]">Products</a>
            <a href="#earnings" className="transition hover:text-[#7a0000]">Earnings</a>
            <a href="#faqs" className="transition hover:text-[#7a0000]">FAQs</a>
            <a href="#contact" className="transition hover:text-[#7a0000]">Contact</a>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href={loginHref}
              className="hidden rounded-2xl border border-[#7a0000]/20 px-4 py-3 text-sm font-semibold text-[#7a0000] transition hover:-translate-y-0.5 hover:border-[#7a0000]/40 hover:shadow-[0_16px_30px_rgba(122,0,0,0.10)] sm:inline-flex"
            >
              Sign In
            </Link>
            <Link
              href={registerHref}
              className="inline-flex rounded-2xl bg-[#7a0000] px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_35px_rgba(122,0,0,0.20)] transition hover:-translate-y-0.5 hover:bg-[#5f0000] hover:shadow-[0_24px_45px_rgba(122,0,0,0.25)]"
            >
              Become an Agent
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section id="home" className="relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(242,178,15,0.18),transparent_28%),radial-gradient(circle_at_80%_20%,rgba(122,0,0,0.10),transparent_24%),linear-gradient(180deg,#fffdf9_0%,#fff7ef_100%)]" />
          <div className="relative mx-auto grid max-w-7xl gap-12 px-4 pb-14 pt-10 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:pb-20 lg:pt-16">
            <div className="flex flex-col justify-center">
              <div className="inline-flex w-fit rounded-full border border-[#f2b20f]/30 bg-[#fff3d8] px-4 py-2 text-xs font-black uppercase tracking-[0.24em] text-[#7a0000] shadow-[0_12px_24px_rgba(242,178,15,0.18)]">
                Betech Agents Program
              </div>
              <h1 className="mt-6 max-w-3xl text-5xl font-black leading-[0.95] tracking-tight text-slate-950 sm:text-6xl lg:text-7xl">
                Earn Money By <span className="text-[#7a0000]">Referring Solar</span> Customers <span className="text-[#f2b20f]">☀️</span>
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
                Join the Betech Solar Agents Program, refer customers, and earn up to <span className="font-bold text-[#7a0000]">6% commission</span> on successful solar sales across Kenya.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Link
                  href={registerHref}
                  className="inline-flex min-h-[3.75rem] items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#11b86a_0%,#0f9d58_55%,#0b7c44_100%)] px-7 py-4 text-base font-bold text-white shadow-[0_20px_50px_rgba(15,157,88,0.30)] transition hover:-translate-y-0.5 hover:shadow-[0_28px_60px_rgba(15,157,88,0.36)]"
                >
                  Become an Agent
                </Link>
                <Link
                  href={loginHref}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#7a0000]/18 bg-white px-6 py-4 text-base font-bold text-slate-950 shadow-[0_14px_30px_rgba(15,23,42,0.05)] transition hover:-translate-y-0.5 hover:border-[#7a0000]/35"
                >
                  Sign In
                </Link>
                <a
                  href="#how-it-works"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#f2b20f] px-6 py-4 text-base font-bold text-slate-950 shadow-[0_18px_40px_rgba(242,178,15,0.22)] transition hover:-translate-y-0.5 hover:shadow-[0_24px_50px_rgba(242,178,15,0.30)]"
                >
                  <PlayCircle className="h-5 w-5" />
                  How It Works
                </a>
              </div>

              <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {trustPoint("100% Free To Join", "No fees")}
                {trustPoint("No Targets", "Refer at your pace")}
                {trustPoint("Earn 6% Commission", "On successful sales")}
                {trustPoint("Fast M-Pesa Withdrawals", "Simple and secure")}
              </div>
            </div>

            <div className="relative">
              <div className="absolute -left-4 top-10 h-40 w-40 rounded-full bg-[#f2b20f]/20 blur-3xl" />
              <div className="absolute right-0 top-0 h-48 w-48 rounded-full bg-[#7a0000]/14 blur-3xl" />
              <div className="absolute left-2 top-8 z-10 hidden max-w-[13rem] rounded-[24px] border border-white/70 bg-white/92 p-4 shadow-[0_22px_50px_rgba(0,0,0,0.12)] backdrop-blur md:block animate-[float_6s_ease-in-out_infinite]">
                <div className="text-[11px] font-black uppercase tracking-[0.26em] text-[#7a0000]/70">Commission Alert</div>
                <div className="mt-2 text-2xl font-black text-[#0f9d58]">+Ksh 12,000</div>
                <div className="mt-1 text-sm text-slate-500">Solar kit sale completed</div>
              </div>
              <div className="absolute right-4 top-12 z-10 hidden max-w-[12rem] rounded-[24px] border border-white/70 bg-white/92 p-4 shadow-[0_22px_50px_rgba(0,0,0,0.12)] backdrop-blur lg:block animate-[float_7s_ease-in-out_infinite]">
                <div className="text-[11px] font-black uppercase tracking-[0.26em] text-[#7a0000]/70">New Customer Order</div>
                <div className="mt-2 text-xl font-black text-slate-950">SRNE 5KW Kit</div>
                <div className="mt-1 text-sm text-slate-500">Ready for confirmation</div>
              </div>
              <div className="absolute bottom-28 left-6 z-10 hidden max-w-[12rem] rounded-[24px] border border-white/70 bg-white/92 p-4 shadow-[0_22px_50px_rgba(0,0,0,0.12)] backdrop-blur md:block animate-[float_8s_ease-in-out_infinite]">
                <div className="text-[11px] font-black uppercase tracking-[0.26em] text-[#7a0000]/70">M-Pesa Payout Ready</div>
                <div className="mt-2 text-xl font-black text-slate-950">Ksh 8,400</div>
                <div className="mt-1 text-sm text-slate-500">Withdraw after approval</div>
              </div>
              <div className="absolute bottom-16 right-4 z-10 hidden max-w-[10rem] rounded-[24px] border border-white/70 bg-white/92 p-4 shadow-[0_22px_50px_rgba(0,0,0,0.12)] backdrop-blur sm:block animate-[float_5.5s_ease-in-out_infinite]">
                <div className="text-[11px] font-black uppercase tracking-[0.26em] text-[#7a0000]/70">Earn Up To</div>
                <div className="mt-2 text-3xl font-black text-[#7a0000]">6%</div>
                <div className="mt-1 text-sm text-slate-500">On successful sales</div>
              </div>
              <div className="relative overflow-hidden rounded-[36px] border border-white/70 bg-[linear-gradient(160deg,#fff_0%,#fff7ef_45%,#fff0dc_100%)] p-5 shadow-[0_35px_90px_rgba(122,0,0,0.16)] sm:p-7">
                <div className="rounded-[30px] border border-white/70 bg-[radial-gradient(circle_at_top,#fffaf1_0%,#fff_44%,#fff6ea_100%)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] sm:p-5">
                  <div className="overflow-hidden rounded-[28px] border border-[#7a0000]/10 bg-white shadow-[0_24px_60px_rgba(122,0,0,0.14)]">
                    <Image
                      src="/agents/hero-generated-v2.png"
                      alt="Betech Solar agent holding a phone with earnings dashboard in front of a solar home"
                      width={425}
                      height={704}
                      className="h-auto w-full object-cover object-center"
                      priority
                    />
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    {heroCard("Solar Leads", "Daily", "Homes, farms, and businesses")}
                    {heroCard("Fast Payout", "M-Pesa", "Withdraw when commissions are ready")}
                    {heroCard("Top Agents", "100K+", "Monthly income potential")}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-[#7a0000]/10 bg-white py-4">
          <div className="mx-auto flex max-w-7xl items-center gap-4 overflow-hidden px-4 sm:px-6 lg:px-8">
            <div className="shrink-0 rounded-full bg-[#fff3d8] px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-[#7a0000]">
              Recent Agent Activity
            </div>
            <div className="flex min-w-0 flex-1 overflow-hidden">
              <div className="flex min-w-max animate-[marquee_28s_linear_infinite] gap-3">
                {[...activityFeed, ...activityFeed].map((item, index) => (
                  <div
                    key={`${item}-${index}`}
                    className="rounded-full border border-[#7a0000]/10 bg-[#fcfaf7] px-4 py-2 text-sm font-medium text-slate-700 shadow-[0_10px_24px_rgba(15,23,42,0.04)]"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section
          id="how-it-works"
          className="bg-[radial-gradient(circle_at_top,rgba(242,178,15,0.10),transparent_24%),linear-gradient(180deg,#fffefb_0%,#fff7ef_100%)] py-20"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            {sectionTitle("How It Works", "Refer customers, submit orders, and earn commission in four simple steps.")}
            <div className="mt-14 hidden xl:block">
              <div className="relative grid grid-cols-4 gap-5">
                <div className="pointer-events-none absolute left-[12%] right-[12%] top-[8.3rem] h-[2px] bg-gradient-to-r from-[#f2b20f]/30 via-[#7a0000]/22 to-[#f2b20f]/30" />
                <div className="pointer-events-none absolute left-[12%] right-[12%] top-[7.55rem] h-6 bg-[radial-gradient(circle_at_center,rgba(242,178,15,0.18),transparent_70%)] blur-xl" />
                {steps.map((step, index) => {
                  const Icon = step.icon;
                  const isGold = step.tone === "gold";
                  const isFeatured = Boolean(step.featured);
                  return (
                    <div key={step.title} className={`relative ${isFeatured ? "xl:-mt-4" : ""}`}>
                      <div
                        className={`group relative h-full overflow-hidden rounded-[2rem] border p-6 shadow-lg transition duration-300 hover:-translate-y-1 ${
                          isFeatured
                            ? "border-[#f2b20f]/35 bg-[linear-gradient(180deg,#fff8e7_0%,#ffffff_100%)] shadow-[0_30px_70px_rgba(242,178,15,0.18)]"
                            : "border-[#7a0000]/10 bg-white/75 shadow-[0_18px_45px_rgba(15,23,42,0.06)] backdrop-blur"
                        }`}
                      >
                        <div className={`absolute inset-x-8 top-[6.2rem] h-px ${isFeatured ? "bg-[#f2b20f]/28" : "bg-transparent"}`} />
                        <div className="flex items-start justify-between gap-4 pt-5">
                          <div className="relative">
                            <div className={`absolute inset-0 rounded-[1.6rem] blur-xl ${isGold ? "bg-[#f2b20f]/28" : "bg-[#7a0000]/20"}`} />
                            <div
                              className={`relative flex h-[5.6rem] w-[5.6rem] items-center justify-center rounded-[1.6rem] border shadow-[0_18px_34px_rgba(0,0,0,0.10)] ${
                                isGold
                                  ? "border-[#f2b20f]/30 bg-[linear-gradient(180deg,#ffe8a8_0%,#ffc741_100%)] text-[#7a0000]"
                                  : "border-[#7a0000]/20 bg-[linear-gradient(180deg,#941010_0%,#6d0000_100%)] text-white"
                              }`}
                            >
                              <Icon className="h-9 w-9" />
                            </div>
                          </div>
                          {index < steps.length - 1 ? (
                            <div className="mt-5 flex items-center gap-2 text-[#7a0000]/45">
                              <div className="h-[2px] w-10 bg-gradient-to-r from-[#7a0000]/15 to-[#7a0000]/45" />
                              <ArrowRight className="h-6 w-6 animate-pulse" />
                            </div>
                          ) : null}
                        </div>

                        <h3 className={`mt-5 text-[2rem] font-black tracking-tight ${isFeatured ? "text-[#7a0000]" : "text-slate-950"}`}>{step.title}</h3>
                        <p className="mt-3 max-w-[17rem] text-lg leading-8 text-slate-600">{step.copy}</p>
                        {isFeatured ? (
                          <div className="mt-6 inline-flex rounded-full bg-[#7a0000] px-4 py-2 text-sm font-black uppercase tracking-[0.18em] text-[#ffd761] shadow-[0_14px_30px_rgba(122,0,0,0.20)]">
                            6% Commission Unlock
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-14 space-y-5 xl:hidden">
              {steps.map((step, index) => {
                const Icon = step.icon;
                const isGold = step.tone === "gold";
                const isFeatured = Boolean(step.featured);
                return (
                  <div key={step.title} className="relative">
                    <div
                      className={`group relative overflow-hidden rounded-[2rem] border p-5 shadow-lg transition duration-300 hover:-translate-y-1 ${
                        isFeatured
                          ? "border-[#f2b20f]/35 bg-[linear-gradient(180deg,#fff8e7_0%,#ffffff_100%)] shadow-[0_26px_55px_rgba(242,178,15,0.16)]"
                          : "border-[#7a0000]/10 bg-white/80 shadow-[0_18px_40px_rgba(15,23,42,0.06)] backdrop-blur"
                      }`}
                    >
                      <div className="flex items-start gap-4 pt-5">
                        <div className="relative shrink-0">
                          <div className={`absolute inset-0 rounded-[1.35rem] blur-xl ${isGold ? "bg-[#f2b20f]/28" : "bg-[#7a0000]/20"}`} />
                          <div
                            className={`relative flex h-[4.8rem] w-[4.8rem] items-center justify-center rounded-[1.35rem] border shadow-[0_16px_30px_rgba(0,0,0,0.10)] ${
                              isGold
                                ? "border-[#f2b20f]/30 bg-[linear-gradient(180deg,#ffe8a8_0%,#ffc741_100%)] text-[#7a0000]"
                                : "border-[#7a0000]/20 bg-[linear-gradient(180deg,#941010_0%,#6d0000_100%)] text-white"
                            }`}
                          >
                            <Icon className="h-8 w-8" />
                          </div>
                        </div>
                        <div className="min-w-0">
                          <h3 className={`text-2xl font-black tracking-tight ${isFeatured ? "text-[#7a0000]" : "text-slate-950"}`}>{step.title}</h3>
                          <p className="mt-2 text-base leading-7 text-slate-600">{step.copy}</p>
                          {isFeatured ? (
                            <div className="mt-4 inline-flex rounded-full bg-[#7a0000] px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-[#ffd761]">
                              6% Commission Unlock
                            </div>
                          ) : null}
                        </div>
                      </div>

                    </div>
                    {index < steps.length - 1 ? (
                      <div className="pointer-events-none mx-auto mt-4 flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#7a0000]/45 shadow-[0_14px_26px_rgba(15,23,42,0.08)]">
                        <ArrowRight className="h-5 w-5 rotate-90" />
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="bg-[linear-gradient(135deg,#4a0000_0%,#7a0000_45%,#a51e0f_100%)] py-18 text-white">
          <div className="mx-auto grid max-w-7xl gap-8 rounded-[38px] px-4 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:px-8">
            <div className="rounded-[34px] border border-white/10 bg-white/7 p-8 shadow-[0_30px_70px_rgba(0,0,0,0.16)] backdrop-blur">
              <div className="inline-flex rounded-full border border-[#ffd761]/25 bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-[#ffd761]">
                Income Opportunity
              </div>
              <h2 className="mt-6 text-4xl font-black leading-tight md:text-5xl">Top Agents Can Earn Over Ksh 100,000+ Monthly 💰</h2>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-white/80">
                Refer more customers, submit real orders, and grow your income with Betech Solar.
              </p>
              <div className="mt-8 grid gap-4 sm:grid-cols-3">
                <div className="rounded-[26px] border border-white/10 bg-white/10 p-5">
                  <div className="text-sm font-black uppercase tracking-[0.18em] text-[#ffd761]">Solar Kits</div>
                  <div className="mt-2 text-2xl font-black text-white">10 referrals</div>
                  <div className="mt-2 text-sm text-white/70">Big-ticket orders can compound income quickly.</div>
                </div>
                <div className="rounded-[26px] border border-white/10 bg-white/10 p-5">
                  <div className="text-sm font-black uppercase tracking-[0.18em] text-[#ffd761]">Battery + Inverter</div>
                  <div className="mt-2 text-2xl font-black text-white">20 referrals</div>
                  <div className="mt-2 text-sm text-white/70">Smaller but frequent sales build steady monthly payouts.</div>
                </div>
                <div className="rounded-[26px] border border-white/10 bg-white/10 p-5">
                  <div className="text-sm font-black uppercase tracking-[0.18em] text-[#ffd761]">Next Growth</div>
                  <div className="mt-2 text-2xl font-black text-white">More rewards</div>
                  <div className="mt-2 text-sm text-white/70">Monthly bonus opportunities can be layered later.</div>
                </div>
              </div>
            </div>

            <div className="flex">
              <div className="flex w-full flex-col justify-between rounded-[34px] bg-[#f2b20f] p-8 text-slate-950 shadow-[0_35px_80px_rgba(0,0,0,0.22)]">
                <div>
                  <div className="flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-[24px] bg-white/75 p-4 text-[#7a0000] shadow-[0_20px_40px_rgba(0,0,0,0.10)]">
                    <CircleDollarSign className="h-10 w-10" />
                  </div>
                  <div className="mt-8 text-sm font-black uppercase tracking-[0.24em] text-[#7a0000]">Why top agents win</div>
                  <h3 className="mt-4 text-4xl font-black leading-tight">Real customer trust turns into real monthly income.</h3>
                  <p className="mt-5 text-lg leading-8 text-slate-900/80">
                    Solar demand keeps growing across Kenya. Strong local recommendations make referrals easier to close.
                  </p>
                </div>
                <div className="mt-8">
                  <Link
                    href={registerHref}
                    className="inline-flex min-h-[3.5rem] w-full items-center justify-center rounded-2xl bg-[#7a0000] px-6 py-4 text-base font-bold text-white shadow-[0_18px_40px_rgba(122,0,0,0.20)] transition hover:-translate-y-0.5 hover:shadow-[0_22px_50px_rgba(122,0,0,0.26)]"
                  >
                    Start Referring Today
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="earnings" className="bg-[linear-gradient(135deg,#5c0000_0%,#7a0000_38%,#8d1407_100%)] py-20 text-white">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            {sectionTitle(
              "Products You Can Refer & Earn From",
              "Share Betech Solar products and earn 6% commission after every successful completed sale.",
              true,
            )}

            <div className="mt-12 md:hidden">
              <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <div className="flex gap-4 pb-2">
                  {agentProducts.map((product) => {
                    const commission = Math.round(product.price * 0.06);
                    return (
                      <div
                        key={product.name}
                        className="w-[84vw] max-w-[22rem] shrink-0 rounded-[30px] border border-white/12 bg-[linear-gradient(180deg,#fffaf1_0%,#ffffff_100%)] p-4 text-slate-950 shadow-[0_22px_48px_rgba(0,0,0,0.18)]"
                      >
                        <div className="overflow-hidden rounded-[22px] border border-[#7a0000]/10 bg-[#fdf7ef] shadow-[0_14px_28px_rgba(122,0,0,0.10)]">
                          <div className="relative aspect-[4/3]">
                            <Image src={product.image} alt={product.name} fill className="object-contain p-2" />
                          </div>
                        </div>
                        <div className="mt-4 inline-flex rounded-full bg-[#fff3d8] px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-[#7a0000]">
                          {product.category}
                        </div>
                        <h3 className="mt-4 text-xl font-black leading-tight text-slate-950">{product.name}</h3>
                        <div className="mt-3 text-sm font-semibold text-slate-500">Price</div>
                        <div className="mt-1 text-2xl font-black text-slate-950">{formatCurrency(product.price)}</div>
                        <div className="mt-5 rounded-[22px] bg-[linear-gradient(135deg,#7a0000_0%,#991010_100%)] px-4 py-4 text-white shadow-[0_16px_34px_rgba(122,0,0,0.18)]">
                          <div className="text-sm font-bold uppercase tracking-[0.16em] text-[#ffd761]">Earn 6% Commission</div>
                          <div className="mt-2 text-3xl font-black">{formatCurrency(commission)}</div>
                        </div>
                        <Link
                          href={registerHref}
                          className="mt-5 inline-flex min-h-[3.5rem] w-full items-center justify-center rounded-2xl bg-[#0f9d58] px-5 py-3 text-base font-bold text-white shadow-[0_16px_34px_rgba(15,157,88,0.24)] transition hover:-translate-y-0.5"
                        >
                          Refer This Product
                        </Link>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="mt-12 hidden overflow-hidden md:block">
              <div className="product-marquee flex min-w-max gap-5 pr-5">
                {[...agentProducts, ...agentProducts].map((product, index) => {
                  const commission = Math.round(product.price * 0.06);
                  return (
                    <div
                      key={`${product.name}-${index}`}
                      className="w-[19rem] shrink-0 rounded-[30px] border border-white/12 bg-[linear-gradient(180deg,#fffaf1_0%,#ffffff_100%)] p-4 text-slate-950 shadow-[0_22px_48px_rgba(0,0,0,0.18)] transition duration-300 hover:-translate-y-1.5 hover:shadow-[0_28px_60px_rgba(0,0,0,0.24)]"
                    >
                      <div className="overflow-hidden rounded-[22px] border border-[#7a0000]/10 bg-[#fdf7ef] shadow-[0_14px_28px_rgba(122,0,0,0.10)]">
                        <div className="relative aspect-[4/3]">
                          <Image src={product.image} alt={product.name} fill className="object-contain p-2" />
                        </div>
                      </div>
                      <div className="mt-4 inline-flex rounded-full bg-[#fff3d8] px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-[#7a0000]">
                        {product.category}
                      </div>
                      <h3 className="mt-4 text-xl font-black leading-tight text-slate-950">{product.name}</h3>
                      <div className="mt-3 text-sm font-semibold text-slate-500">Price</div>
                      <div className="mt-1 text-2xl font-black text-slate-950">{formatCurrency(product.price)}</div>
                      <div className="mt-5 rounded-[22px] bg-[linear-gradient(135deg,#7a0000_0%,#991010_100%)] px-4 py-4 text-white shadow-[0_16px_34px_rgba(122,0,0,0.18)]">
                        <div className="text-sm font-bold uppercase tracking-[0.16em] text-[#ffd761]">Earn 6% Commission</div>
                        <div className="mt-2 text-3xl font-black">{formatCurrency(commission)}</div>
                      </div>
                      <Link
                        href={registerHref}
                        className="mt-5 inline-flex min-h-[3.5rem] w-full items-center justify-center rounded-2xl bg-[#0f9d58] px-5 py-3 text-base font-bold text-white shadow-[0_16px_34px_rgba(15,157,88,0.24)] transition hover:-translate-y-0.5"
                      >
                        Refer This Product
                      </Link>
                    </div>
                  );
                })}
              </div>
            </div>

            <p className="mt-6 text-center text-sm text-white/70">
              Commission is calculated automatically from the confirmed sale price and becomes available after successful completed payment.
            </p>
          </div>
        </section>

        <section id="benefits" className="bg-white py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            {sectionTitle("Why Agents Choose Betech Solar")}
            <div className="mt-14 grid gap-y-8 md:grid-cols-2 xl:grid-cols-6 xl:gap-x-0">
              {benefits.map((benefit) => {
                const Icon = benefit.icon;
                return (
                  <div
                    key={benefit.title}
                    className="relative px-5 text-center"
                  >
                    <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full shadow-[0_16px_32px_rgba(122,0,0,0.08)] ${
                      benefit.tone === "gold" ? "bg-[#f2b20f] text-[#7a0000]" : "bg-[#7a0000] text-white"
                    }`}>
                      <Icon className="h-8 w-8" />
                    </div>
                    <h3 className="mt-5 text-xl font-black text-slate-950">{benefit.title}</h3>
                    <p className="mt-3 text-sm leading-6 text-slate-600">{benefit.copy}</p>
                    <div className="absolute right-0 top-4 hidden h-[9.5rem] w-px bg-gradient-to-b from-transparent via-[#7a0000]/12 to-transparent xl:block" />
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="bg-[#fffaf3] py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            {sectionTitle("Who Can Join?", "Anyone with a network can refer customers and earn.")}
            <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {joinAudience.map((item, index) => (
                <div
                  key={item}
                  className="rounded-[26px] border border-[#7a0000]/10 bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)] transition duration-300 hover:-translate-y-1"
                >
                  <div className={`flex h-12 w-12 items-center justify-center rounded-2xl font-black ${index % 2 === 0 ? "bg-[#fff3d8] text-[#7a0000]" : "bg-[#7a0000] text-white"}`}>
                    {index + 1}
                  </div>
                  <div className="mt-4 text-xl font-black text-slate-950">{item}</div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">Perfect for people who already influence customer buying decisions in their area.</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-white py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            {sectionTitle("Why Solar Referrals Work Across Kenya 🇰🇪")}
            <div className="mt-14 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {kenyaOpportunity.map((item, index) => {
                const icons = [House, PanelsTopLeft, ShoppingBag, ShieldCheck, Truck, Users];
                const Icon = icons[index] ?? BadgeCheck;
                return (
                  <div
                    key={item}
                    className="rounded-[28px] border border-[#7a0000]/10 bg-[#fcfaf7] p-6 shadow-[0_16px_34px_rgba(15,23,42,0.05)] transition duration-300 hover:-translate-y-1"
                  >
                    <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${index % 2 === 0 ? "bg-[#fff3d8] text-[#7a0000]" : "bg-[#7a0000] text-white"}`}>
                      <Icon className="h-7 w-7" />
                    </div>
                    <div className="mt-4 text-2xl font-black text-slate-950">{item}</div>
                    <p className="mt-3 text-sm leading-7 text-slate-600">
                      Local referrals work because customers trust people who understand the needs of their home, farm, or business.
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section id="products" className="bg-[#fffaf3] py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            {sectionTitle("Trusted Solar Brands We Deal With", "We deal with reliable solar products trusted by homes, farms, and businesses across Kenya.")}
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              {["Solar Kits", "Batteries", "Inverters", "Water Pumps", "Accessories"].map((label, index) => (
                <div
                  key={label}
                  className={`rounded-full px-4 py-2 text-sm font-bold shadow-[0_10px_24px_rgba(15,23,42,0.04)] ${index % 2 === 0 ? "bg-[#fff3d8] text-[#7a0000]" : "bg-white text-slate-700 border border-[#7a0000]/10"}`}
                >
                  {label}
                </div>
              ))}
            </div>
            <div className="mt-14 rounded-[34px] border border-[#7a0000]/10 bg-white p-6 shadow-[0_20px_50px_rgba(15,23,42,0.06)]">
              <div className="grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {brands.map((brand) => (
                <div
                  key={brand.name}
                  className="flex min-h-[5.5rem] items-center justify-center rounded-[20px] border border-[#7a0000]/6 bg-[#fcfaf7] px-4 py-3 text-center transition duration-300 hover:-translate-y-1"
                >
                  <BrandWordmark style={brand.style} name={brand.name} />
                </div>
              ))}
                <div className="flex min-h-[5.5rem] items-center justify-center gap-3 rounded-[20px] px-4 py-3 text-center">
                  <span className="text-[1.9rem] font-medium tracking-tight text-slate-700">and many more...</span>
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f2b20f] text-lg font-black text-white">···</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-[linear-gradient(135deg,#520000_0%,#7a0000_50%,#3d0000_100%)] py-16 text-white">
          <div className="mx-auto grid max-w-7xl gap-4 px-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
            <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 text-center shadow-[0_20px_40px_rgba(0,0,0,0.15)]">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] bg-white/10 text-[#ffd761]">
                <Users className="h-8 w-8" />
              </div>
              <div className="mt-5 text-4xl font-black"><AnimatedCount value={2500} suffix="+" /></div>
              <div className="mt-2 text-sm font-semibold uppercase tracking-[0.18em] text-white/75">Customers Served</div>
            </div>
            <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 text-center shadow-[0_20px_40px_rgba(0,0,0,0.15)]">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] bg-white/10 text-[#ffd761]">
                <BadgeCheck className="h-8 w-8" />
              </div>
              <div className="mt-5 text-4xl font-black"><AnimatedCount value={120} suffix="+" /></div>
              <div className="mt-2 text-sm font-semibold uppercase tracking-[0.18em] text-white/75">Active Agents</div>
            </div>
            <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 text-center shadow-[0_20px_40px_rgba(0,0,0,0.15)]">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] bg-white/10 text-[#ffd761]">
                <CircleDollarSign className="h-8 w-8" />
              </div>
              <div className="mt-5 text-4xl font-black">Ksh <AnimatedCount value={3200000} suffix="+" /></div>
              <div className="mt-2 text-sm font-semibold uppercase tracking-[0.18em] text-white/75">Paid In Commissions</div>
            </div>
            <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 text-center shadow-[0_20px_40px_rgba(0,0,0,0.15)]">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] bg-white/10 text-[#ffd761]">
                <MapPinned className="h-8 w-8" />
              </div>
              <div className="mt-5 text-4xl font-black"><AnimatedCount value={47} /></div>
              <div className="mt-2 text-sm font-semibold uppercase tracking-[0.18em] text-white/75">Counties Reached</div>
            </div>
          </div>
        </section>

        <section className="bg-white py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            {sectionTitle("What Our Agents Say")}
            <div className="mt-14 grid gap-5 lg:grid-cols-3">
              {testimonials.map((testimonial) => (
                <div
                  key={testimonial.name}
                  className="rounded-[30px] border border-[#7a0000]/10 bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)] transition duration-300 hover:-translate-y-1.5 hover:shadow-[0_26px_55px_rgba(122,0,0,0.12)]"
                >
                  <div className="flex items-center gap-4">
                    <div className="overflow-hidden rounded-[24px] border border-[#7a0000]/10 bg-white shadow-[0_18px_30px_rgba(15,23,42,0.10)]">
                      <Image src={testimonial.image} alt={testimonial.name} width={98} height={169} className="h-20 w-20 object-cover" />
                    </div>
                    <div>
                      <div className="text-xl font-black text-slate-950">{testimonial.name}</div>
                      <div className="text-sm text-slate-500">{testimonial.location}</div>
                      <div className="mt-2 inline-flex rounded-full bg-[#fff3d8] px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-[#7a0000]">
                        Approved Agent
                      </div>
                    </div>
                  </div>
                  <p className="mt-5 text-base leading-8 text-slate-600">“{testimonial.quote}”</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-[#fffaf3] py-20">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            {sectionTitle("See How Betech Agents Earn", "Watch how agents refer customers, submit orders, and withdraw commissions.")}
            <div className="mt-14 overflow-hidden rounded-[36px] border border-[#7a0000]/10 bg-[linear-gradient(135deg,#5c0000_0%,#7a0000_45%,#2c0000_100%)] p-6 shadow-[0_28px_65px_rgba(122,0,0,0.16)]">
              <div className="grid gap-6 md:grid-cols-[1.05fr_0.95fr]">
                <div className="rounded-[28px] border border-white/10 bg-white/6 p-8 text-white">
                  <div className="inline-flex rounded-full border border-white/16 bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-[#ffd761]">
                    Video Coming Soon
                  </div>
                  <h3 className="mt-6 text-3xl font-black">A quick look at how agents turn customer referrals into M-Pesa payouts.</h3>
                  <p className="mt-4 text-base leading-8 text-white/75">
                    We’ll add a short explainer video here showing how simple it is to refer customers, submit orders, and grow your solar income.
                  </p>
                </div>
                <div className="flex min-h-[18rem] items-center justify-center rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.16),transparent_30%),linear-gradient(135deg,#ffe2a7_0%,#f2b20f_40%,#7a0000_100%)] p-8 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.24)]">
                  <div className="text-center">
                    <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-white/20 shadow-[0_20px_40px_rgba(0,0,0,0.18)] backdrop-blur">
                      <PlayCircle className="h-14 w-14" />
                    </div>
                    <div className="mt-5 text-2xl font-black">Watch The Agent Story</div>
                    <div className="mt-2 text-sm uppercase tracking-[0.16em] text-white/80">Referral • Delivery • Commission • Withdraw</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="faqs" className="bg-[#fffaf3] py-20">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            {sectionTitle("Frequently Asked Questions")}
            <div className="mt-14 space-y-4">
              {[
                ["Do I pay to join?", "No. Joining the Betech Solar Agents Program is 100% free."],
                ["How do I earn?", "You earn up to 6% commission after a referred sale is fully paid and successfully delivered or collected."],
                ["How do I withdraw?", "Once your commission is earned, approved, and available, you can request payout through the agent portal and receive it via M-Pesa."],
                ["Can I work from any county?", "Yes. Agents can operate across Kenya as long as they refer real customers and valid opportunities."],
              ].map(([question, answer]) => (
                <div key={question} className="rounded-[28px] border border-[#7a0000]/10 bg-white p-6 shadow-[0_16px_30px_rgba(15,23,42,0.05)]">
                  <div className="text-xl font-black text-slate-950">{question}</div>
                  <p className="mt-3 text-base leading-7 text-slate-600">{answer}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="contact" className="bg-[linear-gradient(135deg,#3b0000_0%,#7a0000_45%,#150000_100%)] py-20 text-white">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[1fr_0.95fr] lg:px-8">
            <div className="flex flex-col justify-center">
              <div className="inline-flex w-fit rounded-full border border-white/16 bg-white/8 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-[#ffd761]">
                Ready To Start Earning? ⚡
              </div>
              <h2 className="mt-6 text-4xl font-black tracking-tight text-white md:text-6xl">Join the Betech Solar Agents Program today and start earning from successful solar referrals.</h2>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-white/80">
                Refer customers, let Betech handle confirmation and delivery, then withdraw your commission through M-Pesa.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href={registerHref}
                  className="inline-flex items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#11b86a_0%,#0f9d58_55%,#0b7c44_100%)] px-6 py-4 text-base font-bold text-white shadow-[0_18px_40px_rgba(15,157,88,0.24)] transition hover:-translate-y-0.5"
                >
                  Become an Agent Now
                </Link>
                <a
                  href="https://wa.me/254722151083"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center rounded-2xl border border-white/18 bg-white px-6 py-4 text-base font-bold text-slate-950 transition hover:-translate-y-0.5"
                >
                  Talk To Us On WhatsApp
                </a>
              </div>

              <div className="mt-8 flex flex-wrap gap-6 text-sm font-semibold text-white/80">
                <div>📞 0722 151 083</div>
                <div>🌐 www.betech.co.ke</div>
                <div>Free to Join</div>
                <div>Get Paid Fast</div>
              </div>
              <div className="mt-8 text-2xl font-black text-[#ffd761]">Refer. Earn. Withdraw.</div>
            </div>

            <div className="relative overflow-hidden rounded-[36px] border border-white/10 bg-[linear-gradient(155deg,#f9d18f_0%,#a34a26_24%,#6a1c10_58%,#2a0704_100%)] p-5 shadow-[0_30px_80px_rgba(0,0,0,0.24)]">
              <Image
                src="/agents/cta-house-generated.png"
                alt="Solar-powered home for the final Betech agent call to action"
                fill
                className="object-cover opacity-70"
              />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.26),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(242,178,15,0.24),transparent_24%)]" />
              <div className="absolute bottom-0 left-0 right-0 h-32 bg-[linear-gradient(180deg,transparent_0%,rgba(0,0,0,0.35)_100%)]" />
              <div className="relative h-full min-h-[24rem] rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-6">
                <div className="grid h-full content-between gap-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-[24px] border border-white/15 bg-white/12 p-4 backdrop-blur">
                      <div className="flex items-center gap-3 text-[#ffd761]">
                        <PhoneCall className="h-5 w-5" />
                        <span className="text-sm font-semibold uppercase tracking-[0.18em] text-white/80">Call us</span>
                      </div>
                      <div className="mt-3 text-2xl font-black text-white">0722 151 083</div>
                    </div>
                    <div className="rounded-[24px] border border-white/15 bg-white/12 p-4 backdrop-blur">
                      <div className="flex items-center gap-3 text-[#ffd761]">
                        <House className="h-5 w-5" />
                        <span className="text-sm font-semibold uppercase tracking-[0.18em] text-white/80">Website</span>
                      </div>
                      <div className="mt-3 text-2xl font-black text-white">www.betech.co.ke</div>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-[24px] border border-white/15 bg-white/10 p-5 backdrop-blur">
                      <div className="text-sm font-semibold uppercase tracking-[0.18em] text-white/80">Solar homes</div>
                      <div className="mt-3 flex items-end gap-3">
                        <div className="flex h-28 w-28 items-end justify-center rounded-[28px] bg-white/14 p-3">
                          <div className="h-14 w-16 rounded-t-[12px] bg-white/70" />
                        </div>
                        <div className="grid flex-1 grid-cols-3 gap-2">
                          <div className="h-16 rounded-xl bg-[#163b3d]/60" />
                          <div className="h-20 rounded-xl bg-[#224f52]/80" />
                          <div className="h-24 rounded-xl bg-[#2d7377]/90" />
                        </div>
                      </div>
                    </div>
                    <div className="rounded-[24px] border border-white/15 bg-white/10 p-5 backdrop-blur">
                      <div className="text-sm font-semibold uppercase tracking-[0.18em] text-white/80">Growing opportunity</div>
                      <div className="mt-4 flex items-end gap-2">
                        <div className="h-16 w-10 rounded-t-xl bg-[#ffd761]" />
                        <div className="h-24 w-10 rounded-t-xl bg-[#f2b20f]" />
                        <div className="h-32 w-10 rounded-t-xl bg-[#c68f0d]" />
                        <div className="ml-2 text-lg font-black text-white">Refer. Earn. Withdraw.</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
