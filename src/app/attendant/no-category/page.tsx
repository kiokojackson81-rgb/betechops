import Link from "next/link";

export default function NoCategoryPage() {
  return (
    <div className="min-h-screen bg-slate-950 px-4 pb-16 text-slate-50">
      <div className="mx-auto w-full max-w-3xl space-y-6 pt-12">
        <div className="rounded-2xl bg-slate-900/60 p-8 text-center">
          <h1 className="text-2xl font-semibold">Account missing attendant category</h1>
          <p className="mt-3 text-slate-300">
            We couldn&apos;t determine your attendant category. This prevents access
            to attendant-only pages. Please contact your administrator so they
            can assign your account a valid attendant category.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link
              href="/attendant/login"
              className="rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-black"
            >
              Sign in
            </Link>
            <a
              href="mailto:ops@betech.co.ke"
              className="rounded-full border border-white/20 px-5 py-2 text-sm font-semibold text-slate-200 hover:bg-white/10"
            >
              Contact admin
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
