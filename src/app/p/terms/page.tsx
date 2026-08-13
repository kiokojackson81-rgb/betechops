import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { FileText, Globe, MessageCircle } from "lucide-react";
import PrintTermsButton from "@/app/p/terms/PrintTermsButton";
import {
  PUBLIC_TERMS_SECTIONS,
  TERMS_EFFECTIVE_DATE,
  TERMS_INTRODUCTION,
  TERMS_SHORT_NOTICE,
  TERMS_TITLE,
  TERMS_VERSION,
} from "@/lib/publicTerms";
import { TERMS_URL } from "@/lib/publicLinks";

export const metadata: Metadata = {
  title: {
    absolute: "Solar Installation Terms & Conditions | Betech Solar Solutions",
  },
  description:
    "Betech Solar Solutions installation, performance, warranty, after-sales support and customer terms and conditions.",
  alternates: {
    canonical: TERMS_URL,
  },
  openGraph: {
    type: "website",
    title: "Solar Installation Terms & Conditions | Betech Solar Solutions",
    description:
      "Betech Solar Solutions installation, performance, warranty, after-sales support and customer terms and conditions.",
    url: TERMS_URL,
  },
  twitter: {
    card: "summary_large_image",
    title: "Solar Installation Terms & Conditions | Betech Solar Solutions",
    description:
      "Betech Solar Solutions installation, performance, warranty, after-sales support and customer terms and conditions.",
  },
};

