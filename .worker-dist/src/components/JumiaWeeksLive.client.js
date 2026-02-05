"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = JumiaWeeksLive;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
function JumiaWeeksLive({ initialData, totalActiveAccounts }) {
    const [weeks, setWeeks] = (0, react_1.useState)(initialData ?? []);
    const [loading, setLoading] = (0, react_1.useState)(false);
    const currencyFormatter = new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 });
    const numberFormatter = new Intl.NumberFormat("en-KE");
    (0, react_1.useEffect)(() => {
        let mounted = true;
        const fetchOnce = async () => {
            setLoading(true);
            try {
                const res = await fetch(`/api/admin/online/jumia-weeks`, { cache: "no-store", credentials: 'include' });
                if (!res.ok) {
                    // don't overwrite existing data on auth errors or other failures
                    return;
                }
                const json = await res.json();
                // debug: expose fetched payload in browser console for troubleshooting
                // eslint-disable-next-line no-console
                console.debug('[JumiaWeeksLive] fetched payload', json);
                // json.accounts -> array of accounts each with weeks[]; we need to aggregate per week across accounts
                const weeksMap = new Map();
                for (const acc of json.accounts || []) {
                    for (const w of acc.weeks || []) {
                        const key = w.weekStart;
                        const entry = weeksMap.get(key) ?? { label: w.weekStart + "", _sum: { grossSales: 0, payoutAmount: 0 }, realRowCount: 0, placeholderRowCount: 0, accountCount: 0, missingCount: 0 };
                        entry._sum.grossSales += Number(w.grossSales || 0);
                        entry._sum.payoutAmount += Number(w.payoutAmount || 0);
                        if (w.placeholder)
                            entry.placeholderRowCount += 1;
                        else
                            entry.realRowCount += 1;
                        entry.accountCount += 1;
                        weeksMap.set(key, entry);
                    }
                }
                const mapped = Array.from(weeksMap.entries()).map(([k, v]) => ({ ...v, label: k }));
                mapped.sort((a, b) => (a.label < b.label ? 1 : -1));
                if (mounted && mapped.length)
                    setWeeks(mapped.slice(0, 8));
            }
            catch (e) {
                // ignore - keep existing UI
            }
            finally {
                if (mounted)
                    setLoading(false);
            }
        };
        fetchOnce();
        const id = setInterval(fetchOnce, 15000);
        return () => { mounted = false; clearInterval(id); };
    }, []);
    return ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)("div", { className: "mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4", children: weeks.length ? (weeks.map((w) => {
                    const gross = Number(w._sum?.grossSales ?? 0);
                    const payout = Number(w._sum?.payoutAmount ?? 0);
                    return ((0, jsx_runtime_1.jsxs)("a", { className: "block rounded-lg border border-white/10 bg-slate-950/60 px-4 py-3 hover:bg-slate-900/50", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-sm text-slate-300", children: w.label }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-2 text-xs text-slate-400", children: ["Accounts: ", (0, jsx_runtime_1.jsx)("span", { className: "font-semibold text-white", children: totalActiveAccounts }), " (Present ", numberFormatter.format(w.realRowCount ?? w.accountCount ?? 0), " / Missing ", numberFormatter.format(w.missingCount ?? 0), ") ", w.placeholderRowCount ? ((0, jsx_runtime_1.jsxs)("span", { className: "ml-2 text-xs text-slate-400", children: ["(Placeholders ", numberFormatter.format(w.placeholderRowCount), ")"] })) : null] }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-1 text-sm text-emerald-300", children: ["Gross: ", currencyFormatter.format(gross)] }), (0, jsx_runtime_1.jsxs)("div", { className: "text-sm text-emerald-200", children: ["Payout: ", currencyFormatter.format(payout)] })] }, w.label));
                })) : ((0, jsx_runtime_1.jsx)("div", { className: "text-sm text-slate-400", children: "No payout weeks found." })) }), loading ? (0, jsx_runtime_1.jsx)("div", { className: "mt-2 text-xs text-slate-400", children: "Refreshing..." }) : null] }));
}
