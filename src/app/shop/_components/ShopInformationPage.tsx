import type { LucideIcon } from "lucide-react";
import { ArrowRight, CheckCircle2, MessageCircle } from "lucide-react";
import Link from "next/link";
import FloatingWhatsApp from "@/app/shop/_components/FloatingWhatsApp";
import ShopFooter from "@/app/shop/_components/ShopFooter";
import ShopHeader from "@/app/shop/_components/ShopHeader";
import { shopStyles } from "@/app/shop/_components/shopStyles";
import { shopNavLinks } from "@/app/shop/shopData";

export type ShopInformationSection = {
  id: string;
  title: string;
  icon: LucideIcon;
  paragraphs?: string[];
  bullets?: string[];
  note?: string;
};

type ShopInformationPageProps = {
  eyebrow: string;
  title: string;
  introduction: string;
  heroIcon: LucideIcon;
  highlights: { title: string; copy: string }[];
  sections: ShopInformationSection[];
  supportTitle: string;
  supportCopy: string;
  whatsappMessage: string;
};

export default function ShopInformationPage({
  eyebrow,
  title,
  introduction,
  heroIcon: HeroIcon,
  highlights,
  sections,
  supportTitle,
  supportCopy,
  whatsappMessage,
}: ShopInformationPageProps) {
  const whatsappHref = `https://wa.me/254722151083?text=${encodeURIComponent(whatsappMessage)}`;

  return (
    <div className={shopStyles.page}>
      <ShopHeader navLinks={shopNavLinks} />
      <main>
        <section className="border-b border-[#7a0000]/8 bg-[radial-gradient(circle_at_15%_10%,rgba(242,178,15,0.18),transparent_26%),linear-gradient(180deg,#fffaf2_0%,#fcfaf7_100%)] py-8 sm:py-12">
          <div className={shopStyles.shell}>
            <div className="grid gap-6 overflow-hidden rounded-[28px] border border-[#7a0000]/10 bg-[linear-gradient(135deg,#3a0800_0%,#720000_48%,#210300_100%)] p-6 text-white shadow-[0_30px_70px_rgba(88,0,0,0.22)] sm:p-9 lg:grid-cols-[1fr_0.75fr] lg:items-center lg:p-12">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-[#f2b20f]/30 bg-[#f2b20f]/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.2em] text-[#ffd761]">
                  <HeroIcon className="h-4 w-4" />
                  {eyebrow}
                </div>
                <h1 className="mt-5 max-w-3xl text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">{title}</h1>
                <p className="mt-4 max-w-3xl text-sm leading-7 text-white/78 sm:text-base sm:leading-8">{introduction}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                {highlights.map((highlight) => (
                  <div key={highlight.title} className="rounded-[20px] border border-white/10 bg-white/7 p-4 backdrop-blur">
                    <div className="font-black text-[#ffd761]">{highlight.title}</div>
                    <div className="mt-1 text-xs leading-5 text-white/70">{highlight.copy}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="py-8 sm:py-12">
          <div className={`${shopStyles.shell} grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]`}>
            <aside className="h-fit rounded-[24px] border border-[#7a0000]/10 bg-white p-4 shadow-[0_18px_40px_rgba(15,23,42,0.05)] lg:sticky lg:top-28">
              <div className="px-2 text-[11px] font-black uppercase tracking-[0.2em] text-[#7a0000]">On this page</div>
              <nav className="mt-3 grid gap-1.5">
                {sections.map((section) => (
                  <a key={section.id} href={`#${section.id}`} className="flex items-center justify-between rounded-2xl px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-[#fff7ea] hover:text-[#7a0000]">
                    {section.title}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </a>
                ))}
              </nav>
            </aside>

            <div className="grid gap-5">
              {sections.map((section) => {
                const Icon = section.icon;
                return (
                  <section key={section.id} id={section.id} className="scroll-mt-28 rounded-[26px] border border-[#7a0000]/10 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.05)] sm:p-7">
                    <div className="flex items-start gap-4">
                      <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#fff3d8] text-[#7a0000]">
                        <Icon className="h-5 w-5" />
                      </span>
                      <div>
                        <h2 className="text-xl font-black tracking-tight text-slate-950 sm:text-2xl">{section.title}</h2>
                        {section.paragraphs?.length ? (
                          <div className="mt-4 space-y-4 text-sm leading-7 text-slate-600 sm:text-[15px] sm:leading-8">
                            {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                          </div>
                        ) : null}
                      </div>
                    </div>
                    {section.bullets?.length ? (
                      <ul className="mt-5 grid gap-3 sm:grid-cols-2">
                        {section.bullets.map((bullet) => (
                          <li key={bullet} className="flex gap-3 rounded-2xl border border-[#7a0000]/8 bg-[#fcfaf7] p-4 text-sm leading-6 text-slate-700">
                            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#0f9d58]" />
                            <span>{bullet}</span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {section.note ? <div className="mt-5 rounded-2xl border-l-4 border-[#f2b20f] bg-[#fff7ea] p-4 text-sm font-semibold leading-6 text-[#5b2600]">{section.note}</div> : null}
                  </section>
                );
              })}

              <section className="rounded-[26px] border border-[#7a0000]/10 bg-[linear-gradient(135deg,#fff3d8_0%,#ffffff_72%)] p-6 shadow-[0_18px_45px_rgba(15,23,42,0.05)] sm:flex sm:items-center sm:justify-between sm:gap-6 sm:p-8">
                <div>
                  <h2 className="text-xl font-black text-slate-950 sm:text-2xl">{supportTitle}</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600">{supportCopy}</p>
                </div>
                <Link href={whatsappHref} target="_blank" rel="noreferrer" className={`${shopStyles.whatsappButton} mt-5 shrink-0 sm:mt-0`}>
                  <MessageCircle className="h-4 w-4" />
                  Contact customer service
                </Link>
              </section>
            </div>
          </div>
        </section>
      </main>
      <ShopFooter />
      <FloatingWhatsApp />
    </div>
  );
}
