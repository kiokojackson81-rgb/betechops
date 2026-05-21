import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BadgeCheck, MessageCircle, ShieldCheck, Sparkles } from "lucide-react";
import TrustBadges from "@/app/shop/_components/TrustBadges";
import { shopStyles } from "@/app/shop/_components/shopStyles";

type ShopHeroProps = {
  highlights: { label: string; value: string; note: string }[];
  trustBadges: { title: string; copy: string }[];
};

function heroCard(label: string, value: string, note: string) {
  return (
    <div className="rounded-[24px] border border-white/60 bg-white/92 p-4 shadow-[0_24px_60px_rgba(0,0,0,0.10)] backdrop-blur transition duration-300 hover:-translate-y-1 hover:shadow-[0_32px_80px_rgba(0,0,0,0.14)]">
      <div className="text-[11px] font-semibold uppercase tracking-[0.26em] text-[#7a0000]/70">{label}</div>
      <div className="mt-2 text-xl font-black text-slate-950 sm:text-2xl">{value}</div>
      <div className="mt-1 text-sm leading-6 text-slate-500">{note}</div>
    </div>
  );
}

export default function ShopHero({ highlights, trustBadges }: ShopHeroProps) {
  return (
    <section className="pt-4 sm:pt-6">
      <div className={shopStyles.shell}>
        <div className={`${shopStyles.darkPanel} overflow-hidden p-4 sm:p-6 lg:p-8 xl:p-10`}>
          <div className="grid gap-6 lg:grid-cols-[1.02fr_0.98fr] lg:items-center">
            <div className="relative z-10">
              <div className="inline-flex w-fit rounded-full border border-[#f2b20f]/30 bg-[#fff3d8] px-4 py-2 text-xs font-black uppercase tracking-[0.24em] text-[#7a0000] shadow-[0_12px_24px_rgba(242,178,15,0.18)]">
                Official Betech Solar Solutions store
              </div>

              <h1 className="mt-5 max-w-3xl text-4xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl">
                Shop Genuine Solar Products
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-white/78 sm:text-lg">
                Panels, Batteries, Inverters, Full Kits, Pumps &amp; Solar Accessories delivered countrywide from Betech Solar Solutions.
              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:flex lg:flex-wrap">
                <Link href="#best-selling-solar-kits" className={`${shopStyles.goldButton} min-h-[3.5rem] w-full sm:w-auto`}>
                  Shop Products
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="#quote" className={`${shopStyles.secondaryButton} min-h-[3.5rem] w-full bg-white/92 sm:w-auto`}>
                  Request Free Quote
                  <MessageCircle className="h-4 w-4" />
                </Link>
              </div>

              <div className="mt-6 flex flex-wrap gap-3 text-sm text-white/78">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/8 px-4 py-2 backdrop-blur">
                  <ShieldCheck className="h-4 w-4 text-[#ffd761]" />
                  Warranty support
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/8 px-4 py-2 backdrop-blur">
                  <BadgeCheck className="h-4 w-4 text-[#ffd761]" />
                  Genuine products
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/8 px-4 py-2 backdrop-blur">
                  <Sparkles className="h-4 w-4 text-[#ffd761]" />
                  Expert solar guidance
                </div>
              </div>
            </div>

            <div className="relative min-w-0">
              <div className="absolute -left-4 top-10 h-40 w-40 rounded-full bg-[#f2b20f]/20 blur-3xl" />
              <div className="absolute right-0 top-0 h-48 w-48 rounded-full bg-[#7a0000]/18 blur-3xl" />

              <div className="grid gap-4 lg:grid-cols-[0.94fr_1.06fr]">
                <div className="grid gap-4">
                  {highlights.slice(0, 2).map((item) => (
                    <div key={item.label}>{heroCard(item.label, item.value, item.note)}</div>
                  ))}
                </div>

                <div className="relative overflow-hidden rounded-[28px] border border-white/70 bg-[linear-gradient(160deg,#fff_0%,#fff7ef_45%,#fff0dc_100%)] p-3 shadow-[0_35px_90px_rgba(122,0,0,0.16)] sm:p-5">
                  <div className="rounded-[22px] border border-white/70 bg-[radial-gradient(circle_at_top,#fffaf1_0%,#fff_44%,#fff6ea_100%)] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] sm:rounded-[30px] sm:p-4">
                    <div className="overflow-hidden rounded-[28px] border border-[#7a0000]/10 bg-white shadow-[0_24px_60px_rgba(122,0,0,0.14)]">
                      <div className="relative h-[15rem] bg-[#f6eee2] sm:h-[20rem]">
                        <Image
                          src="/agents/hero-generated-v2.png"
                          alt="Betech Solar Online Store hero"
                          fill
                          sizes="(max-width: 1024px) 100vw, 34rem"
                          className="object-cover object-center"
                        />
                        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#2a0700]/22 via-transparent to-transparent" />
                      </div>

                      <div className="grid gap-3 p-4 sm:grid-cols-2">
                        <div className="rounded-[22px] bg-[linear-gradient(135deg,#7a0000_0%,#991010_100%)] px-4 py-4 text-white shadow-[0_16px_34px_rgba(122,0,0,0.18)]">
                          <div className="text-sm font-bold uppercase tracking-[0.16em] text-[#ffd761]">Betech Solar Solutions</div>
                          <div className="mt-2 text-2xl font-black">Panels to full systems</div>
                        </div>
                        <div>{heroCard(highlights[2].label, highlights[2].value, highlights[2].note)}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 lg:mt-8">
            <TrustBadges items={trustBadges} />
          </div>
        </div>
      </div>
    </section>
  );
}
