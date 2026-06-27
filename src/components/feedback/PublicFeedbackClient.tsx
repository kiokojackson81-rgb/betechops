"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRight, CheckCircle2, Gift, Headphones, Mail, MapPin, Phone, ShieldCheck, Sparkles, Star, Truck } from "lucide-react";
import type { FormEvent, ReactNode } from "react";
import { useMemo, useState } from "react";
import FloatingWhatsApp from "@/app/shop/_components/FloatingWhatsApp";
import ProductCard from "@/app/shop/_components/ProductCard";
import ShopFooter from "@/app/shop/_components/ShopFooter";
import ShopHeader from "@/app/shop/_components/ShopHeader";
import TrackedWhatsAppLink from "@/app/shop/_components/TrackedWhatsAppLink";
import { shopStyles } from "@/app/shop/_components/shopStyles";
import { shopNavLinks, type ShopProduct } from "@/app/shop/shopData";
import { SHOP_ALL_PRODUCTS_HREF, SHOP_HOME_HREF } from "@/app/shop/storefrontPaths";

const contactReasons = [
  "Solar System",
  "Solar Water Pump",
  "Solar Water Heater",
  "Battery",
  "Inverter",
  "Solar Panels",
  "Technical Support",
  "Installation",
  "Quotation",
  "Other",
] as const;

const helpfulOptions = ["Very Helpful", "Somewhat Helpful", "No"] as const;
const answeredOptions = ["Yes", "Partially", "No"] as const;
const recommendOptions = ["Definitely", "Maybe", "No"] as const;

type PublicFeedbackClientProps = {
  token?: string | null;
  initialState: "active" | "submitted" | "expired" | "invalid";
  popularProducts: ShopProduct[];
};

