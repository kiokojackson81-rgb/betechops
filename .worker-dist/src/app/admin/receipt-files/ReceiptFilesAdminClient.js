"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = ReceiptFilesAdminClient;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
function ReceiptFilesAdminClient() {
    const [files, setFiles] = (0, react_1.useState)([]);
    const [loading, setLoading] = (0, react_1.useState)(true);
    const load = async () => {
        setLoading(true);
        const res = await fetch('/api/receipt-files');
        const j = await res.json();
        setFiles(j.files || []);
        setLoading(false);
    };
    (0, react_1.useEffect)(() => { load(); }, []);
    const remove = async (id) => {
        if (!confirm('Delete this receipt file?'))
            return;
        const res = await fetch(`/api/receipt-files/${id}`, { method: 'DELETE' });
        const j = await res.json();
        if (j.ok)
            load();
        else
            alert(j.error || 'Failed');
    };
    return ((0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("h2", { className: "text-lg font-semibold", children: "Receipt Files" }), loading ? (0, jsx_runtime_1.jsx)("div", { children: "Loading..." }) : ((0, jsx_runtime_1.jsxs)("table", { className: "w-full border-collapse mt-2", children: [(0, jsx_runtime_1.jsx)("thead", { children: (0, jsx_runtime_1.jsxs)("tr", { children: [(0, jsx_runtime_1.jsx)("th", { children: "Receipt" }), (0, jsx_runtime_1.jsx)("th", { children: "URL" }), (0, jsx_runtime_1.jsx)("th", { children: "UploadedAt" }), (0, jsx_runtime_1.jsx)("th", { children: "ExpiresAt" }), (0, jsx_runtime_1.jsx)("th", { children: "Actions" })] }) }), (0, jsx_runtime_1.jsx)("tbody", { children: files.map(f => ((0, jsx_runtime_1.jsxs)("tr", { className: "border-t", children: [(0, jsx_runtime_1.jsx)("td", { children: f.receiptId }), (0, jsx_runtime_1.jsx)("td", { children: (0, jsx_runtime_1.jsx)("a", { href: f.url, target: "_blank", rel: "noreferrer", children: "link" }) }), (0, jsx_runtime_1.jsx)("td", { children: new Date(f.uploadedAt).toLocaleString() }), (0, jsx_runtime_1.jsx)("td", { children: f.expiresAt ? new Date(f.expiresAt).toLocaleString() : '' }), (0, jsx_runtime_1.jsx)("td", { children: (0, jsx_runtime_1.jsx)("button", { className: "text-red-600", onClick: () => remove(f.id), children: "Delete" }) })] }, f.id))) })] }))] }));
}
