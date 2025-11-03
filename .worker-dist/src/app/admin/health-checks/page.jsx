"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = AdminHealthChecks;
const health_1 = require("@/lib/health");
const AutoRefresh_1 = __importDefault(require("@/app/_components/AutoRefresh"));
const headers_1 = require("next/headers");
async function fetchJson(path) {
    var _a, _b, _c;
    try {
        const h = await (0, headers_1.headers)();
        const proto = (_a = h.get("x-forwarded-proto")) !== null && _a !== void 0 ? _a : "https";
        const host = (_c = (_b = h.get("x-forwarded-host")) !== null && _b !== void 0 ? _b : h.get("host")) !== null && _c !== void 0 ? _c : "";
        const origin = host ? `${proto}://${host}` : "";
        const url = path.startsWith("http") ? path : `${origin}${path}`;
        const r = await fetch(url, { cache: "no-store" });
        const data = await r.json().catch(() => ({}));
        return { ok: r.ok, status: r.status, data };
    }
    catch (e) {
        return { ok: false, status: 0, data: { error: e instanceof Error ? e.message : String(e) } };
    }
}
async function AdminHealthChecks() {
    // Use server-side helper for health to avoid URL parsing issues
    const healthPayload = await (0, health_1.computeHealth)();
    const [oidc, oidcTest, jumiaDiag] = await Promise.all([
        fetchJson("/api/debug/oidc"),
        fetchJson("/api/debug/oidc?test=true"),
        fetchJson("/api/debug/jumia"),
    ]);
    const shops = await (0, health_1.computeShopsConnectivity)();
    const Section = ({ title, payload }) => (<section className="rounded-xl border border-white/10 bg-white/5 p-4">
      <h2 className="mb-2 text-lg font-semibold">{title}</h2>
      <pre className="overflow-x-auto text-xs text-slate-200">{JSON.stringify(payload, null, 2)}</pre>
    </section>);
    return (<div className="mx-auto max-w-5xl p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Operational Checks</h1>
      <AutoRefresh_1.default intervalMs={60000}/>
      <p className="text-slate-400">Quick diagnostics for DB and Jumia OIDC integration.</p>
      <div className="grid gap-4 md:grid-cols-2">
        <Section title="API /health" payload={{ ok: true, status: 200, data: healthPayload }}/>
        <Section title="OIDC env /api/debug/oidc" payload={oidc}/>
        <Section title="OIDC token test /api/debug/oidc?test=true" payload={oidcTest}/>
        <Section title="Jumia connectivity /api/debug/jumia" payload={jumiaDiag}/>
      </div>

      <section className="rounded-xl border border-white/10 bg-white/5 p-4">
        <h2 className="mb-3 text-lg font-semibold">Shops connectivity</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-white/10">
              <tr>
                <th className="text-left px-3 py-2">Shop</th>
                <th className="text-left px-3 py-2">Platform</th>
                <th className="text-left px-3 py-2">Active</th>
                <th className="text-left px-3 py-2">Ping</th>
                <th className="text-left px-3 py-2">Last activity</th>
              </tr>
            </thead>
            <tbody>
              {shops.length === 0 && (<tr><td colSpan={5} className="px-3 py-4 text-center text-slate-400">No shops found.</td></tr>)}
              {shops.map((s) => (<tr key={s.id} className="border-t border-white/10">
                  <td className="px-3 py-2">{s.name}</td>
                  <td className="px-3 py-2">{s.platform}</td>
                  <td className="px-3 py-2">{s.isActive ? 'Yes' : 'No'}</td>
                  <td className="px-3 py-2">
                    {s.ping.ok ? (<span className="text-green-400">OK{s.ping.count !== undefined ? ` (${s.ping.count})` : ''}</span>) : (<span className="text-red-400">{s.ping.status ? `${s.ping.status}` : ''} {s.ping.error || 'error'}</span>)}
                  </td>
                  <td className="px-3 py-2">
                    {s.lastSeenAt ? new Date(s.lastSeenAt).toLocaleString() : '-'}
                    <div className="text-xs text-slate-400">
                      {s.lastActivity.order && <span className="mr-2">Order: {new Date(s.lastActivity.order).toLocaleDateString()}</span>}
                      {s.lastActivity.settlement && <span className="mr-2">Settlement: {new Date(s.lastActivity.settlement).toLocaleDateString()}</span>}
                      {s.lastActivity.fulfillment && <span className="mr-2">Fulfill: {new Date(s.lastActivity.fulfillment).toLocaleDateString()}</span>}
                      {s.lastActivity.returns && <span className="mr-2">Return: {new Date(s.lastActivity.returns).toLocaleDateString()}</span>}
                    </div>
                  </td>
                </tr>))}
            </tbody>
          </table>
        </div>
      </section>
    </div>);
}
