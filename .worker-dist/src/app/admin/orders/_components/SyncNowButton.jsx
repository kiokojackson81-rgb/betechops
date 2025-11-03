"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = SyncNowButton;
const react_1 = require("react");
function SyncNowButton({ className }) {
    const [busy, setBusy] = (0, react_1.useState)(false);
    const [msg, setMsg] = (0, react_1.useState)(null);
    const run = async () => {
        if (busy)
            return;
        setBusy(true);
        setMsg("Running cached pending sync…");
        try {
            const pendingRes = await fetch("/api/jumia/sync-pending", { method: "POST" });
            if (!pendingRes.ok)
                throw new Error(`pending sync failed: ${pendingRes.status}`);
            let syncedShops = 0;
            try {
                const payload = (await pendingRes.json());
                syncedShops = Array.isArray(payload === null || payload === void 0 ? void 0 : payload.results) ? payload.results.length : 0;
            }
            catch (_a) {
                // Ignore parse errors; message below covers success.
            }
            setMsg(syncedShops > 0
                ? `Pending orders synced for ${syncedShops} shop${syncedShops === 1 ? "" : "s"}. Refreshing KPIs…`
                : "Pending orders sync completed. Refreshing KPIs…");
            // Best-effort legacy incremental sync to keep other statuses warm.
            try {
                const incrementalRes = await fetch("/api/jumia/jobs/sync-incremental", { method: "POST" });
                if (!incrementalRes.ok) {
                    console.warn("Incremental sync failed", incrementalRes.status);
                }
            }
            catch (err) {
                console.warn("Incremental sync error", err);
            }
            try {
                await fetch("/api/metrics/kpis/refresh", { method: "POST" });
            }
            catch (_b) { }
            setMsg("Done. Reloading.");
            setTimeout(() => {
                window.location.reload();
            }, 300);
        }
        catch (e) {
            const m = e instanceof Error ? e.message : String(e);
            setMsg(m);
            setBusy(false);
        }
    };
    return (<div className={className}>
      <button onClick={run} disabled={busy} className="rounded-md bg-slate-800/60 border border-white/10 px-3 py-2 text-sm hover:bg-white/10 disabled:opacity-60" title="Run incremental sync now">
        {busy ? "Syncing." : "Sync now"}
      </button>
      {msg && <span className="ml-2 text-xs text-slate-400">{msg}</span>}
    </div>);
}
