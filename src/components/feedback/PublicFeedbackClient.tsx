"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRight, CheckCircle2, ClipboardList, FileWarning, MapPinned, Phone, ShieldCheck, Sparkles, Star, Store, Wrench } from "lucide-react";
import type { FormEvent, ReactNode } from "react";
import { useMemo, useState } from "react";
import FloatingWhatsApp from "@/app/shop/_components/FloatingWhatsApp";
import ProductCard from "@/app/shop/_components/ProductCard";
import ShopFooter from "@/app/shop/_components/ShopFooter";
import ShopHeader from "@/app/shop/_components/ShopHeader";
import TrackedWhatsAppLink from "@/app/shop/_components/TrackedWhatsAppLink";
import { shopStyles } from "@/app/shop/_components/shopStyles";
import { shopNavLinks, type ShopProduct } from "@/app/shop/shopData";

const helpfulOptions = ["Very helpful", "Somewhat helpful", "Not helpful"] as const;
const answeredOptions = ["Yes", "Partially", "No"] as const;

type PublicFeedbackClientProps = {
  token?: string | null;
  initialState: "active" | "submitted" | "expired" | "invalid";
  popularProducts: ShopProduct[];
};

export default function PublicFeedbackClient({ token = "", initialState, popularProducts }: PublicFeedbackClientProps) {
  const router = useRouter();
  const jacksonWhatsAppHref = "https://wa.me/254705663175?text=Hello%20Jackson%2C%20I%20need%20customer%20service%20help%20from%20Betech%20Solar.";
  const jonathanWhatsAppHref = "https://wa.me/254717241877?text=Hello%20Engineer%20Jonathan%2C%20I%20need%20after-sales%20support%20from%20Betech%20Solar.";
  const [form, setForm] = useState({
    rating: 0,
    staffHelpful: "",
    questionsAnswered: "",
    comments: "",
    wantsContact: "No",
  });
  const [recoveryPhone, setRecoveryPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(initialState === "submitted");
  const [error, setError] = useState<string | null>(null);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [recovering, setRecovering] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const wantsContact = form.wantsContact === "Yes, please call me";
  const isFormActive = initialState === "active" && !submitted;

  const trustBadges = useMemo(
    () => [
      { label: "30 seconds only", tone: "bg-[#fff3d8] text-[#7a0000]" },
      { label: "Helps us improve", tone: "bg-[#effcf4] text-[#0f9d58]" },
      { label: "Countrywide support", tone: "bg-[#fff4ef] text-[#d97706]" },
    ],
    [],
  );

  const validate = () => {
    const nextErrors: Record<string, string> = {};
    if (!form.rating) nextErrors.rating = "Please rate your experience.";
    if (!form.staffHelpful) nextErrors.staffHelpful = "Please tell us whether our staff were helpful.";
    if (!form.questionsAnswered) nextErrors.questionsAnswered = "Please tell us whether your questions were answered.";
    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (!validate() || !token) return;
    setSubmitting(true);

    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          rating: form.rating,
          staffHelpful: form.staffHelpful,
          questionsAnswered: form.questionsAnswered,
          comments: form.comments,
          wantsContact,
        }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const issueMap = payload?.issues?.fieldErrors as Record<string, string[] | undefined> | undefined;
        if (issueMap) {
          const mapped = Object.fromEntries(
            Object.entries(issueMap)
              .filter(([, messages]) => Array.isArray(messages) && messages.length)
              .map(([key, messages]) => [key, String(messages?.[0] || "")]),
          );
          setFieldErrors(mapped);
        }
        if (payload?.error === "already_submitted") {
          setSubmitted(true);
          return;
        }
        if (payload?.error === "expired_token" || payload?.error === "invalid_token") {
          router.push("/feedback");
          return;
        }
        throw new Error(String(payload?.error || "Unable to submit your feedback."));
      }

      setSubmitted(true);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to submit your feedback.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRecovery = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setRecoveryError(null);
    if (!recoveryPhone.trim()) {
      setRecoveryError("Enter the phone number you used when calling us.");
      return;
    }
    setRecovering(true);
    try {
      const response = await fetch("/api/feedback/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: recoveryPhone }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.url) {
        throw new Error(
          payload?.error === "no_recent_call"
            ? "We could not find a recent completed call for that phone number."
            : "Unable to create a replacement feedback link.",
        );
      }
      router.push(String(payload.url).replace(/^https?:\/\/[^/]+/, ""));
    } catch (lookupError) {
      setRecoveryError(lookupError instanceof Error ? lookupError.message : "Unable to create a replacement feedback link.");
    } finally {
      setRecovering(false);
    }
  };

  return (
    <div className={shopStyles.page}>
      <ShopHeader navLinks={shopNavLinks} />
      <main className="py-6 sm:py-8">
        <div className={shopStyles.shell}>
          <div className="mx-auto max-w-[1320px]">
            <section className={`${shopStyles.softCard} mx-auto max-w-[760px] overflow-hidden p-5 sm:p-7`}>
              {!submitted ? (
                <>
                  <div className={shopStyles.sectionEyebrow}>Customer Feedback</div>
                  <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950 sm:text-[2.65rem]">
                    Thank You for Calling Betech Solar Solutions
                  </h1>
                  <p className="mt-3 text-sm leading-6 text-slate-600 sm:text-base">
                    We&apos;d love your feedback. It takes about 30 seconds and helps us improve our service.
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {trustBadges.map((badge) => (
                      <span key={badge.label} className={`rounded-full px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] ${badge.tone}`}>
                        {badge.label}
                      </span>
                    ))}
                  </div>
                </>
              ) : null}

              {isFormActive ? (
                <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
                  <section className={`${shopStyles.lightCard} p-4 sm:p-5`}>
                    <div className="text-sm font-bold text-slate-900">1. How would you rate your experience?</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setForm((current) => ({ ...current, rating: star }))}
                          className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl border transition ${
                            form.rating >= star
                              ? "border-[#f2b20f] bg-[#fff3d8] text-[#f59e0b]"
                              : "border-[#7a0000]/10 bg-white text-slate-400 hover:border-[#f2b20f]/40"
                          }`}
                        >
                          <Star className={`h-6 w-6 ${form.rating >= star ? "fill-current" : ""}`} />
                        </button>
                      ))}
                    </div>
                    <div className="mt-2 text-xs text-slate-500">1 = Poor • 5 = Excellent</div>
                    {fieldErrors.rating ? <div className="mt-2 text-sm text-rose-700">{fieldErrors.rating}</div> : null}
                  </section>

                  <QuestionOptionGroup
                    title="2. Were our staff helpful?"
                    options={helpfulOptions}
                    value={form.staffHelpful}
                    onChange={(value) => setForm((current) => ({ ...current, staffHelpful: value }))}
                    error={fieldErrors.staffHelpful}
                  />

                  <QuestionOptionGroup
                    title="3. Did we answer your questions?"
                    options={answeredOptions}
                    value={form.questionsAnswered}
                    onChange={(value) => setForm((current) => ({ ...current, questionsAnswered: value }))}
                    error={fieldErrors.questionsAnswered}
                  />

                  <section className={`${shopStyles.lightCard} p-4 sm:p-5`}>
                    <label className="block text-sm font-bold text-slate-900">Any comments, suggestions, or customer service experience? <span className="font-normal text-slate-500">(optional)</span></label>
                    <p className="mt-1 text-sm leading-6 text-slate-600">Is there anything we could improve or do differently to serve you better? You can also tell us about the customer service you received.</p>
                    <textarea
                      value={form.comments}
                      onChange={(event) => setForm((current) => ({ ...current, comments: event.target.value }))}
                      placeholder="Share any suggestions or your customer service experience."
                      rows={5}
                      className="mt-3 w-full rounded-2xl border border-[#7a0000]/10 bg-[#fffdf9] px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-[#f59e0b] focus:ring-2 focus:ring-[#f59e0b]/20"
                    />
                  </section>

                  <QuestionOptionGroup
                    title="Would you like our Customer Service Manager to call you?"
                    options={["Yes, please call me", "No, thank you"]}
                    value={form.wantsContact}
                    onChange={(value) => setForm((current) => ({ ...current, wantsContact: value }))}
                  />

                  {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

                  <button type="submit" disabled={submitting} className={`${shopStyles.primaryButton} min-h-[3.2rem] w-full text-base`}>
                    {submitting ? "Submitting..." : "Submit Your Feedback"}
                  </button>
                </form>
              ) : submitted ? (
                <ThankYouCard />
              ) : (
                <InvalidCard
                  isExpired={initialState === "expired"}
                  recoveryPhone={recoveryPhone}
                  setRecoveryPhone={setRecoveryPhone}
                  handleRecovery={handleRecovery}
                  recovering={recovering}
                  recoveryError={recoveryError}
                />
              )}
            </section>

            <section aria-labelledby="support-heading" className={`${shopStyles.lightCard} mt-6 overflow-hidden`}>
              <div className="border-b border-[#7a0000]/10 bg-gradient-to-r from-[#7a0000]/[0.05] to-[#f59e0b]/[0.08] px-5 py-5 sm:px-6">
                <div className="flex items-center gap-2 text-[#7a0000]"><ShieldCheck className="h-5 w-5" /><div className="text-sm font-black uppercase tracking-[0.16em]">Betech support centre</div></div>
                <h2 id="support-heading" className="mt-2 text-2xl font-black tracking-tight text-slate-950">Get the right help, fast</h2>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">Call or WhatsApp the right team, manage your solar service, or explore Betech resources.</p>
              </div>
              <div className="grid gap-4 p-5 sm:p-6 lg:grid-cols-2">
                <SupportContactCard icon={<Phone className="h-6 w-6" />} title="Customer Service Manager" name="Jackson · 0705 663 175" copy="For orders, payments, delivery questions, and general customer service." callHref="tel:0705663175" whatsappHref={jacksonWhatsAppHref} whatsappLabel="WhatsApp Jackson" />
                <SupportContactCard icon={<Wrench className="h-6 w-6" />} title="After-sales support" name="Engineer Jonathan · 0717 241 877" copy="For technical support after installation, warranty help, and system concerns." callHref="tel:0717241877" whatsappHref={jonathanWhatsAppHref} whatsappLabel="WhatsApp Jonathan" />
              </div>
              <div className="border-t border-[#7a0000]/10 px-5 py-5 sm:px-6">
                <div className="flex items-center gap-2 text-slate-900"><MapPinned className="h-5 w-5 text-[#7a0000]" /><h3 className="font-black">Our service location</h3></div>
                <p className="mt-1 text-sm leading-6 text-slate-600">Betech Solar Solutions serves customers across Kenya with countrywide delivery, installation, and remote support.</p>
              </div>
              <div className="grid gap-2 border-t border-[#7a0000]/10 p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-3">
                <SupportLink href="/support/report-issue" icon={<FileWarning className="h-5 w-5" />} title="Report an issue or complaint" />
                <SupportLink href="/warranty-support" icon={<ShieldCheck className="h-5 w-5" />} title="Warranty support" />
                <SupportLink href="https://www.tiktok.com/@betechsolarprojects" icon={<Sparkles className="h-5 w-5" />} title="See recent projects" external />
                <SupportLink href="/request-quote" icon={<ClipboardList className="h-5 w-5" />} title="Request a solar system quote" />
                <SupportLink href="/site-visit" icon={<MapPinned className="h-5 w-5" />} title="Request a site visit" />
                <SupportLink href="/p/terms" icon={<ClipboardList className="h-5 w-5" />} title="Installation terms & conditions" />
                <SupportLink href="/delivery-installation-payment" icon={<Store className="h-5 w-5" />} title="Delivery, installation & payments" />
              </div>
              <div className="flex flex-col gap-2 border-t border-[#7a0000]/10 bg-[#fffaf2] p-5 text-sm font-bold sm:flex-row sm:flex-wrap sm:p-6">
                <Link href="https://www.betech.co.ke/" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#7a0000] px-4 text-white">Betech Solar Online Store</Link>
                <Link href="/account" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#7a0000]/20 px-4 text-center text-[#7a0000]">Log in to your account · See your recent orders</Link>
              </div>
            </section>

            <section className={`${shopStyles.lightCard} mt-6 overflow-hidden`}>
              <div className="flex items-center justify-between gap-3 border-b border-[#7a0000]/8 px-5 py-4 sm:px-6">
                <div className="max-w-2xl">
                  <h2 className="text-2xl font-black tracking-tight text-slate-950">Our Most Popular Products</h2>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    Popular customer picks across recent purchases, search interest, enquiries, and demand in our solar catalogue.
                  </p>
                </div>
                <Link href="https://www.betech.co.ke/all-products" className="inline-flex items-center gap-2 text-sm font-black text-[#7a0000] transition hover:text-[#560000]">
                  See all products
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
              <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 lg:grid-cols-4">
                {popularProducts.slice(0, 8).map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            </section>
          </div>
        </div>
      </main>
      <ShopFooter />
      <FloatingWhatsApp />
    </div>
  );
}

function ThankYouCard() {
  return (
    <div className={shopStyles.lightCard + " p-5 sm:p-6"}>
      <div className="flex items-start gap-3">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#effcf4] text-[#0f9d58]">
          <CheckCircle2 className="h-6 w-6" />
        </span>
        <div>
          <h3 className="text-2xl font-black text-slate-950">Thank you for your feedback!</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Your response has been received. Betech Solar Solutions appreciates your time.
          </p>
        </div>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <Link href="https://www.betech.co.ke/all-products" className={`${shopStyles.primaryButton} flex-1`}>
          See Our Solar Products
        </Link>
        <TrackedWhatsAppLink
          href="https://wa.me/254722151083?text=hello%20betech%20solar%20solution"
          className={`${shopStyles.whatsappButton} flex-1`}
          label="Feedback success WhatsApp support"
          context="feedback_success"
          ariaLabel="Talk to Betech Solar on WhatsApp"
        >
          Chat With Us On WhatsApp
        </TrackedWhatsAppLink>
        <Link
          href="https://agents.betech.co.ke/"
          target="_blank"
          rel="noreferrer"
          className={`${shopStyles.secondaryButton} flex-1`}
        >
          Refer And Earn
        </Link>
        <Link
          href="https://www.tiktok.com/@betechsolarprojects"
          target="_blank"
          rel="noreferrer"
          className={`${shopStyles.goldButton} flex-1`}
        >
          See Our Recent Projects
        </Link>
      </div>
    </div>
  );
}

function SupportContactCard({ icon, title, name, copy, callHref, whatsappHref, whatsappLabel }: { icon: ReactNode; title: string; name: string; copy: string; callHref: string; whatsappHref: string; whatsappLabel: string }) {
  return (
    <article className="rounded-2xl border border-[#7a0000]/10 bg-[#fffdf9] p-4 shadow-sm">
      <div className="flex gap-3">
        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#fff3d8] text-[#7a0000]">{icon}</span>
        <div className="min-w-0">
          <h3 className="font-black text-slate-950">{title}</h3>
          <p className="mt-1 text-sm font-bold text-[#7a0000]">{name}</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">{copy}</p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Link href={callHref} className={`${shopStyles.primaryButton} min-h-11 px-3 text-sm`}>Call now</Link>
        <TrackedWhatsAppLink href={whatsappHref} className={`${shopStyles.whatsappButton} min-h-11 px-3 text-sm`} label={whatsappLabel} context="feedback_support" ariaLabel={whatsappLabel}>WhatsApp</TrackedWhatsAppLink>
      </div>
    </article>
  );
}
function SupportLink({ href, icon, title, external = false }: { href: string; icon: ReactNode; title: string; external?: boolean }) {
  return (
    <Link href={href} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined} className="flex min-h-14 items-center gap-3 rounded-2xl border border-[#7a0000]/10 bg-[#fffdf9] px-4 py-3 text-sm font-bold text-slate-800 transition hover:border-[#f59e0b]/50 hover:bg-[#fffaf2]">
      <span className="text-[#7a0000]">{icon}</span><span className="flex-1">{title}</span><ArrowRight className="h-4 w-4 text-[#7a0000]" />
    </Link>
  );
}

function InvalidCard({
  isExpired,
  recoveryPhone,
  setRecoveryPhone,
  handleRecovery,
  recovering,
  recoveryError,
}: {
  isExpired: boolean;
  recoveryPhone: string;
  setRecoveryPhone: (value: string) => void;
  handleRecovery: (event: FormEvent<HTMLFormElement>) => void;
  recovering: boolean;
  recoveryError: string | null;
}) {
  return (
    <div className={`${shopStyles.lightCard} mt-6 p-5 sm:p-6`}>
      <div className="flex items-start gap-3">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-100 text-rose-700">
          <AlertCircle className="h-6 w-6" />
        </span>
        <div>
          <h3 className="text-2xl font-black text-slate-950">
            {isExpired ? "This feedback link has expired." : "This feedback link is no longer active."}
          </h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            You can still request a secure replacement link by entering the phone number you used when calling us.
          </p>
        </div>
      </div>
      <form className="mt-5 space-y-4" onSubmit={handleRecovery}>
        <Field label="Phone Number" value={recoveryPhone} onChange={setRecoveryPhone} />
        {recoveryError ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{recoveryError}</div> : null}
        <button type="submit" disabled={recovering} className={`${shopStyles.primaryButton} w-full`}>
          {recovering ? "Checking..." : "Request Secure Feedback Link"}
        </button>
      </form>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  error,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-bold text-slate-900">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-2xl border border-[#7a0000]/10 bg-[#fffdf9] px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-[#f59e0b] focus:ring-2 focus:ring-[#f59e0b]/20"
      />
      {error ? <span className="mt-2 block text-sm text-rose-700">{error}</span> : null}
    </label>
  );
}

function QuestionOptionGroup({
  title,
  options,
  value,
  onChange,
  error,
}: {
  title: string;
  options: readonly string[];
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  return (
    <section className={`${shopStyles.lightCard} p-4 sm:p-5`}>
      <div className="text-sm font-bold text-slate-900">{title}</div>
      <div className="mt-3 grid gap-2">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={`rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${
              value === option
                ? "border-[#0f9d58] bg-[#effcf4] text-slate-900"
                : "border-[#7a0000]/10 bg-[#fffdf9] text-slate-700 hover:border-[#f59e0b]/40"
            }`}
          >
            {option}
          </button>
        ))}
      </div>
      {error ? <div className="mt-2 text-sm text-rose-700">{error}</div> : null}
    </section>
  );
}

