"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  ChartNoAxesCombined,
  Globe,
  Handshake,
  Headphones,
  LockKeyhole,
  ShieldCheck,
  ShieldUser,
  UserRound,
} from "lucide-react";

const ACCESS_CARDS = [
  {
    title: "Customer Login",
    description: "Access your Betech Solar account, orders and services.",
    href: "https://www.betech.co.ke/account",
    accent: "from-sky-500/25 via-cyan-400/10 to-transparent",
    border: "border-sky-400/35",
    iconWrap: "border-sky-400/45 text-sky-200 shadow-[0_0_30px_rgba(56,189,248,0.18)]",
    button: "border-sky-400/40 bg-[linear-gradient(135deg,rgba(37,99,235,0.95),rgba(29,78,216,0.88))] text-white hover:brightness-110",
    helper: "For valued customers",
    helperTone: "text-sky-100/85",
    icon: UserRound,
    external: true,
  },
  {
    title: "Agent Login",
    description: "Access the Betech Solar agent platform.",
    href: "https://agents.betech.co.ke/",
    accent: "from-emerald-500/22 via-green-400/10 to-transparent",
    border: "border-emerald-400/35",
    iconWrap: "border-emerald-400/45 text-emerald-200 shadow-[0_0_30px_rgba(16,185,129,0.18)]",
    button: "border-emerald-400/40 bg-[linear-gradient(135deg,rgba(22,163,74,0.96),rgba(5,150,105,0.9))] text-white hover:brightness-110",
    helper: "For Betech Solar agents",
    helperTone: "text-emerald-100/85",
    icon: Handshake,
    external: true,
  },
  {
    title: "Staff Login",
    description: "For Betech Solar staff and administrators.",
    href: "/login",
    accent: "from-violet-500/24 via-fuchsia-500/12 to-transparent",
    border: "border-violet-400/35",
    iconWrap: "border-violet-400/45 text-violet-200 shadow-[0_0_30px_rgba(168,85,247,0.2)]",
    button: "border-violet-400/40 bg-[linear-gradient(135deg,rgba(147,51,234,0.96),rgba(126,34,206,0.9))] text-white hover:brightness-110",
    helper: "For authorized staff only",
    helperTone: "text-violet-100/85",
    icon: ShieldUser,
    external: false,
  },
] as const;

const SUPPORTING_BLOCKS = [
  {
    title: "Secure Access",
    description: "Protected access for authorized users.",
    icon: LockKeyhole,
  },
  {
    title: "One Platform",
    description: "Access Betech Solar services from one place.",
    icon: Globe,
  },
  {
    title: "Efficient Operations",
    description: "Purpose-built tools for our customers, agents and team.",
    icon: ChartNoAxesCombined,
  },
  {
    title: "Need Support?",
    description: "We're here when you need assistance.",
    icon: Headphones,
  },
] as const;

function cardLinkProps(href: string, external?: boolean) {
  if (external) {
    return {
      href,
      target: "_blank",
      rel: "noreferrer",
    } as const;
  }

  return { href } as const;
}

