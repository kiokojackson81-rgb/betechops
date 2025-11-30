export default function NotAuthorizedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6 py-16 text-slate-100">
      <div className="w-full max-w-xl space-y-4 rounded-2xl border border-white/10 bg-[var(--card,#171b23)] bg-slate-900/60 p-8 text-center shadow-2xl shadow-black/60">
        <p className="text-sm uppercase tracking-widest text-slate-400">Access denied</p>
        <h1 className="text-4xl font-semibold text-white">You are not authorized</h1>
        <p className="text-base text-slate-300">
          Your attendant category currently does not have access to this area.
          Please reach out to an admin if you believe this is incorrect.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <a
            href="/"
            className="rounded-full border border-white/10 px-6 py-2 text-sm font-semibold text-slate-100 transition hover:border-white/20"
          >
            Back to home
          </a>
        </div>
      </div>
    </div>
  );
}
