"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = ConfirmProvider;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
function ConfirmProvider() {
    const [queue, setQueue] = (0, react_1.useState)([]);
    (0, react_1.useEffect)(() => {
        function onRequest(e) {
            const ev = e;
            const id = ev.detail?.id;
            if (!id)
                return;
            setQueue((q) => [...q, { id: id, message: ev.detail.message || '' }]);
        }
        window.addEventListener('betechops:confirm-request', onRequest);
        return () => window.removeEventListener('betechops:confirm-request', onRequest);
    }, []);
    function respond(id, ok) {
        window.dispatchEvent(new CustomEvent('betechops:confirm-response', { detail: { id, ok } }));
        setQueue((q) => q.filter(x => x.id !== id));
    }
    if (!queue.length)
        return null;
    const top = queue[0];
    return ((0, jsx_runtime_1.jsxs)("div", { style: { position: 'fixed', left: 0, right: 0, top: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999 }, children: [(0, jsx_runtime_1.jsx)("div", { style: { background: 'rgba(0,0,0,0.4)', position: 'absolute', inset: 0 } }), (0, jsx_runtime_1.jsxs)("div", { style: { background: 'white', padding: 20, borderRadius: 8, zIndex: 100000, minWidth: 320 }, children: [(0, jsx_runtime_1.jsx)("div", { style: { marginBottom: 12 }, children: top.message }), (0, jsx_runtime_1.jsxs)("div", { style: { display: 'flex', justifyContent: 'flex-end', gap: 8 }, children: [(0, jsx_runtime_1.jsx)("button", { onClick: () => respond(top.id, false), style: { padding: '8px 12px' }, children: "Cancel" }), (0, jsx_runtime_1.jsx)("button", { onClick: () => respond(top.id, true), style: { padding: '8px 12px', background: '#2563eb', color: 'white' }, children: "OK" })] })] })] }));
}
