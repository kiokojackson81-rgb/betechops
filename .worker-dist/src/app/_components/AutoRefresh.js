"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = AutoRefresh;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const navigation_1 = require("next/navigation");
function AutoRefresh({ intervalMs = 60000, storageKey = "autoRefreshEnabled", defaultEnabled = true, eventName = 'orders:refresh' }) {
    const router = (0, navigation_1.useRouter)();
    const timer = (0, react_1.useRef)(null);
    const [enabled, setEnabled] = (0, react_1.useState)(() => {
        try {
            const v = localStorage.getItem(storageKey);
            return v === null ? defaultEnabled : v === "1";
        }
        catch {
            return defaultEnabled;
        }
    });
    (0, react_1.useEffect)(() => {
        if (enabled) {
            timer.current = setInterval(() => {
                try {
                    const detail = { source: 'timer', ts: Date.now() };
                    window.dispatchEvent(new CustomEvent(eventName, { detail }));
                }
                catch { }
            }, Math.max(5000, intervalMs));
        }
        return () => { if (timer.current)
            clearInterval(timer.current); };
    }, [enabled, intervalMs, router, eventName]);
    (0, react_1.useEffect)(() => {
        try {
            localStorage.setItem(storageKey, enabled ? "1" : "0");
        }
        catch { }
    }, [enabled, storageKey]);
    return ((0, jsx_runtime_1.jsxs)("div", { className: "text-xs text-slate-400 flex items-center gap-2", children: [(0, jsx_runtime_1.jsx)("span", { children: "Auto-refresh" }), (0, jsx_runtime_1.jsx)("button", { onClick: () => setEnabled((v) => !v), className: "px-2 py-0.5 rounded border border-white/10 hover:bg-white/10", children: enabled ? "On" : "Off" }), (0, jsx_runtime_1.jsxs)("span", { className: "opacity-60", children: [Math.round(intervalMs / 1000), "s"] })] }));
}
