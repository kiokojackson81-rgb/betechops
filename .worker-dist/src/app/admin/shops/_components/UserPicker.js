"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = UserPicker;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
function UserPicker({ onSelect, placeholder }) {
    const [q, setQ] = (0, react_1.useState)("");
    const [results, setResults] = (0, react_1.useState)([]);
    const [open, setOpen] = (0, react_1.useState)(false);
    (0, react_1.useEffect)(() => {
        if (!q)
            return setResults([]);
        const t = setTimeout(async () => {
            try {
                const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`);
                if (!res.ok)
                    return setResults([]);
                const j = await res.json();
                setResults(j || []);
                setOpen(true);
            }
            catch {
                setResults([]);
            }
        }, 300);
        return () => clearTimeout(t);
    }, [q]);
    return ((0, jsx_runtime_1.jsxs)("div", { className: "relative inline-block", children: [(0, jsx_runtime_1.jsx)("input", { value: q, onChange: (e) => { setQ(e.target.value); onSelect(null); }, onFocus: () => q && setOpen(true), placeholder: placeholder || 'Search user by name or email', className: "border p-1" }), open && results.length > 0 && ((0, jsx_runtime_1.jsx)("div", { className: "absolute z-20 bg-white border mt-1 max-h-48 overflow-auto w-full shadow", children: results.map((r) => ((0, jsx_runtime_1.jsxs)("div", { className: "p-2 hover:bg-slate-100 cursor-pointer", onClick: () => { onSelect({ id: r.id, label: `${r.name} <${r.email || ''}>` }); setOpen(false); setQ(''); }, children: [(0, jsx_runtime_1.jsx)("div", { className: "font-medium", children: r.name }), (0, jsx_runtime_1.jsx)("div", { className: "text-sm text-slate-500", children: r.email })] }, r.id))) }))] }));
}
