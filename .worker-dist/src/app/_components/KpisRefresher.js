"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = KpisRefresher;
const jsx_runtime_1 = require("react/jsx-runtime");
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
    return ((0, jsx_runtime_1.jsxs)("div", { className: "text-xs text-slate-400", children: [status === "running" && (0, jsx_runtime_1.jsx)("span", { children: "Recomputing exact totals\u2026" }), status === "error" && (0, jsx_runtime_1.jsx)("span", { children: "Exact totals refresh failed." })] }));
}
