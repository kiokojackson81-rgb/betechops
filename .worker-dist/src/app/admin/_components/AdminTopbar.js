"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = AdminTopbar;
const jsx_runtime_1 = require("react/jsx-runtime");
const link_1 = __importDefault(require("next/link"));
const react_1 = require("react");
function AdminTopbar() {
    const [pendingPricing, setPendingPricing] = (0, react_1.useState)(null);
    const [waitingPickup, setWaitingPickup] = (0, react_1.useState)(null);
    (0, react_1.useEffect)(() => {
        let ignore = false;
        (async () => {
            try {
                const [pp, rp] = await Promise.all([
                    fetch("/api/orders/pending-pricing", { cache: "no-store" })
                        .then(r => r.json()).catch(() => ({ count: 0 })),
                    fetch("/api/returns/waiting-pickup", { cache: "no-store" })
                        .then(r => r.json()).catch(() => ({ count: 0 })),
                ]);
                if (!ignore) {
                    setPendingPricing(typeof pp.count === "number" ? pp.count : 0);
                    setWaitingPickup(typeof rp.count === "number" ? rp.count : 0);
                }
            }
            catch {
                if (!ignore) {
                    setPendingPricing(0);
                    setWaitingPickup(0);
                }
            }
        })();
        return () => { ignore = true; };
    }, []);
    return ((0, jsx_runtime_1.jsxs)("nav", { className: "flex items-center gap-3 p-3", children: [(0, jsx_runtime_1.jsx)(link_1.default, { href: "/admin", className: "px-3 py-1 rounded bg-white/5", children: "Dashboard" }), (0, jsx_runtime_1.jsx)(link_1.default, { href: "/admin/shops", className: "px-3 py-1 rounded bg-white/5", children: "Shops" }), (0, jsx_runtime_1.jsx)(link_1.default, { href: "/admin/users", className: "px-3 py-1 rounded bg-white/5", children: "Users" }), (0, jsx_runtime_1.jsxs)(link_1.default, { href: "/admin/pending-pricing", className: "px-3 py-1 rounded bg-white/5 relative", children: ["Pending Pricing", pendingPricing !== null && ((0, jsx_runtime_1.jsx)("span", { className: "ml-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-yellow-500/20 px-2 text-yellow-300 text-xs", children: pendingPricing }))] }), (0, jsx_runtime_1.jsx)(link_1.default, { href: "/admin/reports", className: "px-3 py-1 rounded bg-white/5", children: "Reports" }), (0, jsx_runtime_1.jsx)(link_1.default, { href: "/admin/marketing-report", className: "px-3 py-1 rounded bg-white/5", children: "Marketing Report" }), (0, jsx_runtime_1.jsxs)(link_1.default, { href: "/admin/returns", className: "px-3 py-1 rounded bg-white/5 relative", children: ["Returns", waitingPickup !== null && ((0, jsx_runtime_1.jsx)("span", { className: "ml-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-indigo-500/20 px-2 text-indigo-300 text-xs", children: waitingPickup }))] })] }));
}
