import type { Metadata } from "next";
import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BadgeCheck, FileText, MessageCircle, Phone, ShieldCheck, WalletCards } from "lucide-react";
import LipaPolePoleTermsActions from "./LipaPolePoleTermsActions";
import {
  getLipaPolePoleTermsSections,
  LIPA_POLE_POLE_TERMS_DISPLAY_URL,
  LIPA_POLE_POLE_TERMS_INTRODUCTION,
  LIPA_POLE_POLE_TERMS_URL,
} from "@/lib/lipaPolePoleTerms";

export const metadata: Metadata = {
  title: {
    absolute: "Lipa Pole Pole Terms & Conditions | Betech Solar Solutions",
  },
  description:
    "Read the Betech Solar Solutions Lipa Pole Pole product reservation, gradual payment, collection, cancellation and refund terms.",
  alternates: { canonical: LIPA_POLE_POLE_TERMS_URL },
  openGraph: {
    type: "website",
    title: "Lipa Pole Pole Terms & Conditions | Betech Solar Solutions",
    description: "Pay gradually, complete payment, then collect your product from Betech Solar Solutions.",
    url: LIPA_POLE_POLE_TERMS_URL,
  },
  twitter: {
    card: "summary_large_image",
    title: "Lipa Pole Pole Terms & Conditions | Betech Solar Solutions",
    description: "Pay gradually, complete payment, then collect your product from Betech Solar Solutions.",
  },
};

function renderInlineMarkdown(value: string): ReactNode[] {
  return value.split(/(\*\*.+?\*\*)/g).map((part, index) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={`${part}-${index}`} className="font-extrabold text-slate-950 print:text-black">
        {part.slice(2, -2)}
      </strong>
    ) : (
      part
    ),
  );
}

function MarkdownBlocks({ markdown }: { markdown: string }) {
  const blocks = markdown.split(/\n\s*\n/).map((block) => block.trim()).filter(Boolean);

  return (
    <div className="mt-5 space-y-4 text-[15px] leading-7 text-slate-700 sm:text-base sm:leading-8 print:text-[10.5pt] print:leading-6 print:text-black">
      {blocks.map((block, blockIndex) => {
        const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
        const isBulletList = lines.every((line) => /^\*\s+/.test(line));
        const isNumberedList = lines.every((line) => /^\d+\.\s+/.test(line));

        if (isBulletList || isNumberedList) {
          const List = isNumberedList ? "ol" : "ul";
          return (
            <List
              key={`${block.slice(0, 36)}-${blockIndex}`}
              className={`grid gap-2 pl-5 ${isNumberedList ? "list-decimal" : "list-disc marker:text-amber-600"}`}
            >
              {lines.map((line, lineIndex) => (
                <li key={`${line}-${lineIndex}`} className="pl-1">
                  {renderInlineMarkdown(line.replace(isNumberedList ? /^\d+\.\s+/ : /^\*\s+/, ""))}
                </li>
              ))}
            </List>
          );
        }

        return (
          <p key={`${block.slice(0, 36)}-${blockIndex}`} className="whitespace-pre-line">
            {renderInlineMarkdown(block)}
          </p>
        );
      })}
    </div>
  );
}

