import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  BadgeCheck,
  CircleDollarSign,
  MapPinned,
  PanelsTopLeft,
  Smartphone,
} from "lucide-react";
import AgentLoginForm from "@/app/agents/_components/AgentLoginForm";
import { auth } from "@/lib/auth";
import { agentPath } from "@/lib/agents/host";

type AgentLoginPageProps = {
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
];

const trustPoints = [
  { label: "Nationwide delivery", icon: MapPinned },
  { label: "Real-time commission tracking", icon: PanelsTopLeft },
  { label: "M-Pesa payouts", icon: Smartphone },
  { label: "Installation support", icon: BadgeCheck },
];

export default async function AgentLoginPage({ useRootPaths = false }: AgentLoginPageProps) {
  const session = await auth();
  if ((session?.user as { isAgent?: boolean } | undefined)?.isAgent) {
    redirect(agentPath("/dashboard", useRootPaths));
  }

  return (
    <div className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_right,rgba(242,178,15,0.20),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(122,0,0,0.12),transparent_26%),linear-gradient(180deg,#fffdf9_0%,#fff5ea_100%)] px-4 py-6 text-slate-950 sm:px-6 lg:px-8 lg:py-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-center justify-between">
          <Link href={agentPath("/", useRootPaths)} className="flex items-center gap-3">
            <div className="overflow-hidden rounded-2xl border border-[#7a0000]/10 bg-white shadow-[0_14px_28px_rgba(122,0,0,0.10)]">
              <Image src="/agents/betech-logo-crop.png" alt="Betech Solar Solutions" width={56} height={56} className="h-12 w-12 object-contain" />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-black uppercase tracking-[0.18em] text-[#7a0000]">Betech Agents</div>
              <div className="text-xs text-slate-500">Solar sales network</div>
            </div>
          </Link>
          <Link
            href={agentPath("/register", useRootPaths)}
            className="hidden rounded-2xl border border-[#7a0000]/12 bg-white px-4 py-3 text-sm font-semibold text-[#7a0000] shadow-[0_12px_24px_rgba(15,23,42,0.05)] transition hover:-translate-y-0.5 sm:inline-flex"
          >
            Create Account
          </Link>
        </div>

        <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-stretch">
          <div className="order-2 space-y-6 lg:order-1">
            <div className="rounded-[2rem] border border-[#7a0000]/10 bg-[linear-gradient(180deg,#fff9ef_0%,#ffffff_100%)] p-7 shadow-[0_28px_70px_rgba(122,0,0,0.10)]">
              <div className="inline-flex rounded-full border border-[#f2b20f]/30 bg-[#fff3d8] px-4 py-2 text-xs font-black uppercase tracking-[0.24em] text-[#7a0000]">
                BETECH AGENTS
              </div>
              <h1 className="mt-6 max-w-2xl text-4xl font-black leading-tight text-slate-950 md:text-5xl">
                Earn commission by referring solar customers across Kenya.
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
                Share Betech Solar products, submit customer orders, and earn 6% commission after successful delivery and payment.
              </p>

              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                {productHighlights.map((item) => (
                  <div
                    key={item.title}
                    className={`rounded-[1.6rem] border p-5 shadow-[0_16px_34px_rgba(15,23,42,0.06)] transition duration-300 hover:-translate-y-1 ${
                      item.tone === "gold"
                        ? "border-[#f2b20f]/25 bg-[linear-gradient(180deg,#fff5de_0%,#fffdfa_100%)]"
                        : "border-[#7a0000]/12 bg-[linear-gradient(180deg,#fff8f5_0%,#ffffff_100%)]"
                    }`}
                  >
                    <div className={`inline-flex rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.18em] ${
                      item.tone === "gold" ? "bg-[#f2b20f] text-slate-950" : "bg-[#7a0000] text-white"
                    }`}>
                      Opportunity
                    </div>
                    <div className="mt-4 text-2xl font-black text-slate-950">{item.title}</div>
                    <div className="mt-2 text-sm leading-7 text-slate-600">{item.copy}</div>
                  </div>
                ))}
              </div>

              <div className="mt-8 grid gap-4 sm:grid-cols-4">
                {trustPoints.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.label} className="rounded-[1.4rem] border border-[#7a0000]/8 bg-white px-4 py-4 text-center shadow-[0_12px_26px_rgba(15,23,42,0.05)]">
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fff3d8] text-[#7a0000]">
                        <Icon className="h-6 w-6" />
                      </div>
                      <div className="mt-3 text-sm font-semibold text-slate-700">{item.label}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-[1.05fr_0.95fr]">
              <div className="rounded-[2rem] border border-[#7a0000]/10 bg-white p-5 shadow-[0_24px_50px_rgba(15,23,42,0.06)]">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-black uppercase tracking-[0.2em] text-[#7a0000]">6% commission on completed sales</div>
                    <div className="mt-2 text-2xl font-black text-slate-950">Refer solar systems, batteries, inverters & more</div>
                  </div>
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#7a0000_0%,#9a1111_100%)] text-[#ffd761] shadow-[0_16px_32px_rgba(122,0,0,0.18)]">
                    <CircleDollarSign className="h-8 w-8" />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {[
                    "/agents/product-solar-kit-generated.png",
                    "/agents/product-battery-generated.png",
                    "/agents/product-inverter-generated.png",
                    "/agents/product-water-pump-generated.png",
                  ].map((src, index) => (
                    <div key={src} className={`overflow-hidden rounded-[1.4rem] border border-[#7a0000]/8 bg-[#fcfaf7] p-4 shadow-[0_12px_24px_rgba(15,23,42,0.04)] transition duration-300 hover:-translate-y-1 ${index === 0 ? "sm:col-span-2" : ""}`}>
                      <div className={`relative ${index === 0 ? "aspect-[16/9]" : "aspect-[4/3]"}`}>
                        <Image src={src} alt="Betech solar product" fill className="object-contain" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[2rem] border border-[#7a0000]/10 bg-[linear-gradient(180deg,#7a0000_0%,#4d0000_100%)] p-6 text-white shadow-[0_30px_70px_rgba(122,0,0,0.18)]">
                <div className="inline-flex rounded-full bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-[#ffd761]">
                  Why agents stay
                </div>
                <h2 className="mt-5 text-3xl font-black leading-tight">Track every customer order from one dashboard.</h2>
                <p className="mt-4 text-base leading-8 text-white/75">
                  Submit referrals, monitor commissions, and build a real income stream with a trusted solar brand.
                </p>
                <div className="mt-8 space-y-4">
                  {[
                    "Premium solar products customers already need",
                    "Warm leads from homes, farms, and businesses",
                    "Fast M-Pesa withdrawals after completed sales",
                  ].map((line) => (
                    <div key={line} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/6 px-4 py-4">
                      <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#ffd761]" />
                      <div className="text-sm leading-7 text-white/85">{line}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="order-1 lg:order-2">
            <div className="rounded-[2rem] border border-[#7a0000]/10 bg-[linear-gradient(180deg,#fff9ef_0%,#ffffff_100%)] p-6 shadow-[0_32px_80px_rgba(122,0,0,0.12)] sm:p-8">
              <AgentLoginForm useRootPaths={useRootPaths} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
