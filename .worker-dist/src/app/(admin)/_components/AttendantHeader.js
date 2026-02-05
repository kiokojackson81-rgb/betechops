"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = AttendantHeader;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
function AttendantHeader({ user }) {
    const [kpis, setKpis] = (0, react_1.useState)(null);
    (0, react_1.useEffect)(() => {
        let mounted = true;
        async function load() {
            try {
                const res = await fetch('/api/metrics/kpis');
                if (!res.ok)
                    return;
                const data = await res.json();
                if (mounted)
                    setKpis(data);
            }
            catch {
                // ignore
            }
        }
        void load();
        return () => { mounted = false; };
    }, []);
    return ((0, jsx_runtime_1.jsxs)("header", { style: { padding: '12px 16px', borderBottom: '1px solid #e5e7eb' }, children: [(0, jsx_runtime_1.jsxs)("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' }, children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("h2", { style: { margin: 0 }, children: "Attendant" }), (0, jsx_runtime_1.jsx)("p", { style: { margin: 0, color: '#6b7280' }, children: user?.name ?? '—' })] }), (0, jsx_runtime_1.jsxs)("div", { style: { display: 'flex', gap: 24, alignItems: 'baseline' }, children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("div", { style: { fontSize: 12, color: '#6b7280' }, children: "Queued" }), (0, jsx_runtime_1.jsx)("div", { style: { fontWeight: 600 }, children: kpis ? kpis.queued : '—' })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("div", { style: { fontSize: 12, color: '#6b7280' }, children: "Today Packed" }), (0, jsx_runtime_1.jsx)("div", { style: { fontWeight: 600 }, children: kpis ? kpis.todayPacked : '—' })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("div", { style: { fontSize: 12, color: '#6b7280' }, children: "RTS" }), (0, jsx_runtime_1.jsx)("div", { style: { fontWeight: 600 }, children: kpis ? kpis.rts : '—' })] })] })] }), (0, jsx_runtime_1.jsx)("div", { style: { marginTop: 8, color: '#9ca3af', fontSize: 13 }, children: "Live KPIs powered by /api/metrics/kpis" })] }));
}