export default function PublicTermsPage() {
  return (
    <div className="min-h-screen bg-[#040713] text-white">
      <style>{`
        @media print {
          body {
            padding: 0 !important;
            background: #ffffff !important;
            color: #111827 !important;
          }
          .terms-print-shell {
            background: #ffffff !important;
          }
          .terms-print-card {
            border: 0 !important;
            box-shadow: none !important;
            background: #ffffff !important;
          }
          .terms-print-text {
            color: #111827 !important;
          }
          .terms-print-muted {
            color: #4b5563 !important;
          }
          a[href]::after {
            content: "";
          }
        }
      `}</style>

      <div className="terms-print-shell relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(251,146,60,0.16),transparent_24%),radial-gradient(circle_at_50%_0%,rgba(124,58,237,0.18),transparent_28%),radial-gradient(circle_at_100%_12%,rgba(14,165,233,0.12),transparent_24%),linear-gradient(180deg,#050915_0%,#060a17_38%,#040610_100%)]" />
          <div className="absolute inset-x-0 top-0 h-[520px] bg-cover bg-center bg-no-repeat opacity-35" style={{ backgroundImage: "url('/homepage/hero-solar-sunset.png')" }} />
          <div className="absolute inset-x-0 top-0 h-[520px] bg-[linear-gradient(180deg,rgba(4,7,19,0.08)_0%,rgba(4,7,19,0.45)_40%,#040713_100%)]" />
          <div className="absolute left-[-12rem] top-[10rem] h-[24rem] w-[24rem] rounded-full bg-orange-500/10 blur-3xl" />
          <div className="absolute right-[-12rem] top-[5rem] h-[26rem] w-[26rem] rounded-full bg-violet-500/12 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-[1280px] px-4 py-4 sm:px-6 lg:px-8">
          <header className="terms-print-card rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(6,10,20,0.96),rgba(7,11,22,0.88))] px-4 py-4 shadow-[0_18px_60px_rgba(0,0,0,0.28)] backdrop-blur">
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
                  <div className="text-[11px] uppercase tracking-[0.36em] text-cyan-300">Betech Solar Solutions</div>
                  <h1 className="mt-3 max-w-4xl text-2xl font-semibold tracking-tight text-white sm:text-3xl lg:text-[2.35rem]">
                    {TERMS_TITLE}
                  </h1>
                  <div className="mt-3 flex flex-col gap-1 text-sm text-slate-300 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4 sm:gap-y-2">
                    <span>
                      <span className="font-semibold text-slate-100">Effective Date:</span> {TERMS_EFFECTIVE_DATE}
                    </span>
                    <span>
                      <span className="font-semibold text-slate-100">Version:</span> {TERMS_VERSION}
                    </span>
                    <span>
                      <span className="font-semibold text-slate-100">Last Updated:</span> {TERMS_EFFECTIVE_DATE}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <a
                  href="https://www.betech.co.ke/"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-slate-200 transition hover:border-white/20 hover:bg-white/[0.06]"
                >
                  <Globe className="h-4 w-4" />
                  <span>Main Website</span>
                </a>
                <a
                  href="https://wa.me/254722151083"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-slate-200 transition hover:border-white/20 hover:bg-white/[0.06]"
                >
                  <MessageCircle className="h-4 w-4" />
                  <span>WhatsApp</span>
                </a>
                <PrintTermsButton />
              </div>
            </div>
          </header>

          <main className="mt-6 grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[340px_minmax(0,1fr)]">
            <aside className="lg:sticky lg:top-4 lg:self-start print:hidden">
              <div className="terms-print-card rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(7,11,21,0.96),rgba(8,12,23,0.92))] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.28)]">
                <div className="flex items-center gap-2 text-sm font-semibold text-cyan-200">
                  <FileText className="h-4 w-4" />
                  <span>Table of Contents</span>
                </div>
                <p className="mt-3 text-sm leading-7 text-slate-400">
                  Jump directly to any section. Each heading has its own anchor so this page can be shared in WhatsApp or opened directly in a browser.
                </p>
                <div className="mt-4 flex flex-col gap-2" id="contents">
                  {PUBLIC_TERMS_SECTIONS.map((section) => (
                    <a
                      key={section.number}
                      href={`#section-${section.number}`}
                      className="rounded-2xl border border-white/8 bg-white/[0.02] px-3 py-2 text-sm text-slate-200 transition hover:border-violet-400/30 hover:bg-violet-500/8"
                    >
                      {section.number}. {section.title}
                    </a>
                  ))}
                </div>
                <div className="mt-5 rounded-2xl border border-violet-400/20 bg-violet-500/8 p-3 text-sm leading-7 text-violet-100">
                  Canonical link:
                  <div className="mt-2 break-all text-violet-200">{TERMS_URL}</div>
                </div>
              </div>
            </aside>

            <div className="space-y-6">
              <section className="terms-print-card rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(5,8,17,0.96),rgba(6,9,18,0.92))] p-6 shadow-[0_22px_70px_rgba(0,0,0,0.32)] sm:p-8">
                <div className="mt-5 rounded-[24px] border border-amber-400/25 bg-amber-400/8 p-4 text-sm leading-7 text-amber-50 sm:text-base">
                  {TERMS_SHORT_NOTICE}
                </div>
                <div className="mt-6 space-y-4 text-[15px] leading-8 text-slate-200 sm:text-base">
                  {TERMS_INTRODUCTION.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
              </section>

              <section className="terms-print-card rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(5,8,17,0.96),rgba(6,9,18,0.92))] p-6 shadow-[0_22px_70px_rgba(0,0,0,0.32)] sm:p-8 lg:hidden print:hidden">
                <div className="text-[11px] uppercase tracking-[0.32em] text-cyan-300">Contents</div>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {PUBLIC_TERMS_SECTIONS.map((section) => (
                    <a
                      key={section.number}
                      href={`#section-${section.number}`}
                      className="rounded-2xl border border-white/8 bg-white/[0.02] px-3 py-3 text-sm text-slate-200 transition hover:border-violet-400/30 hover:bg-violet-500/8"
                    >
                      {section.number}. {section.title}
                    </a>
                  ))}
                </div>
              </section>

              {PUBLIC_TERMS_SECTIONS.map((section) => (
                <section
                  key={section.number}
                  id={`section-${section.number}`}
                  className="terms-print-card scroll-mt-6 rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(5,8,17,0.96),rgba(6,9,18,0.92))] p-6 shadow-[0_22px_70px_rgba(0,0,0,0.32)] sm:p-8"
                >
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.34em] text-cyan-300">Section {section.number}</div>
                    <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-[1.9rem]">{section.title}</h2>
                  </div>

                  {section.paragraphs?.length ? (
                    <div className="mt-6 space-y-4 text-[15px] leading-8 text-slate-200 sm:text-base">
                      {section.paragraphs.map((paragraph) => (
                        <p key={paragraph}>{paragraph}</p>
                      ))}
                    </div>
                  ) : null}

                  {section.subsections?.length ? (
                    <div className="mt-6 space-y-8">
                      {section.subsections.map((subsection) => (
                        <div key={`${section.number}-${subsection.title}`} className="space-y-4">
                          <h3 className="text-lg font-semibold tracking-tight text-white sm:text-[1.2rem]">
                            {subsection.title}
                          </h3>
                          {subsection.paragraphs?.length ? (
                            <div className="space-y-4 text-[15px] leading-8 text-slate-200 sm:text-base">
                              {subsection.paragraphs.map((paragraph) => (
                                <p key={paragraph}>{paragraph}</p>
                              ))}
                            </div>
                          ) : null}
                          {subsection.bullets?.length ? (
                            <ul className="grid gap-3 sm:grid-cols-2">
                              {subsection.bullets.map((bullet) => (
                                <li
                                  key={bullet}
                                  className="rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-3 text-[15px] leading-7 text-slate-200 sm:text-base"
                                >
                                  {bullet}
                                </li>
                              ))}
                            </ul>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {section.steps?.length ? (
                    <ol className="mt-6 list-decimal space-y-3 pl-5 text-[15px] leading-8 text-slate-200 sm:text-base">
                      {section.steps.map((step) => (
                        <li key={step}>{step}</li>
                      ))}
                    </ol>
                  ) : null}

                  {section.bullets?.length ? (
                    <ul className="mt-6 grid gap-3 sm:grid-cols-2">
                      {section.bullets.map((bullet) => (
                        <li
                          key={bullet}
                          className="rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-3 text-[15px] leading-7 text-slate-200 sm:text-base"
                        >
                          {bullet}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </section>
              ))}

              <section className="terms-print-card rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(5,8,17,0.96),rgba(6,9,18,0.92))] p-6 shadow-[0_22px_70px_rgba(0,0,0,0.32)] sm:p-8">
                <div className="text-[11px] uppercase tracking-[0.34em] text-cyan-300">Final Notice</div>
                <div className="mt-4 rounded-[24px] border border-white/10 bg-white/[0.02] p-4 text-[15px] leading-8 text-slate-200 sm:text-base">
                  These Terms are intended to provide customers with clear information about Betech’s installation standards, system-performance expectations, technical support, warranty procedures and customer responsibilities. They should be read together with the customer’s applicable invoice, receipt, quotation or other transaction records. Nothing in these Terms excludes or restricts any right or remedy that cannot lawfully be excluded under applicable Kenyan law.
                </div>
                <div className="mt-6 flex flex-wrap gap-3 print:hidden">
                  <a
                    href={TERMS_URL}
                    className="rounded-2xl border border-cyan-400/25 bg-cyan-500/10 px-4 py-3 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/20"
                  >
                    Copy reusable link
                  </a>
                  <PrintTermsButton label="Download PDF" />
                  <Link
                    href="/"
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
                  >
                    Back to homepage
                  </Link>
                </div>
              </section>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
