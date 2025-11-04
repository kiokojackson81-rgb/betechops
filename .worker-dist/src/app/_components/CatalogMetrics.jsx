"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = CatalogMetrics;
const react_1 = require("react");
const listingStatusAliases = {
    active: ["active", "enabled", "live"],
    inactive: ["inactive", "disabled", "off", "blocked", "not_live", "not live"],
    deleted: ["deleted", "removed"],
    pending: ["pending", "waiting_activation", "pending_activation", "activation_pending", "processing", "pending activation"],
};
const qcStatusAliases = {
    approved: ["approved", "qc_approved"],
    pending: ["pending", "qc_pending"],
    not_ready_to_qc: ["not_ready_to_qc", "not ready to qc", "not-ready-to-qc", "draft", "incomplete"],
    rejected: ["rejected", "qc_rejected"],
};
function normalizeKey(value) {
    if (value === undefined || value === null)
        return "";
    return String(value).trim().toLowerCase();
}
function canonicalize(key) {
    return normalizeKey(key).replace(/[\s-]+/g, "_");
}
function normalizeMap(source) {
    const out = {};
    for (const [k, v] of Object.entries(source || {})) {
        const ck = canonicalize(k);
        out[ck] = (out[ck] || 0) + Number(v || 0);
    }
    return out;
}
function bucketSum(source, keys) {
    const normalized = normalizeMap(source);
    let sum = 0;
    for (const key of keys) {
        const variants = new Set([canonicalize(key), normalizeKey(key)]);
        for (const variant of variants)
            sum += Number(normalized?.[variant] || 0);
    }
    return sum;
}
function metricTone(tone) {
    switch (tone) {
        case "positive":
            return "border-emerald-400/20 bg-emerald-500/10 text-emerald-100";
        case "warning":
            return "border-amber-400/20 bg-amber-500/10 text-amber-100";
        case "danger":
            return "border-rose-400/20 bg-rose-600/10 text-rose-100";
        case "muted":
            return "border-slate-400/20 bg-slate-600/10 text-slate-100";
        default:
            return "border-white/15 bg-white/5 text-white";
    }
}
function formatNumber(value) {
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(Number(value || 0));
}
function CatalogMetrics({ initial, shopId, exact }) {
    const isAll = !shopId || shopId.toUpperCase() === "ALL";
    const [summary, setSummary] = (0, react_1.useState)(initial);
    const [loading, setLoading] = (0, react_1.useState)(false);
    const lastRefTs = (0, react_1.useRef)(0);
    const scheduled = (0, react_1.useRef)(null);
    const refetch = (0, react_1.useCallback)(async () => {
        try {
            setLoading(true);
            const qs = new URLSearchParams();
            if (isAll)
                qs.set("all", "true");
            else
                qs.set("shopId", shopId);
            if (exact)
                qs.set("exact", "true");
            const res = await fetch(`/api/catalog/products-count?${qs.toString()}`, { cache: "no-store" });
            if (res.ok) {
                const j = (await res.json());
                if (typeof j?.total === "number")
                    setSummary({ total: j.total, approx: !!j.approx, byStatus: j.byStatus || {}, byQcStatus: j.byQcStatus || {} });
            }
        }
        catch {
            // ignore
        }
        finally {
            setLoading(false);
        }
    }, [isAll, shopId, exact]);
    const cards = (0, react_1.useMemo)(() => {
        const listingMetrics = {
            active: bucketSum(summary.byStatus, listingStatusAliases.active),
            inactive: bucketSum(summary.byStatus, listingStatusAliases.inactive),
            deleted: bucketSum(summary.byStatus, listingStatusAliases.deleted),
            pending: bucketSum(summary.byStatus, listingStatusAliases.pending),
        };
        const qcMetrics = {
            approved: bucketSum(summary.byQcStatus, qcStatusAliases.approved),
            pending: bucketSum(summary.byQcStatus, qcStatusAliases.pending),
            notReady: bucketSum(summary.byQcStatus, qcStatusAliases.not_ready_to_qc),
            rejected: bucketSum(summary.byQcStatus, qcStatusAliases.rejected),
        };
        return [
            { key: "total", label: "Total products", value: summary.total, tone: undefined },
            { key: "active", label: "Active", value: listingMetrics.active, tone: "positive" },
            { key: "inactive", label: "Inactive / Disabled", value: listingMetrics.inactive, tone: "muted" },
            { key: "qc-approved", label: "QC Approved", value: qcMetrics.approved, tone: "positive" },
            { key: "qc-pending", label: "QC Pending", value: qcMetrics.pending + qcMetrics.notReady, tone: "warning" },
            { key: "qc-rejected", label: "QC Rejected", value: qcMetrics.rejected, tone: "danger" },
        ];
    }, [summary]);
    (0, react_1.useEffect)(() => {
        // Initial fetch
        refetch();
        // Listen for external refresh events
        const handler = () => {
            const now = Date.now();
            // Debounce: coalesce events within ~1s window
            if (now - lastRefTs.current < 1000) {
                if (scheduled.current)
                    clearTimeout(scheduled.current);
                scheduled.current = setTimeout(() => { lastRefTs.current = Date.now(); void refetch(); }, 1000);
                return;
            }
            lastRefTs.current = now;
            void refetch();
        };
        window.addEventListener("catalog:counts:refresh", handler);
        return () => {
            window.removeEventListener("catalog:counts:refresh", handler);
            if (scheduled.current)
                clearTimeout(scheduled.current);
        };
    }, [shopId, isAll, exact, refetch]);
    return (<section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
      {cards.map((card) => (<div key={card.key} className={`rounded-xl border px-4 py-3 shadow-sm ${metricTone(card.tone)}`}>
          <div className="text-xs uppercase tracking-wide text-white/70 flex items-center justify-between">
            <span>{card.label}</span>
            {card.key === "total" && loading && <span className="text-[10px] text-white/60">loading…</span>}
          </div>
          <div className="mt-2 text-2xl font-semibold">{formatNumber(card.value)}</div>
          {card.key === "total" && !exact && summary.approx ? <div className="text-xs text-amber-200/80">Approximate</div> : null}
        </div>))}
    </section>);
}
