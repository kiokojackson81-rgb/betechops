
async function fetchJson(path: string) {
  try {
    const r = await fetch(path, { cache: "no-store" });
    const data = await r.json().catch(() => ({}));
    return { ok: r.ok, status: r.status, data };
  } catch (e) {
    return { ok: false, status: 0, data: { error: e instanceof Error ? e.message : String(e) } };
  }
}

export default async function AdminHealthChecks() {
  const [health, oidc, oidcTest] = await Promise.all([
    fetchJson("/api/health"),
    fetchJson("/api/debug/oidc"),
    fetchJson("/api/debug/oidc?test=true"),
  ]);
  const jumiaDiag = await fetchJson("/api/debug/jumia");

  const Section = ({ title, payload }: { title: string; payload: unknown }) => (
    <section className="rounded-xl border border-white/10 bg-white/5 p-4">
      <h2 className="mb-2 text-lg font-semibold">{title}</h2>
      <pre className="overflow-x-auto text-xs text-slate-200">{JSON.stringify(payload, null, 2)}</pre>
    </section>
  );

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Operational Checks</h1>
      <p className="text-slate-400">Quick diagnostics for DB and Jumia OIDC integration.</p>
      <div className="grid gap-4 md:grid-cols-2">
        <Section title="API /health" payload={health} />
        <Section title="OIDC env /api/debug/oidc" payload={oidc} />
        <Section title="OIDC token test /api/debug/oidc?test=true" payload={oidcTest} />
        <Section title="Jumia connectivity /api/debug/jumia" payload={jumiaDiag} />
      </div>
    </div>
  );
}
