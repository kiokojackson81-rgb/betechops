"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = ToastContainer;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
function ToastContainer() {
    const [items, setItems] = (0, react_1.useState)([]);
    (0, react_1.useEffect)(() => {
        let idSeq = 1;
        function onToast(e) {
            const ev = e;
            const { message, type } = ev.detail || {};
            const msg = message ?? String(e);
            const tp = type ?? 'info';
            const id = idSeq++;
            setItems((s) => [...s, { id, message: msg, type: tp }]);
            setTimeout(() => setItems((s) => s.filter(x => x.id !== id)), 4000);
        }
        window.addEventListener('betechops:toast', onToast);
        return () => window.removeEventListener('betechops:toast', onToast);
    }, []);
    if (!items.length)
        return null;
    return ((0, jsx_runtime_1.jsx)("div", { style: { position: 'fixed', right: 12, top: 12, zIndex: 9999 }, children: items.map(i => ((0, jsx_runtime_1.jsx)("div", { style: { marginBottom: 8, padding: '8px 12px', background: '#111827', color: 'white', borderRadius: 6, minWidth: 220 }, children: (0, jsx_runtime_1.jsx)("div", { style: { fontSize: 14 }, children: i.message }) }, i.id))) }));
}
