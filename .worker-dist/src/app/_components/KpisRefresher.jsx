"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = KpisRefresher;
const react_1 = require("react");
const navigation_1 = require("next/navigation");
function KpisRefresher({ enabled }) {
    const router = (0, navigation_1.useRouter)();
    const [status, setStatus] = (0, react_1.useState)("idle");
    const once = (0, react_1.useRef)(false);
    (0, react_1.useEffect)(() => {
        if (!enabled || once.current)
            return;
        once.current = true;
        const last = Number(localStorage.getItem("kpisRefreshAt") || 0);
        if (Date.now() - last < 10 * 60000)
            return; // only once every 10 minutes per browser
        (async () => {
            try {
                setStatus("running");
                const r = await fetch("/api/metrics/kpis/refresh", { method: "POST" });
                if (!r.ok)
                    throw new Error("refresh failed");
                localStorage.setItem("kpisRefreshAt", String(Date.now()));
                setStatus("done");
                setTimeout(() => router.refresh(), 1500);
            }
            catch {
                setStatus("error");
            }
        })();
    }, [enabled, router]);
    if (!enabled)
        return null;
    return (<div className="text-xs text-slate-400">
      {status === "running" && <span>Recomputing exact totals…</span>}
      {status === "error" && <span>Exact totals refresh failed.</span>}
    </div>);
}
