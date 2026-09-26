"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";
import { ArrowRight, CheckCircle2, CircleUserRound, Clapperboard, FileText, Globe2, LoaderCircle, Mail, MessageCircleMore, Upload, Video } from "lucide-react";

const roleHighlights = [
  { icon: MessageCircleMore, title: "Customer communication", text: "Guide customers clearly across every conversation." },
  { icon: Clapperboard, title: "Content creation", text: "Turn products and projects into useful stories." },
  { icon: CircleUserRound, title: "On-camera presentation", text: "Present with confidence in videos and live sessions." },
  { icon: Globe2, title: "Website & social media updates", text: "Keep product and social content accurate and fresh." },
];

const responsibilities = [
  "Respond to customers through WhatsApp, calls, social media, email, and website channels.",
  "Explain solar panels, batteries, inverters, solar water heaters, pumps, and accessories in clear, simple language.",
  "Follow up on leads, quotations, orders, deliveries, and after-sales requests.",
  "Create product photos, captions, short videos, project posts, and customer education content, including the weekly Wednesday video shoot.",
  "Appear in product videos, demonstrations, live sessions, and social-media content.",
  "Attend selected installations, deliveries, demonstrations, and projects to capture photos and video.",
  "Upload and update product photos, videos, descriptions, prices, promotions, and other content on the Betech website.",
  "Support Facebook, Instagram, TikTok, WhatsApp Status, and other social-media channels.",
];

const candidateRequirements = [
  "Graduate from 2024 or 2025, or a final-year student awaiting graduation.",
  "Diploma or degree in Renewable Energy, Electrical/Electronic Engineering, Solar PV Technology, Electrical Installation, or a closely related technical field.",
  "Basic understanding of solar PV systems, batteries, inverters, panels, electrical safety, and renewable-energy products.",
  "Very confident, talkative, presentable, persuasive, and customer-focused.",
  "Comfortable appearing on camera.",
  "Canva, CapCut, social-media, content-writing, and website-upload skills are an advantage.",
  "Able to work from Nairobi.",
];

const applicationSteps = ["Apply with your CV, cover letter & short explainer video", "Shortlist review", "Interviews for selected candidates"];

const inputClass = "mt-2 block w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-[15px] text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-[#8d141d] focus:ring-4 focus:ring-[#8d141d]/10 disabled:cursor-not-allowed disabled:bg-slate-100";

