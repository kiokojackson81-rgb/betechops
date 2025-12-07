"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = MarketingReportFilterBar;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const Button_1 = __importDefault(require("@/app/_components/Button"));
const toast_1 = require("@/lib/ui/toast");
const navigation_1 = require("next/navigation");
const tradingPeriod_1 = require("@/lib/tradingPeriod");
function MarketingReportFilterBar({ initialPeriod = "", initialDay = "", initialDate = "", initialUser = "" }) {
    const periods = (0, react_1.useMemo)(() => (0, tradingPeriod_1.getRecentTradingPeriods)(6), []);
    const defaultPeriodKey = initialPeriod || periods[0]?.key || "";
    const [periodKey, setPeriodKey] = (0, react_1.useState)(defaultPeriodKey);
    const [day, setDay] = (0, react_1.useState)(initialDay);
    const [date, setDate] = (0, react_1.useState)(initialDate || undefined);
    const [user, setUser] = (0, react_1.useState)(initialUser);
    const router = (0, navigation_1.useRouter)();
    (0, react_1.useEffect)(() => {
        // When the period changes, clear the date if it's out of range
        if (!date)
            return;
        const p = periods.find((p) => p.key === periodKey);
        if (!p)
            return;
        const dateObj = new Date(date);
        if (Number.isNaN(dateObj.getTime()))
            return;
        if (dateObj < p.start || dateObj > p.end) {
            setDate(undefined);
        }
    }, [periodKey]);
    (0, react_1.useEffect)(() => {
        setUser(initialUser);
    }, [initialUser]);
    const deriveDayOfWeek = (dateStr) => {
        try {
            const d = new Date(dateStr);
            const map = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
            const dow = map[d.getDay()];
            // app supports Monday-Saturday only; return empty for Sunday
            if (dow === "Sunday")
                return "";
            return dow;
        }
        catch {
            return "";
        }
    };
    const apply = (e) => {
        e.preventDefault();
        // require all filters to be set
        if (!periodKey) {
            (0, toast_1.showToast)("Please select a trading period", "error");
            return;
        }
        if (!date) {
            (0, toast_1.showToast)("Please select a date", "error");
            return;
        }
        if (!day) {
            (0, toast_1.showToast)("Please select a day of week", "error");
            return;
        }
        const qs = new URLSearchParams();
        if (periodKey)
            qs.set("period", periodKey);
        if (day)
            qs.set("dow", day);
        if (date)
            qs.set("date", date);
        const trimmedUser = user.trim();
        if (trimmedUser)
            qs.set("user", trimmedUser);
        const url = `/admin/marketing-report${qs.toString() ? `?${qs.toString()}` : ""}`;
        router.push(url);
    };
    return ((0, jsx_runtime_1.jsxs)("form", { onSubmit: apply, className: "flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-lg shadow-black/20", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-sm font-semibold text-slate-200", children: "Filters" }), (0, jsx_runtime_1.jsxs)("div", { className: "grid gap-3 md:grid-cols-5", children: [(0, jsx_runtime_1.jsxs)("div", { className: "space-y-1", children: [(0, jsx_runtime_1.jsx)("label", { className: "text-xs uppercase tracking-wide text-slate-400", children: "Trading period" }), (0, jsx_runtime_1.jsx)("select", { value: periodKey, onChange: (e) => setPeriodKey(e.target.value), className: "w-full rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-slate-100", children: periods.map((p) => ((0, jsx_runtime_1.jsx)("option", { value: p.key, children: p.label }, p.key))) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-1", children: [(0, jsx_runtime_1.jsx)("label", { className: "text-xs uppercase tracking-wide text-slate-400", children: "Date" }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-2", children: [(0, jsx_runtime_1.jsx)("input", { type: "date", value: date ?? "", onChange: (e) => {
                                            const v = e.target.value || undefined;
                                            setDate(v);
                                            if (v)
                                                setDay(deriveDayOfWeek(v));
                                        }, min: periods.find((p) => p.key === periodKey)?.start.toISOString().split("T")[0], max: periods.find((p) => p.key === periodKey)?.end.toISOString().split("T")[0], className: "w-full rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-slate-100" }), date ? ((0, jsx_runtime_1.jsx)("button", { type: "button", "aria-label": "Clear date", onClick: () => {
                                            setDate(undefined);
                                            setDay("");
                                        }, className: "rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 hover:border-slate-500", children: "Clear" })) : null] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-1", children: [(0, jsx_runtime_1.jsx)("label", { className: "text-xs uppercase tracking-wide text-slate-400", children: "Day of week" }), (0, jsx_runtime_1.jsxs)("select", { value: day, onChange: (e) => setDay(e.target.value), className: "w-full rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-slate-100", children: [(0, jsx_runtime_1.jsx)("option", { value: "", children: "All days" }), ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((d) => ((0, jsx_runtime_1.jsx)("option", { value: d, children: d }, d)))] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-1", children: [(0, jsx_runtime_1.jsx)("label", { className: "text-xs uppercase tracking-wide text-slate-400", children: "User filter" }), (0, jsx_runtime_1.jsx)("input", { value: user, onChange: (e) => setUser(e.target.value), placeholder: "Attendant name or email", className: "w-full rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-slate-100" })] }), (0, jsx_runtime_1.jsx)("div", { className: "flex items-end", children: (0, jsx_runtime_1.jsx)(Button_1.default, { type: "submit", variant: "primary", className: "w-full justify-center bg-emerald-500 text-white hover:brightness-95", children: "Apply filters" }) })] })] }));
}
