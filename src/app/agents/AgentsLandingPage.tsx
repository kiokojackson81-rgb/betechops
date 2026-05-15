import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Banknote,
  BatteryCharging,
  CircleDollarSign,
  Headphones,
  House,
  MapPinned,
  MessageCircleMore,
  PanelsTopLeft,
  PhoneCall,
  PlayCircle,
  ShieldCheck,
  SunMedium,
  TrendingUp,
  Truck,
  Users,
  WalletCards,
} from "lucide-react";
import AnimatedCount from "@/app/agents/_components/AnimatedCount";
import { agentPath } from "@/lib/agents/host";

const steps = [
  {
    number: "1",
    title: "Refer Customer",
    copy: "Share Betech products through WhatsApp, Facebook, TikTok, posters, and your local network.",
    icon: MessageCircleMore,
  },
  {
    number: "2",
    title: "Customer Orders",
    copy: "Submit customer details in your dashboard so the Betech team can follow through quickly.",
    icon: WalletCards,
  },
  {
    number: "3",
    title: "We Deliver & Install",
    copy: "Betech handles delivery, installation, and customer support professionally across Kenya.",
    icon: Truck,
  },
  {
    number: "4",
    title: "You Earn Commission",
    copy: "Earn up to 6% commission after successful solar sales are completed and confirmed.",
    icon: CircleDollarSign,
  },
];

const earnings = [
  { title: "5KW Solar Kit", amount: "Ksh 12,000+", note: "Earn up to", accent: "from-[#fff3d8] to-[#fffaf0]" },
  { title: "Inverter", amount: "Ksh 3,000+", note: "Earn up to", accent: "from-[#fff8ee] to-[#ffffff]" },
  { title: "Battery", amount: "Ksh 3,000+", note: "Earn up to", accent: "from-[#fff5df] to-[#fffdf8]" },
  { title: "Water Pump", amount: "Ksh 1,500+", note: "Earn up to", accent: "from-[#fff7ea] to-[#ffffff]" },
  { title: "Accessories", amount: "Ksh 500+", note: "Earn up to", accent: "from-[#fff8ef] to-[#ffffff]" },
];

const benefits = [
  {
    title: "Trusted Brand",
    copy: "A leading Kenyan solar company trusted by households, businesses, and project buyers.",
    icon: ShieldCheck,
  },
  {
    title: "Genuine Products",
    copy: "Sell with confidence using quality solar brands and dependable after-sales support.",
    icon: BadgeCheck,
  },
  {
    title: "Full Support",
    copy: "Our team helps with product guidance, quotations, delivery, installation, and customer follow-up.",
    icon: Headphones,
  },
  {
    title: "Marketing Materials",
    copy: "Use flyers, social creatives, and product information to close more referrals faster.",
    icon: PanelsTopLeft,
  },
  {
    title: "Fast Payouts",
    copy: "Withdraw earned commission through M-Pesa quickly after successful completed sales.",
    icon: Banknote,
  },
  {
    title: "Nationwide Opportunities",
    copy: "Work from any county in Kenya and earn from solar demand in homes, farms, and businesses.",
    icon: MapPinned,
  },
];

const brands = ["Solarmax", "SRNE", "MUST", "Felicity Solar", "Alltop", "Deye", "Growatt", "Jinko", "JA Solar"];