export default function CareerApplicationClient() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [cvName, setCvName] = useState("");
  const [videoName, setVideoName] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  async function submitApplication(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    setSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/career/applications", { method: "POST", body: new FormData(form) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "We could not submit your application. Please try again.");
      setSuccess(true);
      formRef.current?.reset();
      setCvName("");
      setVideoName("");
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "We could not submit your application. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f8f6f3] text-slate-900">
      <header className="sticky top-0 z-40 border-b border-[#7a0000]/10 bg-[#fffdfa]/95 backdrop-blur">
        <div className="mx-auto flex min-h-20 max-w-7xl items-center justify-between gap-4 px-5 sm:px-8 lg:px-10">
          <Link href="/" aria-label="Betech Solar Solutions home" className="flex shrink-0 items-center">
            <Image src="/agents/betech-logo-crop.png" alt="Betech Solar Solutions" width={128} height={96} priority className="h-14 w-auto object-contain" />
          </Link>
          <nav aria-label="Career page navigation" className="hidden items-center gap-7 text-sm font-semibold text-slate-700 md:flex">
            <Link href="/" className="transition hover:text-[#8d141d]">Home</Link>
            <Link href="/projects" className="transition hover:text-[#8d141d]">Projects</Link>
            <Link href="/products" className="transition hover:text-[#8d141d]">Products</Link>
            <Link href="/career" className="border-b-2 border-[#8d141d] py-2 text-[#8d141d]">Careers</Link>
          </nav>
          <a href="#application" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#e9b530] px-4 text-sm font-extrabold text-[#59100f] shadow-[0_10px_24px_rgba(187,137,18,0.2)] transition hover:bg-[#f4c54d] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#e9b530]/35 sm:px-5">
            Apply Now
          </a>
        </div>
      </header>

      <main>
        <section className="overflow-hidden bg-[radial-gradient(circle_at_10%_15%,rgba(233,181,48,0.17),transparent_28%),linear-gradient(120deg,#fffdfa_0%,#f4f0eb_54%,#e7ded7_100%)]">
          <div className="mx-auto grid max-w-7xl items-stretch lg:grid-cols-[1.02fr_0.98fr]">
            <div className="relative px-5 py-14 sm:px-8 sm:py-20 lg:px-10 lg:py-24 xl:pl-16">
              <div className="mx-auto max-w-xl lg:mx-0">
                <p className="flex items-center gap-3 text-xs font-black tracking-[0.28em] text-[#8d141d]"><span className="h-px w-9 bg-[#e9b530]" /> CAREERS AT BETECH</p>
                <h1 className="mt-5 font-serif text-5xl font-black leading-[0.98] tracking-tight text-[#86131b] sm:text-6xl lg:text-7xl">Build your career in clean energy.</h1>
                <div className="mt-7 rounded-2xl border border-white bg-white/80 p-5 shadow-[0_18px_40px_rgba(78,30,27,0.09)] backdrop-blur sm:p-6">
                  <p className="text-xl font-black leading-tight text-slate-950 sm:text-2xl">Customer Service &amp; Content Creation Graduate Trainee</p>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="flex items-center gap-3 rounded-2xl border border-white bg-white/80 p-3.5 shadow-sm">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#f9df91] text-[#7a0000]"><FileText className="h-5 w-5" /></span>
                    <span className="text-sm font-bold leading-tight">3-Month Paid Traineeship</span>
                  </div>
                  <div className="flex items-center gap-3 rounded-2xl border border-white bg-white/80 p-3.5 shadow-sm">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#f9df91] text-[#7a0000]"><span className="text-lg font-black">K</span></span>
                    <span className="text-sm font-bold leading-tight">Ksh 20,000 Monthly Stipend</span>
                  </div>
                </div>
                <a href="#application" className="mt-7 inline-flex min-h-14 items-center justify-center gap-3 rounded-xl bg-[linear-gradient(135deg,#b21d28,#7a0000)] px-6 text-base font-extrabold text-white shadow-[0_16px_32px_rgba(122,0,0,0.26)] transition hover:-translate-y-0.5 hover:shadow-[0_20px_36px_rgba(122,0,0,0.32)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#8d141d]/25">
                  Apply for this opportunity <ArrowRight className="h-5 w-5" />
                </a>
              </div>
            </div>
            <div className="relative min-h-[27rem] sm:min-h-[34rem] lg:min-h-full">
              <Image src="/careers/graduate-trainee-hero.png" alt="A young Kenyan woman presenting solar equipment while filming content in a solar showroom" fill priority sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover object-center" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#4f1010]/28 via-transparent to-transparent lg:bg-gradient-to-r lg:from-[#f4f0eb]/20 lg:via-transparent" />
            </div>
          </div>
        </section>

        <section className="border-y border-[#7a0000]/8 bg-[#fffdfa] px-5 py-12 sm:px-8 sm:py-16">
          <div className="mx-auto max-w-6xl">
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-xs font-black uppercase tracking-[0.25em] text-[#8d141d]">The opportunity</p>
              <h2 className="mt-3 font-serif text-4xl font-black tracking-tight text-[#81131a] sm:text-5xl">A role for confident communicators and creators</h2>
              <span className="mx-auto mt-5 block h-1 w-14 rounded-full bg-[#e9b530]" />
            </div>
            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {roleHighlights.map(({ icon: Icon, title, text }) => (
                <article key={title} className="rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-[0_12px_30px_rgba(57,38,32,0.06)]">
                  <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#f9edf0] text-[#8d141d]"><Icon className="h-6 w-6" /></span>
                  <h3 className="mt-5 text-lg font-black text-slate-950">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="px-5 py-12 sm:px-8 sm:py-16">
          <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-2 lg:gap-14">
            <DetailList title="What you will do" items={responsibilities} />
            <DetailList title="Who should apply" items={candidateRequirements} />
          </div>
        </section>

        <section className="border-y border-[#7a0000]/8 bg-[#f0ece7] px-5 py-12 sm:px-8 sm:py-16">
          <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[0.84fr_1.16fr] lg:items-center">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.25em] text-[#8d141d]">Next steps</p>
              <h2 className="mt-3 font-serif text-4xl font-black tracking-tight text-[#81131a] sm:text-5xl">How the application works</h2>
              <span className="mt-5 block h-1 w-14 rounded-full bg-[#e9b530]" />
              <div className="mt-9 space-y-0">
                {applicationSteps.map((step, index) => (
                  <div key={step} className="flex gap-4">
                    <div className="flex flex-col items-center"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[#8d141d]/15 bg-white text-lg font-black text-[#8d141d]">{index + 1}</span>{index < applicationSteps.length - 1 ? <span className="h-10 border-l border-dashed border-[#8d141d]/35" /> : null}</div>
                    <p className="pt-2 text-lg font-bold text-slate-800">{step}</p>
                  </div>
                ))}
              </div>
            </div>
            <aside className="rounded-2xl border border-[#d7c7b9] bg-[#fffdfa] p-6 shadow-[0_20px_45px_rgba(66,37,30,0.09)] sm:p-8">
              <Video className="h-8 w-8 text-[#8d141d]" />
              <h3 className="mt-4 text-2xl font-black text-slate-950">Your short explainer video is required</h3>
              <p className="mt-3 max-w-2xl text-base leading-7 text-slate-650">Include a short explainer or presentation video with your application. It helps us assess your communication skills, confidence, technical understanding, presentation ability, and comfort in front of the camera.</p>
            </aside>
          </div>
        </section>

        <section className="px-5 py-12 sm:px-8 sm:py-16">
          <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-2">
            <DetailList title="Terms & benefits" items={[
              "Three-month, full-time Graduate Trainee contract with a monthly stipend of KSh 20,000.",
              "Lunch allowance of KSh 150 and transport allowance of KSh 150 for each working day.",
              "Commission for successful sales, subject to the company commission structure.",
              "Working hours: Monday–Friday, 9:00am–5:30pm; Saturday, 9:00am–1:00pm.",
              "One off day per month may be requested with prior approval; sick leave requires timely communication.",
            ]} />
            <div className="rounded-2xl border border-[#d7c7b9] bg-[#fffdfa] p-6 shadow-[0_12px_30px_rgba(57,38,32,0.06)] sm:p-8">
              <p className="text-xs font-black uppercase tracking-[0.25em] text-[#8d141d]">What happens next</p>
              <h2 className="mt-3 font-serif text-4xl font-black tracking-tight text-[#81131a]">Learn, contribute, grow</h2>
              <p className="mt-5 text-[15px] leading-7 text-slate-700">At the end of the traineeship, Betech will assess your performance, reliability, communication, technical understanding, learning ability, and contribution. Depending on that assessment and business needs, we may offer employment, extend the contract, or conclude the engagement.</p>
              <p className="mt-4 text-[15px] leading-7 text-slate-700">You must be available full time in Nairobi throughout the three-month traineeship, including occasional field assignments.</p>
            </div>
          </div>
        </section>

        <section id="application" className="scroll-mt-24 bg-[radial-gradient(circle_at_88%_10%,rgba(233,181,48,0.18),transparent_23%),#f8f6f3] px-5 py-12 sm:px-8 sm:py-16">
          <div className="mx-auto max-w-4xl">
            {success ? (
              <div className="rounded-3xl border border-[#e2c874] bg-[#fffdfa] px-6 py-16 text-center shadow-[0_22px_60px_rgba(75,46,35,0.12)] sm:px-14">
                <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#eaf7ef] text-[#17754b]"><CheckCircle2 className="h-9 w-9" /></span>
                <h2 className="mt-6 font-serif text-4xl font-black text-[#81131a]">Thank you.</h2>
                <p className="mx-auto mt-4 max-w-xl text-lg leading-8 text-slate-700">Your application has been received. Only shortlisted candidates will be contacted.</p>
                <button type="button" onClick={() => setSuccess(false)} className="mt-8 rounded-xl border border-[#8d141d]/20 px-5 py-3 text-sm font-extrabold text-[#8d141d] transition hover:bg-[#fff3f4]">Submit another application</button>
              </div>
            ) : (
              <form ref={formRef} onSubmit={submitApplication} className="rounded-3xl border border-white bg-white p-5 shadow-[0_25px_65px_rgba(75,46,35,0.13)] sm:p-9" noValidate>
                <div className="flex flex-col gap-5 border-b border-slate-200 pb-7 sm:flex-row sm:items-end sm:justify-between">
                  <div><p className="text-xs font-black uppercase tracking-[0.25em] text-[#8d141d]">Your application</p><h2 className="mt-2 font-serif text-4xl font-black tracking-tight text-[#81131a]">Start your application</h2></div>
                  <p className="flex items-center gap-2 text-sm font-medium text-slate-500"><Mail className="h-4 w-4" /> Confirmation sent by email</p>
                </div>
                <div className="sr-only" aria-hidden="true"><label htmlFor="career-website">Website</label><input id="career-website" name="website" type="text" tabIndex={-1} autoComplete="off" /></div>
                <div className="mt-7 grid gap-5 sm:grid-cols-2">
                  <Field label="Full name" name="fullName" placeholder="Your full name" required />
                  <Field label="Email address" name="email" type="email" placeholder="you@example.com" required />
                  <Field label="Phone number" name="phone" type="tel" placeholder="07... or +254..." required />
                  <Field label="Current location" name="currentLocation" placeholder="Nairobi, Kenya" required />
                  <label className="block text-sm font-bold text-slate-800">Education level<select name="educationLevel" required defaultValue="" className={inputClass}><option value="" disabled>Select education level</option><option>Diploma</option><option>Degree</option><option>Other relevant qualification</option></select></label>
                  <Field label="Course / area of study" name="courseOfStudy" placeholder="e.g. Renewable Energy or Electrical Engineering" required />
                  <label className="block text-sm font-bold text-slate-800 sm:col-span-2">Graduation status<select name="graduationStatus" required defaultValue="" className={inputClass}><option value="" disabled>Select your status</option><option>Graduated in 2024</option><option>Graduated in 2025</option><option>Final-year student awaiting graduation</option></select></label>
                  <label className="block text-sm font-bold text-slate-800 sm:col-span-2">CV upload<span className="mt-2 flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border border-dashed border-[#8d141d]/35 bg-[#fffaf5] px-4 text-sm font-semibold text-slate-600 transition hover:border-[#8d141d] hover:bg-[#fff5f5]"><Upload className="h-5 w-5 shrink-0 text-[#8d141d]" /><span className="min-w-0 truncate">{cvName || "Choose a PDF, DOC, or DOCX file (max 8 MB)"}</span><input name="cv" type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" required className="sr-only" onChange={(event) => setCvName(event.target.files?.[0]?.name || "")} /></span></label>
                  <label className="block text-sm font-bold text-slate-800 sm:col-span-2">Cover letter<textarea name="coverLetter" required minLength={40} maxLength={6000} rows={6} placeholder="Tell us why you are a great fit for this opportunity." className={inputClass} /></label>
                  <label className="block text-sm font-bold text-slate-800 sm:col-span-2">Short explainer video link <span className="font-normal text-slate-500">(choose this or upload a video below)</span><input name="tiktokWorkUrl" type="url" placeholder="https://www.tiktok.com/... or a shareable Google Drive, YouTube, Instagram, or Facebook link" className={inputClass} /><span className="mt-2 block text-sm font-normal leading-6 text-slate-500">Choose one option: share a link or upload a short video below. Explain a product, technical topic, service, or presentation in your own words; a solar-product explanation is preferred.</span></label>
                  <label className="block text-sm font-bold text-slate-800 sm:col-span-2">Or upload your short explainer video<span className="mt-2 flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border border-dashed border-[#8d141d]/35 bg-[#fffaf5] px-4 text-sm font-semibold text-slate-600 transition hover:border-[#8d141d] hover:bg-[#fff5f5]"><Video className="h-5 w-5 shrink-0 text-[#8d141d]" /><span className="min-w-0 truncate">{videoName || "Choose MP4, MOV, or WebM video (max 50 MB)"}</span><input name="explainerVideo" type="file" accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm" className="sr-only" onChange={(event) => setVideoName(event.target.files?.[0]?.name || "")} /></span><span className="mt-2 block text-sm font-normal leading-6 text-slate-500">A video link or uploaded video is required.</span></label>
                </div>
                <label className="mt-7 flex cursor-pointer items-start gap-3 rounded-xl bg-[#faf6f1] p-4 text-sm leading-6 text-slate-700"><input name="consent" value="true" type="checkbox" required className="mt-1 h-4 w-4 rounded border-slate-400 text-[#8d141d] focus:ring-[#8d141d]" /><span>I confirm that the information I have provided is accurate and that Betech Solar Solutions may contact me regarding this application.</span></label>
                {error ? <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{error}</p> : null}
                <button type="submit" disabled={submitting} className="mt-7 inline-flex min-h-14 w-full items-center justify-center gap-3 rounded-xl bg-[linear-gradient(135deg,#b21d28,#7a0000)] px-6 text-base font-extrabold text-white shadow-[0_16px_32px_rgba(122,0,0,0.22)] transition hover:brightness-110 disabled:cursor-wait disabled:opacity-70">{submitting ? <><LoaderCircle className="h-5 w-5 animate-spin" /> Submitting application…</> : <>Submit Application <ArrowRight className="h-5 w-5" /></>}</button>
              </form>
            )}
          </div>
        </section>
      </main>

      <footer className="border-t border-[#7a0000]/10 bg-[#4e0d11] px-5 py-8 text-center text-sm text-white/75"><p className="font-semibold text-white">Betech Solar Solutions</p><p className="mt-1">Powering careers in clean energy.</p></footer>
    </div>
  );
}

function Field({ label, name, type = "text", placeholder, required = false }: { label: string; name: string; type?: string; placeholder?: string; required?: boolean }) {
  return <label className="block text-sm font-bold text-slate-800">{label}<input name={name} type={type} required={required} placeholder={placeholder} className={inputClass} /></label>;
}

function DetailList({ title, items }: { title: string; items: string[] }) {
  return <div><p className="text-xs font-black uppercase tracking-[0.25em] text-[#8d141d]">The role</p><h2 className="mt-3 font-serif text-4xl font-black tracking-tight text-[#81131a] sm:text-5xl">{title}</h2><span className="mt-5 block h-1 w-14 rounded-full bg-[#e9b530]" /><ul className="mt-8 space-y-4">{items.map((item) => <li key={item} className="flex gap-3 text-[15px] leading-7 text-slate-700"><CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-[#b78713]" /><span>{item}</span></li>)}</ul></div>;
}
