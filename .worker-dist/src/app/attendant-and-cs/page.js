"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = AttendantAndCsPage;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const DailyTasksUI_1 = __importDefault(require("@/components/daily-tasks/DailyTasksUI"));
const Sparkline_1 = __importDefault(require("@/app/_components/Sparkline"));
const Card_1 = __importDefault(require("@/app/_components/Card"));
const Button_1 = __importDefault(require("@/app/_components/Button"));
function AttendantAndCsPage() {
    const [summary, setSummary] = (0, react_1.useState)(null);
    const [reports, setReports] = (0, react_1.useState)([]);
    (0, react_1.useEffect)(() => {
        let mounted = true;
        (async () => {
            try {
                const res = await fetch(`/api/daily-report`);
                if (!res.ok)
                    return;
                const data = await res.json();
                if (!mounted)
                    return;
                setReports(data.reports ?? []);
                setSummary(data.summary ?? null);
            }
            catch {
                // ignore
            }
        })();
        return () => {
            mounted = false;
        };
    }, []);
    return ((0, jsx_runtime_1.jsxs)("div", { className: "att-cs-root", children: [(0, jsx_runtime_1.jsx)("div", { className: "att-cs-left", children: (0, jsx_runtime_1.jsx)(DailyTasksUI_1.default, {}) }), (0, jsx_runtime_1.jsxs)("aside", { className: "att-cs-right", children: [(0, jsx_runtime_1.jsxs)("div", { className: "header-row", children: [(0, jsx_runtime_1.jsxs)(Card_1.default, { variant: "kpi", children: [(0, jsx_runtime_1.jsx)("div", { className: "kpi-title", children: "Products (today)" }), (0, jsx_runtime_1.jsx)("div", { className: "kpi-value", children: summary ? summary.totalProducts : "—" })] }), (0, jsx_runtime_1.jsxs)(Card_1.default, { variant: "kpi", children: [(0, jsx_runtime_1.jsx)("div", { className: "kpi-title", children: "Total Sales (KES)" }), (0, jsx_runtime_1.jsx)("div", { className: "kpi-value", children: summary ? Number(summary.totalSales || 0).toLocaleString() : "—" })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-4", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-sm opacity-70 mb-2", children: "Recent products trend" }), (0, jsx_runtime_1.jsx)("div", { className: "spark-wrap", children: (0, jsx_runtime_1.jsx)(Sparkline_1.default, { values: reports.slice(0, 8).map((r) => r.productsCount || 0), color: "var(--primary)" }) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-6", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-sm opacity-70 mb-2", children: "Quick actions" }), (0, jsx_runtime_1.jsxs)("div", { className: "flex gap-2", children: [(0, jsx_runtime_1.jsx)(Button_1.default, { onClick: () => window.location.href = "/admin/daily-report", variant: "secondary", children: "Open admin" }), (0, jsx_runtime_1.jsx)(Button_1.default, { onClick: () => window.location.href = "/attendant", variant: "secondary", children: "Attendant home" })] })] })] })] }));
}
