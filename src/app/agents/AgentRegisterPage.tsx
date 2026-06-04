import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CircleDollarSign, MapPinned, Smartphone } from "lucide-react";
import AgentRegisterForm from "@/app/agents/_components/AgentRegisterForm";
import { auth } from "@/lib/auth";
import { agentPath } from "@/lib/agents/host";

type AgentRegisterPageProps = {
  useRootPaths?: boolean;
};

const chips = ["Free to join", "Earn 6% commission", "M-Pesa payouts", "Work from anywhere in Kenya"];

const trustPoints = [
  { label: "Earn up to 6%", icon: CircleDollarSign },
  { label: "Withdraw via M-Pesa", icon: Smartphone },
  { label: "Work anywhere in Kenya", icon: MapPinned },
];

const registerProducts = [
  { name: "SRNE 20KW Lithium Solar System", price: 950000, image: "/agents/products/srne-20kw-lithium-solar-system.jpeg" },
  { name: "SRNE 10KW Lithium Solar Power System", price: 550000, image: "/agents/products/srne-10kw-lithium-solar-power-system.jpeg" },
  { name: "8KW Lithium Battery Kit", price: 350000, image: "/agents/products/8kw-lithium-battery-kit.jpeg" },
  { name: "SRNE 5KW Lithium Solar System", price: 280000, image: "/agents/products/srne-5kw-lithium-solar-system.jpeg" },
  { name: "4KW Lithium Solar Kit", price: 90000, image: "/agents/products/4kw-lithium-solar-kit.jpeg" },
  { name: "2KW Lithium Powerstation", price: 86400, image: "/agents/products/2kw-lithium-powerstation.jpeg" },
];

function formatCurrency(value: number) {
  return `Ksh ${value.toLocaleString()}`;
}

