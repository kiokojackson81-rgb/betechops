"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = AdminTopbarBadges;
const jsx_runtime_1 = require("react/jsx-runtime");
const link_1 = __importDefault(require("next/link"));
const react_1 = require("react");
function AdminTopbarBadges() {
    const [pp, setPP] = (0, react_1.useState)(null);
    const [rp, setRP] = (0, react_1.useState)(null);
    (0, react_1.useEffect)(() => {
        let ignore = false;
        (async () => {
            try {
                const [a, b] = await Promise.all([
                    fetch("/api/orders/pending-pricing", { cache: "no-store" }).then(r => r.ok ? r.json() : { count: 0 }),
                    fetch("/api/returns/waiting-pickup", { cache: "no-store" }).then(r => r.ok ? r.json() : { count: 0 }),
                ]);
                if (!ignore) {
                    setPP(a.count ?? 0);
                    setRP(b.count ?? 0);
                }
            }
            catch {
                if (!ignore) {
                    setPP(0);
                    setRP(0);
                }
            }
        })();
        return () => { ignore = true; };
    }, []);
    const Badge = ({ href, label, count }) => ((0, jsx_runtime_1.jsxs)(link_1.default, { href: href, className: "px-3 py-1 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 admin-badge", children: [(0, jsx_runtime_1.jsx)("span", { className: "mr-2", children: label }), count !== null && ((0, jsx_runtime_1.jsx)("span", { className: "inline-flex items-center justify-center min-w-[20px] h-5 rounded-full bg-white/10 text-xs", children: count }))] }));
    return ((0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-2", children: [(0, jsx_runtime_1.jsx)(Badge, { href: "/admin/pending-pricing", label: "Pending Pricing", count: pp }), (0, jsx_runtime_1.jsx)(Badge, { href: "/admin/returns", label: "Returns", count: rp })] }));
}