const testimonials = [
  {
    name: "James O.",
    location: "Kisumu",
    quote: "I started referring customers through WhatsApp and now earn extra monthly income without leaving my main work.",
    accent: "from-[#7a0000] to-[#a11d1d]",
  },
  {
    name: "Mercy W.",
    location: "Nakuru",
    quote: "The system is simple. I submit the customer, Betech handles delivery and installation, then I track my commission.",
    accent: "from-[#f3b205] to-[#ffd761]",
  },
  {
    name: "Brian K.",
    location: "Eldoret",
    quote: "Fast payouts and genuine products make it easy to build trust with customers and keep referrals growing.",
    accent: "from-[#163b3d] to-[#2d7377]",
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
    <div className="rounded-[24px] border border-white/60 bg-white/90 p-4 shadow-[0_24px_60px_rgba(0,0,0,0.10)] backdrop-blur transition duration-300 hover:-translate-y-1 hover:shadow-[0_32px_80px_rgba(0,0,0,0.14)]">
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

export default function AgentsLandingPage({ useRootPaths = false }: AgentsLandingPageProps) {
  const registerHref = agentPath("/register", useRootPaths);
  const loginHref = agentPath("/login", useRootPaths);

  return (
    <div className="scroll-smooth bg-[#fcfaf7] text-slate-950">
      <header className="sticky top-0 z-40 border-b border-[#7a0000]/10 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link href={agentPath("/", useRootPaths)} className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#f2b20f] via-[#f6cd58] to-[#7a0000] text-white shadow-[0_16px_30px_rgba(122,0,0,0.22)]">
              <SunMedium className="h-6 w-6" />
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
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#0f9d58] px-6 py-4 text-base font-bold text-white shadow-[0_18px_40px_rgba(15,157,88,0.20)] transition hover:-translate-y-0.5 hover:shadow-[0_24px_50px_rgba(15,157,88,0.26)]"
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
              <div className="relative overflow-hidden rounded-[36px] border border-white/70 bg-[linear-gradient(160deg,#fff_0%,#fff7ef_45%,#fff0dc_100%)] p-5 shadow-[0_35px_90px_rgba(122,0,0,0.16)] sm:p-7">
                <div className="rounded-[30px] border border-white/70 bg-[radial-gradient(circle_at_top,#fffaf1_0%,#fff_44%,#fff6ea_100%)] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
                  <div className="grid gap-5 lg:grid-cols-[0.6fr_0.4fr]">
                    <div className="rounded-[28px] bg-gradient-to-br from-[#f5e6d6] via-[#fff6ec] to-[#fff] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
                      <div className="relative overflow-hidden rounded-[26px] bg-[linear-gradient(155deg,#f7ecdc_0%,#fff8f1_22%,#cf6b3d_24%,#8f2f1e_54%,#5f2e20_100%)] px-5 pb-4 pt-5">
                        <div className="absolute inset-x-0 bottom-0 h-28 bg-[radial-gradient(circle_at_bottom,rgba(15,157,88,0.18),transparent_56%)]" />
                        <div className="absolute right-4 top-4 h-24 w-24 rounded-full bg-white/18 blur-2xl" />
                        <div className="relative flex items-start justify-between gap-3">
                          <div className="max-w-[13rem]">
                            <div className="text-xs font-bold uppercase tracking-[0.22em] text-white/80">Refer → Earn → Withdraw</div>
                            <div className="mt-3 text-3xl font-black leading-tight text-white">Solar income opportunity for Kenyan agents</div>
                          </div>
                          <div className="rounded-2xl border border-white/20 bg-white/12 px-3 py-2 text-xs font-semibold text-white">
                            Kenya Wide
                          </div>
                        </div>

                        <div className="relative mt-8 grid grid-cols-[1.05fr_0.95fr] items-end gap-4">
                          <div className="relative h-[18rem] overflow-hidden rounded-[26px] bg-[linear-gradient(180deg,#f0c8a5_0%,#8c311f_54%,#5a2217_100%)] shadow-[0_28px_40px_rgba(0,0,0,0.18)]">
                            <div className="absolute inset-x-6 top-5 h-16 rounded-[22px] bg-white/10" />
                            <div className="absolute inset-x-4 bottom-0 top-14 rounded-t-[32px] bg-[linear-gradient(180deg,#7a0000_0%,#5e0000_100%)]" />
                            <div className="absolute left-1/2 top-[5.25rem] h-6 w-6 -translate-x-1/2 rounded-full bg-[#1d1311]" />
                            <div className="absolute left-1/2 top-[6rem] h-16 w-20 -translate-x-1/2 rounded-[40px] bg-[#6a281a]" />
                            <div className="absolute left-1/2 top-[9rem] h-20 w-28 -translate-x-1/2 rounded-[40px] bg-[#7a2f1f]" />
                            <div className="absolute left-[2.1rem] top-[8.8rem] h-24 w-8 rotate-[18deg] rounded-full bg-[#7a2f1f]" />
                            <div className="absolute right-[2.1rem] top-[8.8rem] h-24 w-8 -rotate-[18deg] rounded-full bg-[#7a2f1f]" />
                            <div className="absolute left-[4.6rem] top-[12.8rem] h-28 w-8 rotate-[8deg] rounded-full bg-[#7a2f1f]" />
                            <div className="absolute right-[4.6rem] top-[12.8rem] h-28 w-8 -rotate-[8deg] rounded-full bg-[#7a2f1f]" />
                            <div className="absolute left-[3.2rem] top-[6.1rem] h-10 w-10 rounded-full bg-[#2b1a17]" />
                            <div className="absolute inset-x-0 bottom-0 h-16 bg-[linear-gradient(180deg,transparent_0%,rgba(0,0,0,0.22)_100%)]" />
                          </div>

                          <div className="space-y-4">
                            <div className="mx-auto w-[11rem] rounded-[28px] border border-slate-200 bg-white p-3 shadow-[0_24px_50px_rgba(15,23,42,0.14)]">
                              <div className="rounded-[22px] border border-slate-100 bg-[#f8fafc] p-3">
                                <div className="mx-auto h-1.5 w-12 rounded-full bg-slate-300" />
                                <div className="mt-4 rounded-2xl bg-white p-3 shadow-[0_12px_24px_rgba(15,23,42,0.06)]">
                                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Dashboard</div>
                                  <div className="mt-3 text-2xl font-black text-slate-950">Ksh 45,680</div>
                                  <div className="mt-1 text-xs text-emerald-600">+ 6 successful sales</div>
                                  <div className="mt-4 space-y-2">
                                    <div className="h-2 rounded-full bg-slate-100"><div className="h-2 w-[74%] rounded-full bg-[#0f9d58]" /></div>
                                    <div className="h-2 rounded-full bg-slate-100"><div className="h-2 w-[58%] rounded-full bg-[#f2b20f]" /></div>
                                    <div className="h-2 rounded-full bg-slate-100"><div className="h-2 w-[81%] rounded-full bg-[#7a0000]" /></div>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="rounded-[26px] border border-white/70 bg-white p-4 shadow-[0_20px_50px_rgba(122,0,0,0.14)]">
                              <div className="text-sm font-bold uppercase tracking-[0.22em] text-[#7a0000]">Earn Up To</div>
                              <div className="mt-2 text-5xl font-black text-[#7a0000]">6%</div>
                              <div className="mt-1 text-base font-semibold text-slate-900">Commission</div>
                              <div className="mt-1 text-sm text-slate-500">On every successful sale</div>
                              <div className="mt-4 flex items-center gap-2 text-[#0f9d58]">
                                <TrendingUp className="h-5 w-5" />
                                <span className="text-sm font-semibold">Grow your monthly side income</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 grid gap-3 sm:grid-cols-3">
                          {heroCard("Solar Leads", "Daily", "High demand in homes and farms")}
                          {heroCard("Fast Payout", "M-Pesa", "Withdraw after successful completion")}
                          {heroCard("Top Agents", "100K+", "Monthly potential across Kenya")}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="rounded-[26px] border border-[#7a0000]/10 bg-white p-4 shadow-[0_20px_40px_rgba(15,23,42,0.07)]">
                        <div className="flex items-center gap-3">
                          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fff3d8] text-[#7a0000]">
                            <House className="h-6 w-6" />
                          </div>
                          <div>
                            <div className="text-sm font-bold text-slate-950">Solar-ready customers</div>
                            <div className="text-xs text-slate-500">Homes, shops, farms, and schools</div>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-[26px] border border-[#7a0000]/10 bg-white p-4 shadow-[0_20px_40px_rgba(15,23,42,0.07)]">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="rounded-2xl bg-[#f8fafc] p-3">
                            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Free to join</div>
                            <div className="mt-2 text-xl font-black text-slate-950">0 Ksh</div>
                          </div>
                          <div className="rounded-2xl bg-[#fff8e3] p-3">
                            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7a0000]/70">Commission rate</div>
                            <div className="mt-2 text-xl font-black text-[#7a0000]">Up to 6%</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="bg-white py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            {sectionTitle("How The Betech Agent Program Works")}
            <div className="mt-14 grid gap-5 xl:grid-cols-4">
              {steps.map((step, index) => {
                const Icon = step.icon;
                return (
                  <div key={step.title} className="relative">
                    <div className="group h-full rounded-[30px] border border-[#7a0000]/10 bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.06)] transition duration-300 hover:-translate-y-1.5 hover:shadow-[0_24px_55px_rgba(122,0,0,0.12)]">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#7a0000] text-lg font-black text-white shadow-[0_12px_24px_rgba(122,0,0,0.22)]">
                        {step.number}
                      </div>
                      <div className="mt-6 flex h-16 w-16 items-center justify-center rounded-[22px] bg-[#fff3d8] text-[#7a0000] transition group-hover:scale-105">
                        <Icon className="h-8 w-8" />
                      </div>
                      <h3 className="mt-6 text-2xl font-black text-slate-950">{step.title}</h3>
                      <p className="mt-3 text-base leading-7 text-slate-600">{step.copy}</p>
                    </div>
                    {index < steps.length - 1 ? (
                      <div className="pointer-events-none absolute -right-3 top-1/2 hidden -translate-y-1/2 xl:block">
                        <ArrowRight className="h-8 w-8 text-[#7a0000]/35" />
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section id="earnings" className="bg-[linear-gradient(135deg,#5c0000_0%,#7a0000_38%,#8d1407_100%)] py-20 text-white">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:px-8">
            <div>
            {sectionTitle("Example Earnings", "The more you refer, the more you earn.", true)}
              <div className="mt-12 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {earnings.map((item) => (
                  <div
                    key={item.title}
                    className={`rounded-[28px] border border-white/10 bg-gradient-to-br ${item.accent} p-5 text-slate-950 shadow-[0_24px_50px_rgba(0,0,0,0.16)] transition duration-300 hover:-translate-y-1.5`}
                  >
                    <div className="flex h-16 w-16 items-center justify-center rounded-[22px] bg-white text-[#7a0000] shadow-[0_12px_24px_rgba(122,0,0,0.12)]">
                      {item.title.includes("Battery") ? (
                        <BatteryCharging className="h-8 w-8" />
                      ) : item.title.includes("Inverter") ? (
                        <WalletCards className="h-8 w-8" />
                      ) : item.title.includes("Pump") ? (
                        <TrendingUp className="h-8 w-8" />
                      ) : item.title.includes("Accessories") ? (
                        <BadgeCheck className="h-8 w-8" />
                      ) : (
                        <PanelsTopLeft className="h-8 w-8" />
                      )}
                    </div>
                    <div className="mt-5 text-xl font-black">{item.title}</div>
                    <div className="mt-3 text-sm text-slate-500">{item.note}</div>
                    <div className="mt-1 text-3xl font-black text-[#7a0000]">{item.amount}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex">
              <div className="flex w-full flex-col justify-between rounded-[34px] bg-[#f2b20f] p-8 text-slate-950 shadow-[0_35px_80px_rgba(0,0,0,0.22)]">
                <div>
                  <div className="flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-[24px] bg-white/70 p-4 text-[#7a0000]">
                    <TrendingUp className="h-10 w-10" />
                  </div>
                  <div className="mt-8 text-sm font-black uppercase tracking-[0.24em] text-[#7a0000]">Top Agents</div>
                  <h3 className="mt-4 text-4xl font-black leading-tight">Earn Over Ksh 100,000+ Monthly</h3>
                  <p className="mt-5 text-lg leading-8 text-slate-900/80">
                    Be part of our growing network of successful agents serving homes, farms, businesses, and projects across Kenya.
                  </p>
                </div>
                <div className="mt-8 rounded-[26px] bg-white/80 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
                  <div className="text-sm font-semibold text-slate-700">Best for:</div>
                  <div className="mt-3 grid gap-3 text-sm font-medium text-slate-800 sm:grid-cols-2">
                    <div>WhatsApp marketers</div>
                    <div>Hardware sales reps</div>
                    <div>Rural field agents</div>
                    <div>Project connectors</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="benefits" className="bg-white py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            {sectionTitle("Why Agents Choose Betech Solar")}
            <div className="mt-14 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {benefits.map((benefit) => {
                const Icon = benefit.icon;
                return (
                  <div
                    key={benefit.title}
                    className="rounded-[30px] border border-[#7a0000]/10 bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.06)] transition duration-300 hover:-translate-y-1.5 hover:shadow-[0_26px_55px_rgba(122,0,0,0.12)]"
                  >
                    <div className="flex h-16 w-16 items-center justify-center rounded-[22px] bg-[#fff3d8] text-[#7a0000]">
                      <Icon className="h-8 w-8" />
                    </div>
                    <h3 className="mt-5 text-2xl font-black text-slate-950">{benefit.title}</h3>
                    <p className="mt-3 text-base leading-7 text-slate-600">{benefit.copy}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section id="products" className="bg-[#fffaf3] py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            {sectionTitle("Trusted Solar Brands We Deal With")}
            <div className="mt-14 grid gap-4 rounded-[34px] border border-[#7a0000]/10 bg-white p-6 shadow-[0_20px_50px_rgba(15,23,42,0.06)] sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {brands.map((brand) => (
                <div
                  key={brand}
                  className="flex min-h-[96px] items-center justify-center rounded-[24px] border border-slate-100 bg-[#fcfbf8] px-5 py-4 text-center text-xl font-black tracking-tight text-slate-800 transition duration-300 hover:-translate-y-1 hover:border-[#7a0000]/18 hover:shadow-[0_18px_35px_rgba(122,0,0,0.08)]"
                >
                  {brand}
                </div>
              ))}
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
                    <div className={`flex h-20 w-20 items-center justify-center rounded-[24px] bg-gradient-to-br ${testimonial.accent} text-2xl font-black text-white shadow-[0_18px_30px_rgba(15,23,42,0.14)]`}>
                      {testimonial.name.split(" ").map((part) => part[0]).join("")}
                    </div>
                    <div>
                      <div className="text-xl font-black text-slate-950">{testimonial.name}</div>
                      <div className="text-sm text-slate-500">{testimonial.location}</div>
                    </div>
                  </div>
                  <p className="mt-5 text-base leading-8 text-slate-600">“{testimonial.quote}”</p>
                </div>
              ))}
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

        <section id="contact" className="bg-[linear-gradient(135deg,#5c0000_0%,#7a0000_45%,#3f0000_100%)] py-20 text-white">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[1fr_0.95fr] lg:px-8">
            <div className="flex flex-col justify-center">
              <div className="inline-flex w-fit rounded-full border border-white/16 bg-white/8 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-[#ffd761]">
                Ready To Start Earning? ⚡
              </div>
              <h2 className="mt-6 text-4xl font-black tracking-tight text-white md:text-6xl">Join the Betech Solar Agents Program today.</h2>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-white/80">
                Start earning from successful solar referrals by connecting homes, farms, and businesses to trusted energy solutions.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href={registerHref}
                  className="inline-flex items-center justify-center rounded-2xl bg-[#0f9d58] px-6 py-4 text-base font-bold text-white shadow-[0_18px_40px_rgba(15,157,88,0.24)] transition hover:-translate-y-0.5"
                >
                  Become an Agent Now
                </Link>
                <a
                  href="https://wa.me/254722151083"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center rounded-2xl border border-white/18 bg-white px-6 py-4 text-base font-bold text-slate-950 transition hover:-translate-y-0.5"
                >
                  Talk To Us
                </a>
              </div>

              <div className="mt-8 flex flex-wrap gap-6 text-sm font-semibold text-white/80">
                <div>Free to Join</div>
                <div>Easy to Use</div>
                <div>Earn More</div>
                <div>Get Paid Fast</div>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-[36px] border border-white/10 bg-[linear-gradient(155deg,#f9d18f_0%,#a34a26_24%,#6a1c10_58%,#2a0704_100%)] p-5 shadow-[0_30px_80px_rgba(0,0,0,0.24)]">
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