export default function HomePageClient() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#040713] text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(251,146,60,0.2),transparent_24%),radial-gradient(circle_at_50%_0%,rgba(124,58,237,0.22),transparent_30%),radial-gradient(circle_at_100%_10%,rgba(14,165,233,0.12),transparent_22%),linear-gradient(180deg,#050915_0%,#060a17_38%,#040610_100%)]" />
        <div className="absolute inset-x-0 top-0 h-[1px] bg-white/10" />
        <div className="absolute left-[-14rem] top-[22%] h-[28rem] w-[28rem] rounded-full bg-orange-500/10 blur-3xl" />
        <div className="absolute right-[-10rem] top-[15%] h-[30rem] w-[30rem] rounded-full bg-violet-500/14 blur-3xl" />
        <div className="absolute bottom-[-8rem] left-1/2 h-[26rem] w-[26rem] -translate-x-1/2 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute inset-y-[13rem] right-[-8%] w-[70%] skew-x-[-18deg] border-l border-white/10 opacity-35" />
        <div className="absolute inset-y-[13rem] right-[5%] w-[62%] skew-x-[-18deg] border-l border-white/5 opacity-40" />
        <div className="absolute inset-y-[15rem] right-[0%] w-[62%] rotate-[14deg] border-t border-white/10 opacity-25" />
        <div className="absolute inset-y-[19rem] right-[2%] w-[60%] rotate-[14deg] border-t border-white/10 opacity-20" />
        <div className="absolute inset-y-[23rem] right-[4%] w-[58%] rotate-[14deg] border-t border-white/10 opacity-20" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-[1180px] flex-col px-4 pb-8 pt-4 sm:px-6 sm:pb-10 lg:px-8">
        <header className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(6,10,20,0.96),rgba(7,11,22,0.88))] px-4 py-4 shadow-[0_18px_60px_rgba(0,0,0,0.28)] backdrop-blur xl:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-[82px] shrink-0 sm:w-[96px]">
                <Image
                  src="/agents/betech-logo-crop.png"
                  alt="Betech Solar Solutions"
                  width={192}
                  height={132}
                  priority
                  className="h-auto w-full object-contain"
                />
              </div>
              <div>
                <div className="text-[2rem] font-semibold tracking-tight leading-none sm:text-[2.4rem]">
                  <span className="text-white">Betech</span>
                  <span className="bg-[linear-gradient(135deg,#8b5cf6,#c084fc)] bg-clip-text text-transparent">Ops</span>
                </div>
                <div className="mt-2 text-[11px] uppercase tracking-[0.36em] text-slate-300 sm:text-[13px]">
                  Digital Access Portal
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-sm text-slate-200 sm:gap-4 sm:text-base">
              <a
                href="https://www.betech.co.ke/"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 transition hover:border-white/20 hover:bg-white/[0.06]"
              >
                <Globe className="h-4 w-4" />
                <span>Betech Solar Website</span>
              </a>
              <Link
                href="/help"
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 transition hover:border-white/20 hover:bg-white/[0.06]"
              >
                <Headphones className="h-4 w-4" />
                <span>Help</span>
              </Link>
            </div>
          </div>
        </header>

        <main className="flex-1 pt-5 sm:pt-6">
          <section className="rounded-[34px] border border-white/10 bg-[linear-gradient(180deg,rgba(5,8,17,0.9),rgba(6,9,18,0.82))] px-5 py-8 shadow-[0_28px_90px_rgba(0,0,0,0.35)] backdrop-blur sm:px-8 sm:py-10 lg:px-10 lg:py-12">
            <div className="mx-auto flex max-w-[900px] flex-col items-center text-center">
              <div className="w-[180px] sm:w-[220px] lg:w-[290px]">
                <Image
                  src="/agents/betech-logo-crop.png"
                  alt="Betech Solar Solutions logo"
                  width={580}
                  height={400}
                  priority
                  className="h-auto w-full object-contain drop-shadow-[0_14px_42px_rgba(0,0,0,0.35)]"
                />
              </div>

              <h1 className="mt-5 text-[3.4rem] font-semibold leading-none tracking-tight sm:text-[4.7rem] lg:text-[6rem]">
                <span className="text-white">Betech</span>
                <span className="bg-[linear-gradient(135deg,#8b5cf6,#a855f7,#d8b4fe)] bg-clip-text text-transparent">Ops</span>
              </h1>
              <div className="mt-4 text-[12px] uppercase tracking-[0.34em] text-slate-300 sm:text-[15px]">
                Betech Solar Digital Access Portal
              </div>
              <div className="mt-5 h-[2px] w-28 rounded-full bg-[linear-gradient(90deg,transparent,#8b5cf6,transparent)]" />
              <p className="mt-6 max-w-[620px] text-lg leading-8 text-slate-200 sm:text-[1.8rem] sm:leading-[1.9] lg:text-[2rem] lg:leading-[1.8]">
                Access Betech Solar services and operations from one secure place.
              </p>
              <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-violet-400/25 bg-violet-500/8 px-4 py-2 text-sm font-medium text-violet-100 shadow-[0_0_24px_rgba(168,85,247,0.14)] sm:text-base">
                <ShieldCheck className="h-4 w-4 shrink-0" />
                <span>Secure. Reliable. Always Protected.</span>
              </div>
            </div>

            <div className="mt-8 grid gap-4 lg:mt-10 lg:grid-cols-3">
              {ACCESS_CARDS.map((card) => {
                const Icon = card.icon;
                return (
                  <article
                    key={card.title}
                    className={`relative overflow-hidden rounded-[30px] border bg-[linear-gradient(180deg,rgba(7,11,21,0.98),rgba(9,14,27,0.92))] p-5 shadow-[0_20px_70px_rgba(0,0,0,0.28)] sm:p-6 ${card.border}`}
                  >
                    <div className={`pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.04),transparent_42%)]`} />
                    <div className={`pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,transparent,rgba(255,255,255,0.01))]`} />
                    <div className={`pointer-events-none absolute -right-10 top-0 h-40 w-40 rounded-full blur-3xl ${card.accent}`} />

                    <div className={`relative inline-flex h-16 w-16 items-center justify-center rounded-full border bg-white/[0.03] ${card.iconWrap}`}>
                      <Icon className="h-8 w-8" />
                    </div>

                    <h2 className="relative mt-7 text-[2rem] font-semibold tracking-tight text-white">{card.title}</h2>
                    <div className="relative mt-3 h-[2px] w-14 rounded-full bg-white/20" />
                    <p className="relative mt-5 min-h-[88px] text-base leading-8 text-slate-300 sm:min-h-[96px]">
                      {card.description}
                    </p>

                    <Link
                      {...cardLinkProps(card.href, card.external)}
                      className={`relative mt-6 inline-flex w-full items-center justify-between rounded-2xl border px-5 py-4 text-lg font-semibold transition ${card.button}`}
                    >
                      <span>{card.title.replace("Login", "Login")}</span>
                      <ArrowRight className="h-5 w-5" />
                    </Link>

                    <div className={`relative mt-6 inline-flex items-center gap-2 text-sm ${card.helperTone}`}>
                      <ShieldCheck className="h-4 w-4" />
                      <span>{card.helper}</span>
                    </div>
                  </article>
                );
              })}
            </div>

            <section className="mt-6 rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,12,23,0.92),rgba(8,12,23,0.75))] px-4 py-5 sm:px-6">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {SUPPORTING_BLOCKS.map((block, index) => {
                  const Icon = block.icon;
                  return (
                    <div
                      key={block.title}
                      className={`flex items-start gap-4 ${index < SUPPORTING_BLOCKS.length - 1 ? "xl:border-r xl:border-white/10 xl:pr-5" : ""}`}
                    >
                      <div className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-violet-400/30 bg-violet-500/10 text-violet-100 shadow-[0_0_22px_rgba(168,85,247,0.15)]">
                        <Icon className="h-6 w-6" />
                      </div>
                      <div>
                        <div className="text-lg font-semibold text-white">{block.title}</div>
                        <p className="mt-1 text-sm leading-7 text-slate-300">{block.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </section>
        </main>

        <footer className="mt-6 rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(5,8,17,0.92),rgba(6,9,18,0.84))] px-4 py-5 backdrop-blur sm:px-6">
          <div className="flex flex-col items-center gap-5 text-center lg:flex-row lg:justify-between lg:text-left">
            <div className="text-sm leading-7 text-slate-300">
              <div>© 2026 Betech Solar Solutions.</div>
              <div>All rights reserved.</div>
            </div>

            <div className="w-[92px] shrink-0">
              <Image
                src="/agents/betech-logo-crop.png"
                alt="Betech Solar Solutions"
                width={184}
                height={126}
                className="h-auto w-full object-contain opacity-95"
              />
            </div>

            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm text-slate-300">
              <Link href="/privacy" className="transition hover:text-white">
                Privacy Policy
              </Link>
              <span className="hidden text-white/25 sm:inline">|</span>
              <Link href="/terms" className="transition hover:text-white">
                Terms of Service
              </Link>
              <span className="hidden text-white/25 sm:inline">|</span>
              <Link href="/help" className="transition hover:text-white">
                Help
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
