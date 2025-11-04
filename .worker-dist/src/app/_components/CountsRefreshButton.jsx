"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = CountsRefreshButton;
const react_1 = require("react");
const navigation_1 = require("next/navigation");
function CountsRefreshButton({ shopId, exact }) {
    const router = (0, navigation_1.useRouter)();
    const [loading, setLoading] = (0, react_1.useState)(false);
    const isAll = !shopId || shopId.toUpperCase() === "ALL";
    const qs = new URLSearchParams();
    if (isAll)
        qs.set("all", "true");
    else
        qs.set("shopId", shopId);
    if (exact)
        qs.set("exact", "true");
    return (<button disabled={loading} onClick={async () => {
            try {
                setLoading(true);
                const res = await fetch(`/api/catalog/products-count?${qs.toString()}`, { cache: "no-store" });
                // Successful call warms Redis cache; refresh the page to reflect updated counts
                if (!res.ok)
                    throw new Error("counts refresh failed");
            }
            catch {
                // ignore
            }
            finally {
                setLoading(false);
                try {
                    window.dispatchEvent(new Event("catalog:counts:refresh"));
                }
                catch { }
            }
        }} className={`rounded border px-3 py-1 text-xs ${loading ? "border-white/10 bg-white/10 text-slate-300" : "border-white/15 bg-white/5 text-slate-100 hover:border-white/25"}`} title="Refresh counts now">
      {loading ? "Refreshing…" : "Refresh counts"}
    </button>);
}
