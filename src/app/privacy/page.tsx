import Link from "next/link";

export const metadata = {
  title: "Privacy Policy",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#040713] px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(5,8,17,0.95),rgba(6,9,18,0.88))] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.32)] sm:p-8">
        <div className="text-[11px] uppercase tracking-[0.34em] text-cyan-300">BetechOps</div>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">Privacy Policy</h1>
        <p className="mt-4 text-sm leading-7 text-slate-300">
          BetechOps is the digital access portal for Betech Solar Solutions. We use this platform to provide secure access
          to customer services, agent workflows, and staff operations tools.
        </p>
        <div className="mt-6 space-y-4 text-sm leading-7 text-slate-300">
          <p>We only collect and process information required to operate your account, deliver requested services, and secure platform access.</p>
          <p>Protected operational tools and internal business information are available only after successful authentication and authorization.</p>
          <p>For questions about privacy or data handling, please contact Betech Solar Solutions support.</p>
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          <a
            href="mailto:info@betech.co.ke?subject=BetechOps%20Privacy%20Request"
            className="rounded-2xl border border-cyan-400/25 bg-cyan-500/10 px-4 py-3 text-sm font-semibold text-cyan-100 hover:bg-cyan-500/20"
          >
            Contact support
          </a>
          <Link
            href="/"
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-white/10"
          >
            Back to homepage
          </Link>
        </div>
      </div>
    </div>
  );
}