export default async function AgentRegisterPage({ useRootPaths = false }: AgentRegisterPageProps) {
  const session = await auth();
  if ((session?.user as { isAgent?: boolean } | undefined)?.isAgent) {
    redirect(agentPath("/dashboard", useRootPaths));
  }

  return (
    <div className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_right,rgba(242,178,15,0.18),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(122,0,0,0.12),transparent_26%),linear-gradient(180deg,#fffdf9_0%,#fff5ea_100%)] px-4 py-4 text-slate-950 sm:px-6 sm:py-6 lg:px-8 lg:py-10">
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes registerProductFlow {
              0% { transform: translateY(0); }
              100% { transform: translateY(-50%); }
            }

            .register-product-flow {
              animation: registerProductFlow 26s linear infinite;
            }

            .register-product-flow:hover {
              animation-play-state: paused;
            }
          `,
        }}
      />
      <div className="mx-auto max-w-7xl">
        <div className="mb-5 flex items-center justify-between sm:mb-6">
          <Link href={agentPath("/", useRootPaths)} className="flex items-center gap-3">
            <div className="overflow-hidden rounded-2xl border border-[#7a0000]/10 bg-white px-2 py-1 shadow-[0_14px_28px_rgba(122,0,0,0.10)]">
              <Image src="/agents/betech-logo-crop.png" alt="Betech Solar Solutions" width={112} height={84} className="h-12 w-auto object-contain" />
            </div>
            <div className="hidden leading-tight sm:block">
              <div className="text-sm font-black uppercase tracking-[0.18em] text-[#7a0000]">Betech Agents Program</div>
              <div className="text-xs text-slate-500">Solar sales opportunity</div>
            </div>
          </Link>
          <Link
            href={agentPath("/login", useRootPaths)}
            className="hidden rounded-2xl border border-[#7a0000]/12 bg-white px-4 py-3 text-sm font-semibold text-[#7a0000] shadow-[0_12px_24px_rgba(15,23,42,0.05)] transition hover:-translate-y-0.5 sm:inline-flex"
          >
            Sign In
          </Link>
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-stretch lg:gap-8">
          <div className="order-2 space-y-6 lg:order-1">
            <div className="rounded-[2rem] border border-[#7a0000]/10 bg-[linear-gradient(180deg,#fff9ef_0%,#ffffff_100%)] p-5 shadow-[0_28px_70px_rgba(122,0,0,0.10)] sm:p-7">
              <div className="inline-flex rounded-full border border-[#f2b20f]/30 bg-[#fff3d8] px-4 py-2 text-xs font-black uppercase tracking-[0.24em] text-[#7a0000]">
                BETECH AGENTS PROGRAM
              </div>
              <h1 className="mt-5 max-w-2xl text-3xl font-black leading-tight text-slate-950 sm:text-4xl md:text-5xl">
                Create Your Agent Account & Start Referring Solar Customers
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
                Join for free, refer customers, and earn 6% commission after every successful completed sale.
              </p>

              <div className="mt-6 flex flex-wrap gap-2.5 sm:mt-8 sm:gap-3">
                {chips.map((chip) => (
                  <div key={chip} className="rounded-full border border-[#f2b20f]/20 bg-[#fff8eb] px-4 py-2 text-sm font-bold text-[#7a0000] shadow-[0_10px_22px_rgba(15,23,42,0.04)]">
                    {chip}
                  </div>
                ))}
              </div>

              <div className="mt-6 rounded-[1.8rem] border border-[#7a0000]/10 bg-white p-4 shadow-[0_18px_40px_rgba(15,23,42,0.05)] sm:mt-8 sm:p-5">
                <div className="text-xs font-black uppercase tracking-[0.22em] text-[#7a0000]">Refer → Customer Pays → Betech Delivers → You Earn</div>
                <div className="mt-4 grid gap-3 sm:gap-4 sm:grid-cols-3">
                  {trustPoints.map((item, index) => {
                    const Icon = item.icon;
                    return (
                      <div
                        key={item.label}
                        className={`rounded-[1.4rem] border px-4 py-4 shadow-[0_12px_24px_rgba(15,23,42,0.04)] ${index === 1 ? "border-[#7a0000]/12 bg-[#fff8f5]" : "border-[#f2b20f]/20 bg-[#fffaf1]"}`}
                      >
                        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${index === 1 ? "bg-[#7a0000] text-white" : "bg-[#fff3d8] text-[#7a0000]"}`}>
                          <Icon className="h-6 w-6" />
                        </div>
                        <div className="mt-3 text-sm font-semibold text-slate-700">{item.label}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-[1.05fr_0.95fr] md:gap-6">
              <div className="rounded-[2rem] border border-[#7a0000]/10 bg-white p-4 shadow-[0_24px_50px_rgba(15,23,42,0.06)] sm:p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-black uppercase tracking-[0.2em] text-[#7a0000]">Commission motivation</div>
                    <div className="mt-2 text-xl font-black text-slate-950 sm:text-2xl">Sell trusted solar products and build a real income stream.</div>
                  </div>
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#7a0000_0%,#9a1111_100%)] text-[#ffd761] shadow-[0_16px_32px_rgba(122,0,0,0.18)]">
                    <CircleDollarSign className="h-8 w-8" />
                  </div>
                </div>
                <div className="overflow-hidden rounded-[1.8rem] border border-[#7a0000]/10 bg-[linear-gradient(180deg,#fffdf8_0%,#fff6ee_100%)] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                  <div className="max-h-[30rem] overflow-hidden sm:max-h-[34rem]">
                    <div className="register-product-flow flex flex-col gap-4">
                      {[...registerProducts, ...registerProducts].map((product, index) => {
                        const commission = Math.round(product.price * 0.06);
                        return (
                          <div
                            key={`${product.name}-${index}`}
                            className="rounded-[1.5rem] border border-[#7a0000]/8 bg-white p-3 shadow-[0_14px_28px_rgba(15,23,42,0.05)] sm:p-4"
                          >
                            <div className="flex gap-3 sm:gap-4">
                              <div className="overflow-hidden rounded-[1.2rem] border border-[#7a0000]/10 bg-[#fcfaf7] p-2 shadow-[0_10px_22px_rgba(15,23,42,0.04)]">
                                <div className="relative h-24 w-20 sm:h-28 sm:w-24">
                                  <Image src={product.image} alt={product.name} fill className="object-contain" />
                                </div>
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="text-sm font-black uppercase tracking-[0.16em] text-[#7a0000]">Earn 6% Commission</div>
                                <h3 className="mt-2 text-base font-black leading-tight text-slate-950 sm:text-lg">{product.name}</h3>
                                <div className="mt-3 text-sm text-slate-500">Product Price</div>
                                <div className="mt-1 text-xl font-black text-slate-950">{formatCurrency(product.price)}</div>
                                <div className="mt-3 rounded-xl bg-[linear-gradient(135deg,#7a0000_0%,#991010_100%)] px-3 py-3 text-white shadow-[0_12px_24px_rgba(122,0,0,0.16)]">
                                  <div className="text-xs font-black uppercase tracking-[0.18em] text-[#ffd761]">Commission</div>
                                  <div className="mt-1 text-xl font-black sm:text-2xl">{formatCurrency(commission)}</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-[2rem] border border-[#7a0000]/10 bg-[linear-gradient(180deg,#7a0000_0%,#4d0000_100%)] p-5 text-white shadow-[0_30px_70px_rgba(122,0,0,0.18)] sm:p-6">
                <div className="inline-flex rounded-full bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-[#ffd761]">
                  Start earning in 3 simple steps
                </div>
                <div className="mt-6 space-y-4">
                  {[
                    "Create your free agent account",
                    "Submit customer orders",
                    "Earn 6% after completed sales",
                  ].map((line, index) => (
                    <div key={line} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/6 px-4 py-4">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#ffd761] text-sm font-black text-slate-950">
                        {index + 1}
                      </div>
                      <div className="text-sm leading-7 text-white/85">{line}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-6 rounded-[1.4rem] border border-white/10 bg-white/8 px-4 py-4 text-sm leading-7 text-white/78">
                  Your account may be reviewed by Betech before commissions are paid.
                </div>
              </div>
            </div>
          </div>

          <div className="order-1 lg:order-2">
            <div className="rounded-[2rem] border border-[#7a0000]/10 bg-[linear-gradient(180deg,#fff9ef_0%,#ffffff_100%)] p-5 shadow-[0_32px_80px_rgba(122,0,0,0.12)] sm:p-8">
              <AgentRegisterForm useRootPaths={useRootPaths} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