export default function PublicFeedbackClient({ token = "", initialState, popularProducts }: PublicFeedbackClientProps) {
  const router = useRouter();
  const supportWhatsAppHref = "https://wa.me/254722151083?text=Hello%20Betech%20Solar%20Solution";
  const referAndEarnHref = "https://agents.betech.co.ke/";
  const tiktokHref = "https://www.tiktok.com/@betechsolarsolutionske";
  const [form, setForm] = useState({
    rating: 0,
    contactReason: "",
    staffHelpful: "",
    questionsAnswered: "",
    recommend: "",
    comments: "",
    wantsContact: "No",
    name: "",
    phone: "",
    email: "",
  });
  const [recoveryPhone, setRecoveryPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(initialState === "submitted");
  const [error, setError] = useState<string | null>(null);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [recovering, setRecovering] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [activePromoTab, setActivePromoTab] = useState<"support" | "refer" | "contact">("support");

  const wantsContact = form.wantsContact === "Yes";
  const isFormActive = initialState === "active" && !submitted;

  const trustBadges = useMemo(
    () => [
      { label: "30 seconds only", tone: "bg-[#fff3d8] text-[#7a0000]" },
      { label: "Helps us improve", tone: "bg-[#effcf4] text-[#0f9d58]" },
      { label: "Countrywide support", tone: "bg-[#fff4ef] text-[#d97706]" },
    ],
    [],
  );

  const promoTabs = [
    { key: "support" as const, label: "WhatsApp Support", icon: Headphones },
    { key: "refer" as const, label: "Refer & Earn", icon: Gift },
    { key: "contact" as const, label: "Call, Email & TikTok", icon: Sparkles },
  ];

  const validate = () => {
    const nextErrors: Record<string, string> = {};
    if (!form.rating) nextErrors.rating = "Please rate your experience.";
    if (!form.contactReason) nextErrors.contactReason = "Please choose what you contacted us about.";
    if (!form.staffHelpful) nextErrors.staffHelpful = "Please tell us whether our staff were helpful.";
    if (!form.questionsAnswered) nextErrors.questionsAnswered = "Please tell us whether your questions were answered.";
    if (!form.recommend) nextErrors.recommend = "Please tell us whether you would recommend Betech Solar.";
    if (wantsContact && !form.phone.trim()) nextErrors.phone = "Phone number is required if you want follow-up.";
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
          contactReason: form.contactReason,
          staffHelpful: form.staffHelpful,
          questionsAnswered: form.questionsAnswered,
          recommend: form.recommend,
          comments: form.comments,
          wantsContact,
          name: wantsContact ? form.name : "",
          phone: wantsContact ? form.phone : "",
          email: wantsContact ? form.email : "",
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
                  <h2 className="mt-2 text-xl font-semibold text-[#7a0000] sm:text-2xl">We&apos;d Love Your Feedback</h2>
                  <p className="mt-3 text-sm leading-6 text-slate-600 sm:text-base">
                    Thank you for choosing Betech Solar Solutions. Your feedback helps us improve our products and customer service.
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
                <form className="mt-6 space-y-6" onSubmit={handleSubmit}>
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

                  <QuestionChipGroup
                    title="2. What did you contact us about?"
                    options={contactReasons}
                    value={form.contactReason}
                    onChange={(value) => setForm((current) => ({ ...current, contactReason: value }))}
                    error={fieldErrors.contactReason}
                  />

                  <QuestionOptionGroup
                    title="3. Were our staff helpful?"
                    options={helpfulOptions}
                    value={form.staffHelpful}
                    onChange={(value) => setForm((current) => ({ ...current, staffHelpful: value }))}
                    error={fieldErrors.staffHelpful}
                  />

                  <QuestionOptionGroup
                    title="4. Did we answer your questions?"
                    options={answeredOptions}
                    value={form.questionsAnswered}
                    onChange={(value) => setForm((current) => ({ ...current, questionsAnswered: value }))}
                    error={fieldErrors.questionsAnswered}
                  />

                  <QuestionOptionGroup
                    title="5. Would you recommend Betech Solar?"
                    options={recommendOptions}
                    value={form.recommend}
                    onChange={(value) => setForm((current) => ({ ...current, recommend: value }))}
                    error={fieldErrors.recommend}
                  />

                  <section className={`${shopStyles.lightCard} p-4 sm:p-5`}>
                    <label className="block text-sm font-bold text-slate-900">Any comments or suggestions?</label>
                    <textarea
                      value={form.comments}
                      onChange={(event) => setForm((current) => ({ ...current, comments: event.target.value }))}
                      placeholder="Tell us how we can serve you even better."
                      rows={5}
                      className="mt-3 w-full rounded-2xl border border-[#7a0000]/10 bg-[#fffdf9] px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-[#f59e0b] focus:ring-2 focus:ring-[#f59e0b]/20"
                    />
                  </section>

                  <QuestionOptionGroup
                    title="Would you like us to contact you regarding your feedback?"
                    options={["Yes", "No"]}
                    value={form.wantsContact}
                    onChange={(value) => setForm((current) => ({ ...current, wantsContact: value }))}
                  />

                  {wantsContact ? (
                    <section className={`${shopStyles.lightCard} grid gap-4 p-4 sm:grid-cols-2 sm:p-5`}>
                      <Field label="Name" value={form.name} onChange={(value) => setForm((current) => ({ ...current, name: value }))} />
                      <Field
                        label="Phone Number"
                        value={form.phone}
                        onChange={(value) => setForm((current) => ({ ...current, phone: value }))}
                        error={fieldErrors.phone}
                      />
                      <div className="sm:col-span-2">
                        <Field
                          label="Email Optional"
                          value={form.email}
                          onChange={(value) => setForm((current) => ({ ...current, email: value }))}
                          type="email"
                        />
                      </div>
                    </section>
                  ) : null}

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

            <section className="mt-6 grid gap-4 md:grid-cols-2">
              <TrustCard
                icon={<MapPin className="h-5 w-5" />}
                title="Nairobi CBD Shop"
                copy={`Pramukh Plaza, 3rd Floor, Shop 3
Junction of Munyu Road and Sheikh Karume Road`}
              />
              <TrustCard
                icon={<Truck className="h-5 w-5" />}
                title="Countrywide Delivery & Installation"
                copy="We deliver and install solar systems countrywide with quick support before and after purchase."
              />
            </section>

            <section className={`${shopStyles.lightCard} mt-6 overflow-hidden`}>
              <div className="border-b border-[#7a0000]/10 px-5 py-5 sm:px-6">
                <div className="flex items-center gap-2 text-[#7a0000]">
                  <ShieldCheck className="h-5 w-5" />
                  <div className="text-sm font-black uppercase tracking-[0.16em]">Trust & Rewards</div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {promoTabs.map((tab) => {
                    const Icon = tab.icon;
                    const active = activePromoTab === tab.key;
                    return (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => setActivePromoTab(tab.key)}
                        className={`inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-bold transition ${
                          active ? "border-[#7a0000] bg-[#7a0000] text-white" : "border-[#7a0000]/12 bg-[#fffaf2] text-slate-800"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="p-5 sm:p-6">
                {activePromoTab === "support" ? (
                  <PromoPanel
                    icon={<Headphones className="h-6 w-6" />}
                    title="Get quick solar help on WhatsApp"
                    copy="Talk to Betech Solar on WhatsApp for fast product guidance, pricing help, and the best setup for your home or biashara."
                    cta={
                      <TrackedWhatsAppLink
                        href={supportWhatsAppHref}
                        className={shopStyles.whatsappButton}
                        label="Feedback page WhatsApp support"
                        context="feedback_page"
                        ariaLabel="Chat with Betech Solar on WhatsApp"
                      >
                        Chat on WhatsApp
                      </TrackedWhatsAppLink>
                    }
                  />
                ) : null}
                {activePromoTab === "refer" ? (
                  <PromoPanel
                    icon={<Gift className="h-6 w-6" />}
                    title="Refer and earn"
                    copy="You could earn upto Ksh100,000 if you refer customer to us. Share serious solar enquiries and let our team handle product matching, quotation, and closing."
                    cta={
                      <Link
                        href={referAndEarnHref}
                        className={shopStyles.goldButton}
                      >
                        Start referring
                      </Link>
                    }
                  />
                ) : null}
                {activePromoTab === "contact" ? (
                  <PromoPanel
                    icon={<Sparkles className="h-6 w-6" />}
                    title="Reach Betech Solar fast"
                    copy="Call 0722151083 or +254711082542, email info@betech.co.ke, and follow us on TikTok to see product demos, installations, and customer transformations."
                    cta={
                      <>
                        <Link href="tel:0722151083" className={shopStyles.primaryButton}>Call 0722151083</Link>
                        <Link href="mailto:info@betech.co.ke" className={shopStyles.secondaryButton}>Email us</Link>
                        <Link
                          href={tiktokHref}
                          target="_blank"
                          rel="noreferrer"
                          className={shopStyles.goldButton}
                        >
                          Follow us on TikTok
                        </Link>
                      </>
                    }
                    bulletItems={[
                      { icon: <Phone className="h-4 w-4" />, label: "0722151083 / +254711082542" },
                      { icon: <Mail className="h-4 w-4" />, label: "info@betech.co.ke" },
                      { icon: <Star className="h-4 w-4" />, label: "@betechsolarsolutionske" },
                    ]}
                  />
                ) : null}
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
                <Link href={SHOP_ALL_PRODUCTS_HREF} className="inline-flex items-center gap-2 text-sm font-black text-[#7a0000] transition hover:text-[#560000]">
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
        <Link href={SHOP_HOME_HREF} className={`${shopStyles.primaryButton} flex-1`}>
          Shop Solar Products
        </Link>
        <TrackedWhatsAppLink
          href="https://wa.me/254722151083?text=Hello%20Betech%20Solar%20Solution"
          className={`${shopStyles.whatsappButton} flex-1`}
          label="Feedback success shop whatsapp products"
          context="feedback_success"
          ariaLabel="Shop Betech Solar products on WhatsApp"
        >
          Shop WhatsApp Products
        </TrackedWhatsAppLink>
        <TrackedWhatsAppLink
          href="https://wa.me/254722151083?text=Hello%20Betech%20Solar%20Solution"
          className={`${shopStyles.whatsappButton} flex-1`}
          label="Feedback success WhatsApp support"
          context="feedback_success"
          ariaLabel="Talk to Betech Solar on WhatsApp"
        >
          WhatsApp Support
        </TrackedWhatsAppLink>
        <Link
          href="https://agents.betech.co.ke/"
          target="_blank"
          rel="noreferrer"
          className={`${shopStyles.secondaryButton} flex-1`}
        >
          Refer & Earn
        </Link>
        <Link
          href="https://www.tiktok.com/@betechsolarsolutionske"
          target="_blank"
          rel="noreferrer"
          className={`${shopStyles.goldButton} flex-1`}
        >
          Follow us on TikTok
        </Link>
        <Link
          href="https://www.tiktok.com/@betechsolarsolutionske"
          target="_blank"
          rel="noreferrer"
          className={`${shopStyles.goldButton} flex-1 sm:col-span-2`}
        >
          See Our Recent Projects
        </Link>
      </div>
    </div>
  );
}

function PromoPanel({
  icon,
  title,
  copy,
  cta,
  bulletItems,
}: {
  icon: ReactNode;
  title: string;
  copy: string;
  cta?: ReactNode;
  bulletItems?: Array<{ icon: ReactNode; label: string }>;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-[88px_minmax(0,1fr)] lg:items-start">
      <div className="inline-flex h-20 w-20 items-center justify-center rounded-[24px] bg-[radial-gradient(circle_at_top,#fff3d8_0%,#ffe7ab_55%,#fff7e3_100%)] text-[#7a0000] shadow-[0_20px_45px_rgba(242,178,15,0.16)]">
        {icon}
      </div>
      <div>
        <h3 className="text-2xl font-black tracking-tight text-slate-950">{title}</h3>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{copy}</p>
        {bulletItems?.length ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {bulletItems.map((item) => (
              <div key={item.label} className="inline-flex items-center gap-2 rounded-full border border-[#7a0000]/10 bg-[#fffaf2] px-3 py-2 text-sm font-semibold text-slate-700">
                <span className="text-[#7a0000]">{item.icon}</span>
                {item.label}
              </div>
            ))}
          </div>
        ) : null}
        {cta ? <div className="mt-5 flex flex-wrap gap-3">{cta}</div> : null}
      </div>
    </div>
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

function QuestionChipGroup({
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
      <div className="mt-3 flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={`rounded-full border px-4 py-2.5 text-sm font-semibold transition ${
              value === option
                ? "border-[#7a0000] bg-[#7a0000] text-white"
                : "border-[#7a0000]/10 bg-[#fffdf9] text-slate-800 hover:border-[#f59e0b]/40"
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

function TrustCard({
  icon,
  title,
  copy,
  cta,
}: {
  icon: ReactNode;
  title: string;
  copy: string;
  cta?: ReactNode;
}) {
  return (
    <div className={`${shopStyles.lightCard} p-5`}>
      <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[#fff3d8] text-[#7a0000]">{icon}</div>
      <div className="mt-4 text-lg font-black text-slate-950">{title}</div>
      <div className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-600">{copy}</div>
      {cta ? <div className="mt-4">{cta}</div> : null}
    </div>
  );
}
