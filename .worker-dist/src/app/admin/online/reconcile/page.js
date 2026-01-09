"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = Page;
const jsx_runtime_1 = require("react/jsx-runtime");
const onlineReconcile_1 = require("@/lib/jobs/onlineReconcile");
async function Page() {
    const data = await (0, onlineReconcile_1.reconcileWeeks)(8);
    return ((0, jsx_runtime_1.jsxs)("div", { style: { padding: 20 }, children: [(0, jsx_runtime_1.jsx)("h1", { children: "Online Reconciliation (last 8 weeks)" }), (0, jsx_runtime_1.jsxs)("table", { style: { width: '100%', borderCollapse: 'collapse' }, children: [(0, jsx_runtime_1.jsx)("thead", { children: (0, jsx_runtime_1.jsxs)("tr", { children: [(0, jsx_runtime_1.jsx)("th", { children: "Week" }), (0, jsx_runtime_1.jsx)("th", { children: "Payout Rows" }), (0, jsx_runtime_1.jsx)("th", { children: "Gross" }), (0, jsx_runtime_1.jsx)("th", { children: "WeeklySale sum" }), (0, jsx_runtime_1.jsx)("th", { children: "Duplicates" }), (0, jsx_runtime_1.jsx)("th", { children: "Missing SIDs" })] }) }), (0, jsx_runtime_1.jsx)("tbody", { children: data.map((r) => ((0, jsx_runtime_1.jsxs)("tr", { children: [(0, jsx_runtime_1.jsxs)("td", { children: [r.weekStart, " \u2192 ", r.weekEnd] }), (0, jsx_runtime_1.jsx)("td", { children: r.payoutRows }), (0, jsx_runtime_1.jsx)("td", { children: r.totalGross.toFixed(2) }), (0, jsx_runtime_1.jsx)("td", { children: r.weeklySum.toFixed(2) }), (0, jsx_runtime_1.jsx)("td", { children: r.duplicates }), (0, jsx_runtime_1.jsx)("td", { children: r.missingSids })] }, r.weekStart))) })] })] }));
}
