"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = BulkActions;
const react_1 = require("react");
const navigation_1 = require("next/navigation");
function BulkActions() {
    const sp = (0, navigation_1.useSearchParams)();
    const router = (0, navigation_1.useRouter)();
    const pathname = (0, navigation_1.usePathname)();
    const shopId = (0, react_1.useMemo)(() => {
        const v = sp.get("shopId");
        return v && v !== "ALL" ? v : null;
    }, [sp]);
    const [busy, setBusy] = (0, react_1.useState)(null);
    const [providerId, setProviderId] = (0, react_1.useState)("");
    const [providerName, setProviderName] = (0, react_1.useState)("");
    const [defaultsLoaded, setDefaultsLoaded] = (0, react_1.useState)(false);
    const refresh = (0, react_1.useCallback)(() => {
        try {
            window.dispatchEvent(new CustomEvent("orders:refresh", { detail: { source: "bulk", ts: Date.now() } }));
        }
        catch { }
        router.refresh();
    }, [router]);
    (0, react_1.useEffect)(() => {
        let cancelled = false;
        async function loadDefaults() {
            if (!shopId) {
                setDefaultsLoaded(true);
                return;
            }
            try {
                const res = await fetch("/api/settings/jumia/shipping-defaults", { cache: "no-store" });
                if (!res.ok)
                    return;
                const j = await res.json();
                const d = j?.defaults || {};
                if (!cancelled) {
                    setProviderId(d?.[shopId]?.providerId || "");
                    setProviderName(d?.[shopId]?.label || "");
                }
            }
            catch { }
            if (!cancelled)
                setDefaultsLoaded(true);
        }
        void loadDefaults();
        return () => {
            cancelled = true;
        };
    }, [shopId]);
    // Lazy resolve provider label if missing using any recent order's first item
    (0, react_1.useEffect)(() => {
        let cancelled = false;
        async function resolveLabel() {
            if (!shopId || !providerId || providerName)
                return;
            try {
                const r = await fetch(`/api/jumia/orders/recent?shopId=${encodeURIComponent(shopId)}`, { cache: "no-store" });
                if (!r.ok)
                    return;
                const jr = await r.json();
                const orderId = jr?.orderId;
                if (!orderId)
                    return;
                const itemsRes = await fetch(`/api/jumia/orders/${encodeURIComponent(orderId)}/items?shopId=${encodeURIComponent(shopId)}`, { cache: "no-store" });
                const itemsJson = itemsRes.ok ? await itemsRes.json() : { items: [] };
                const items = Array.isArray(itemsJson?.items) ? itemsJson.items : [];
                const first = items[0];
                if (!first?.id)
                    return;
                const provRes = await fetch('/api/jumia/providers', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ shopId, orderItemIds: [first.id] }),
                });
                const provJson = provRes.ok ? await provRes.json() : {};
                const list = Array.isArray(provJson?.providers) ? provJson.providers : [];
                const match = list.find((p) => String(p?.id ?? p?.providerId) === providerId);
                if (match && !cancelled) {
                    const label = String(match?.name || match?.label || match?.id || providerId);
                    setProviderName(label);
                    // persist discovered label to settings for future fast loads (best-effort)
                    await fetch('/api/settings/jumia/shipping-defaults', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ shopId, providerId, label }),
                    }).catch(() => { });
                }
            }
            catch { }
        }
        void resolveLabel();
        return () => { cancelled = true; };
    }, [shopId, providerId, providerName]);
    async function saveDefault() {
        if (!shopId || !providerId)
            return;
        setBusy("save-default");
        try {
            await fetch("/api/settings/jumia/shipping-defaults", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ shopId, providerId }),
            });
        }
        finally {
            setBusy(null);
        }
    }
    async function run(action) {
        if (!shopId)
            return;
        setBusy(action);
        try {
            const endpoint = action === "pack"
                ? "/api/jumia/orders/bulk/pack"
                : action === "rts"
                    ? "/api/jumia/orders/bulk/ready-to-ship"
                    : "/api/jumia/orders/bulk/print-labels";
            await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ shopId }),
            });
            // kick an incremental sync to close gaps quickly
            const q = new URLSearchParams();
            q.set("shopId", shopId);
            await fetch(`/api/jumia/jobs/sync-incremental?${q.toString()}`, { method: "POST" }).catch(() => { });
            refresh();
        }
        catch (e) {
            console.warn("[BulkActions] action failed", e);
        }
        finally {
            setBusy(null);
        }
    }
    // Only show when a specific shop is selected
    if (!shopId)
        return null;
    return (<div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between rounded-xl border border-white/10 bg-[var(--panel,#121723)] p-3">
      <div className="flex items-center gap-2">
        <span className="text-sm opacity-80">Default station for this shop:</span>
        <input className="px-2 py-1 rounded bg-black/20 border border-white/10 min-w-[16rem]" placeholder="Provider ID (e.g. LUCYTEC-PROVIDER-ID)" value={providerId} onChange={(e) => setProviderId(e.target.value)} disabled={!defaultsLoaded || !!busy}/>
        {providerName && (<span className="text-xs opacity-80 px-2 py-1 rounded border border-white/10 bg-white/5" title={providerId}>{providerName}</span>)}
        <button className="px-3 py-1 rounded border border-white/10 hover:bg-white/10 disabled:opacity-50" onClick={saveDefault} disabled={!providerId || !!busy} title="Save as default shipping station for this shop">
          {busy === "save-default" ? "Saving…" : "Save"}
        </button>
      </div>
      <div className="flex items-center gap-2">
        <button className="px-3 py-1 rounded border border-white/10 hover:bg-white/10 disabled:opacity-50" onClick={() => run("pack")} disabled={!!busy} title="Pack all PENDING items for this shop using the default station">
          {busy === "pack" ? "Packing…" : "Pack all"}
        </button>
        <button className="px-3 py-1 rounded border border-white/10 hover:bg-white/10 disabled:opacity-50" onClick={() => run("rts")} disabled={!!busy} title="Mark all PACKED items Ready-To-Ship for this shop">
          {busy === "rts" ? "Marking…" : "RTS all"}
        </button>
        <button className="px-3 py-1 rounded border border-white/10 hover:bg-white/10 disabled:opacity-50" onClick={() => run("print")} disabled={!!busy} title="Print labels for all RTS/SHIPPED/DELIVERED items for this shop">
          {busy === "print" ? "Printing…" : "Print all"}
        </button>
      </div>
    </div>);
}