export default function LipaPolePoleTermsPage() {
  const sections = getLipaPolePoleTermsSections();

  return (
    <div className="lpp-terms-shell min-h-screen bg-[#07130f] text-white">
      <style>{`
        .lpp-terms-display { font-family: Georgia, "Times New Roman", serif; }
        @media print {
          @page { size: A4; margin: 14mm; }
          html, body { background: #fff !important; color: #111827 !important; }
          .lpp-terms-shell, .lpp-terms-main { background: #fff !important; }
          .lpp-terms-hero, .lpp-terms-card, .lpp-terms-contact {
            border-color: #d1d5db !important;
            background: #fff !important;
            box-shadow: none !important;
            color: #111827 !important;
          }
          .lpp-terms-card { break-inside: avoid; }
          .lpp-terms-hero h1, .lpp-terms-card h2, .lpp-terms-contact h2 { color: #111827 !important; }
          .lpp-terms-hero p, .lpp-terms-contact p { color: #374151 !important; }
          a[href]::after { content: ""; }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 print:hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_8%,rgba(245,158,11,0.18),transparent_25%),radial-gradient(circle_at_88%_12%,rgba(34,197,94,0.14),transparent_24%),linear-gradient(180deg,#07130f_0%,#0b1c16_45%,#06100c_100%)]" />
          <div className="absolute inset-x-0 top-0 h-[650px] bg-[linear-gradient(115deg,rgba(7,19,15,0.3),rgba(7,19,15,0.92)),url('/homepage/hero-solar-sunset.png')] bg-cover bg-center opacity-65" />
          <div className="absolute inset-x-0 top-[430px] h-64 bg-gradient-to-b from-transparent to-[#07130f]" />
        </div>

        <div className="lpp-terms-main relative mx-auto max-w-[1360px] px-4 py-4 sm:px-6 lg:px-8">
          <header className="lpp-terms-hero overflow-hidden rounded-[30px] border border-white/10 bg-[#091812]/90 shadow-[0_28px_90px_rgba(0,0,0,0.35)] backdrop-blur-xl">
            <div className="grid gap-8 px-5 py-6 sm:px-8 sm:py-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end lg:px-10 lg:py-10">
              <div>
                <div className="flex items-center gap-3">
                  <Image
                    src="/agents/betech-logo-crop.png"
                    alt="Betech Solar Solutions"
                    width={128}
                    height={88}
                    priority
                    className="h-auto w-[82px] rounded-2xl bg-white p-2 sm:w-[94px]"
                  />
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.34em] text-amber-300">Betech Solar Solutions</div>
                    <div className="mt-2 text-sm font-semibold text-emerald-100">Official customer terms</div>
                  </div>
                </div>
                <h1 className="lpp-terms-display mt-8 max-w-4xl text-4xl font-bold leading-[1.02] tracking-[-0.035em] text-white sm:text-6xl lg:text-7xl">
                  Lipa Pole Pole
                  <span className="block text-amber-300">Terms &amp; Conditions</span>
                </h1>
                <p className="mt-6 max-w-3xl text-base leading-8 text-emerald-50/80 sm:text-lg">
                  Pay gradually. Complete payment. Collect your product. These terms explain how your product is reserved, how payments are recorded, and when collection becomes available.
                </p>
              </div>

              <div className="rounded-[24px] border border-amber-300/20 bg-amber-200/[0.07] p-5">
                <div className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.16em] text-amber-300">
                  <ShieldCheck className="h-5 w-5" />
                  Before you start
                </div>
                <p className="mt-4 text-sm leading-7 text-emerald-50/80">
                  Lipa Pole Pole is not a loan. Your product remains with Betech until the agreed price is paid in full and the payment is confirmed.
                </p>
                <div className="mt-5 flex flex-wrap gap-3 print:hidden">
                  <LipaPolePoleTermsActions />
                  <a
                    href="https://wa.me/254722151083"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-white/10"
                  >
                    <MessageCircle className="h-4 w-4" /> Ask a question
                  </a>
                </div>
              </div>
            </div>
          </header>

          <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4 print:grid-cols-4">
            {[
              [WalletCards, "Pay gradually", "Make confirmed payments toward the agreed product price."],
              [ShieldCheck, "Not a loan", "This is a payment-before-collection product arrangement."],
              [BadgeCheck, "Price recorded", "The agreed Lipa Pole Pole price applies during the agreed period."],
              [ArrowRight, "Collect when paid", "Collection or delivery starts after 100% payment is confirmed."],
            ].map(([Icon, title, copy]) => {
              const FeatureIcon = Icon as typeof WalletCards;
              return (
                <div key={String(title)} className="lpp-terms-card rounded-[22px] border border-white/10 bg-white/[0.055] p-5 shadow-[0_16px_50px_rgba(0,0,0,0.16)] backdrop-blur">
                  <FeatureIcon className="h-5 w-5 text-amber-300 print:text-amber-700" />
                  <h2 className="mt-4 text-base font-black text-white print:text-black">{String(title)}</h2>
                  <p className="mt-2 text-sm leading-6 text-emerald-50/65 print:text-slate-700">{String(copy)}</p>
                </div>
              );
            })}
          </section>

          <main className="mt-6 grid gap-6 lg:grid-cols-[310px_minmax(0,1fr)] xl:grid-cols-[350px_minmax(0,1fr)]">
            <aside className="self-start lg:sticky lg:top-4 print:hidden">
              <div className="rounded-[26px] border border-white/10 bg-[#0a1913]/95 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
                <div className="flex items-center gap-2 text-sm font-black text-amber-200">
                  <FileText className="h-4 w-4" />
                  Contents
                </div>
                <p className="mt-3 text-sm leading-6 text-emerald-50/55">Select a section to jump directly to it.</p>
                <nav className="mt-4 max-h-[68vh] space-y-1 overflow-y-auto pr-2" aria-label="Lipa Pole Pole terms sections">
                  {sections.map((section) => (
                    <a
                      key={section.number}
                      href={`#section-${section.number}`}
                      className="block rounded-xl border border-transparent px-3 py-2 text-sm text-emerald-50/75 transition hover:border-amber-300/20 hover:bg-amber-300/10 hover:text-white"
                    >
                      <span className="mr-2 font-black text-amber-300">{String(section.number).padStart(2, "0")}</span>
                      {section.title}
                    </a>
                  ))}
                </nav>
              </div>
            </aside>

            <div className="space-y-5">
              <section className="lpp-terms-card rounded-[28px] border border-amber-300/20 bg-[#fffaf0] p-6 text-slate-900 shadow-[0_20px_70px_rgba(0,0,0,0.22)] sm:p-8">
                <div className="text-[11px] font-black uppercase tracking-[0.3em] text-amber-700">The arrangement</div>
                <div className="mt-5 space-y-4 text-[15px] leading-8 text-slate-700 sm:text-base">
                  {LIPA_POLE_POLE_TERMS_INTRODUCTION.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                </div>
                <div className="mt-6 rounded-2xl border border-amber-300/50 bg-amber-100/70 px-4 py-3 text-sm font-bold leading-6 text-amber-950">
                  Products are not released on partial payment.
                </div>
              </section>

              {sections.map((section) => (
                <section
                  key={section.number}
                  id={`section-${section.number}`}
                  className="lpp-terms-card scroll-mt-5 rounded-[28px] border border-white/10 bg-[#fffdf8] p-6 text-slate-900 shadow-[0_20px_70px_rgba(0,0,0,0.2)] sm:p-8"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#123c2b] text-sm font-black text-amber-200 print:border print:border-slate-300 print:bg-white print:text-black">
                      {section.number}
                    </div>
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-[0.25em] text-amber-700">Section {section.number}</div>
                      <h2 className="lpp-terms-display mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">{section.title}</h2>
                    </div>
                  </div>
                  <MarkdownBlocks markdown={section.markdown} />
                </section>
              ))}

              <section className="lpp-terms-contact rounded-[30px] border border-amber-300/20 bg-[linear-gradient(135deg,#143c2c,#0c281d)] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)] sm:p-8">
                <div className="text-[11px] font-black uppercase tracking-[0.3em] text-amber-300">Need clarification?</div>
                <h2 className="lpp-terms-display mt-3 text-3xl font-bold text-white">Talk to Betech before making payment.</h2>
                <p className="mt-4 max-w-3xl text-sm leading-7 text-emerald-50/75 sm:text-base">
                  Confirm the eligible product, price, payment period, installation, accessories and delivery before starting your Lipa Pole Pole arrangement.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <a href="tel:+254722151083" className="inline-flex items-center gap-2 rounded-full bg-amber-300 px-4 py-2.5 text-sm font-black text-[#123c2b]">
                    <Phone className="h-4 w-4" /> 0722 151 083
                  </a>
                  <a href="https://wa.me/254703241917" className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-bold text-white print:text-black">
                    <MessageCircle className="h-4 w-4" /> 0703 241 917
                  </a>
                  <Link href="/" className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-bold text-white print:text-black">
                    Visit Betech <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
                <div className="mt-6 border-t border-white/10 pt-5 text-sm leading-6 text-emerald-50/65 print:text-slate-700">
                  Pramukh Plaza, 3rd Floor, Shop No. 3, Junction of Munyu Road &amp; Sheikh Karume Road, Nairobi CBD
                  <span className="mt-2 block font-semibold text-amber-200 print:text-slate-900">{LIPA_POLE_POLE_TERMS_DISPLAY_URL}</span>
                </div>
              </section>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
