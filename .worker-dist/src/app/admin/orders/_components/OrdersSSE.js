"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = OrdersSSE;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const navigation_1 = require("next/navigation");
function OrdersSSE({ status, country, shopId, dateFrom, dateTo, intervalMs = 4000 }) {
    const router = (0, navigation_1.useRouter)();
    const esRef = (0, react_1.useRef)(null);
    const [live, setLive] = (0, react_1.useState)('connecting');
    (0, react_1.useEffect)(() => {
        const params = new URLSearchParams();
        if (status)
            params.set('status', status);
        if (country)
            params.set('country', country);
        if (shopId)
            params.set('shopId', shopId);
        if (dateFrom)
            params.set('dateFrom', dateFrom);
        if (dateTo)
            params.set('dateTo', dateTo);
        params.set('intervalMs', String(intervalMs));
        const url = `/api/orders/events?${params.toString()}`;
        const es = new EventSource(url, { withCredentials: false });
        esRef.current = es;
        es.onopen = () => setLive('on');
        es.onerror = () => setLive('off');
        es.addEventListener('orders', (ev) => {
            try {
                // Broadcast a lightweight client event instead of full router.refresh to avoid flicker
                const detail = { source: 'sse', ts: Date.now() };
                window.dispatchEvent(new CustomEvent('orders:refresh', { detail }));
            }
            catch { }
            // Avoid full page refresh here; OrdersLiveData listens for orders:refresh and fetches incrementally
        });
        return () => {
            try {
                es.close();
            }
            catch { }
            esRef.current = null;
            setLive('off');
        };
    }, [status, country, shopId, dateFrom, dateTo, intervalMs, router]);
    return ((0, jsx_runtime_1.jsxs)("div", { className: "text-xs text-slate-400 flex items-center gap-2", title: "Live updates via SSE", children: [(0, jsx_runtime_1.jsx)("span", { children: "Live" }), (0, jsx_runtime_1.jsx)("span", { className: live === 'on' ? 'inline-block w-2 h-2 rounded-full bg-green-500' : live === 'connecting' ? 'inline-block w-2 h-2 rounded-full bg-yellow-500' : 'inline-block w-2 h-2 rounded-full bg-slate-500' }), (0, jsx_runtime_1.jsx)("span", { className: "opacity-60", children: "SSE" })] }));
}
