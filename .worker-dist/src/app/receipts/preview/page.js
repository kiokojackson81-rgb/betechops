"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = ReceiptPreviewPage;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
function ReceiptPreviewPage() {
    const [html, setHtml] = (0, react_1.useState)("");
    const [err, setErr] = (0, react_1.useState)(null);
    const [autoPrint, setAutoPrint] = (0, react_1.useState)(false);
    (0, react_1.useEffect)(() => {
        (async () => {
            try {
                const params = new URLSearchParams(window.location.search);
                const shouldAutoPrint = params.get("autoPrint") === "1";
                setAutoPrint(shouldAutoPrint);
                const enc = params.get("draft");
                if (!enc)
                    return setErr("No draft provided");
                const json = decodeURIComponent(enc);
                const parsed = JSON.parse(atob(json));
                const r = await fetch("/api/receipts/render-html", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ draft: parsed }),
                    cache: "no-store",
                });
                if (!r.ok) {
                    const j = await r.json().catch(() => ({}));
                    throw new Error(j?.error || "Failed to render receipt");
                }
                const j = await r.json();
                setHtml(j.html || "");
            }
            catch (e) {
                setErr(e?.message || "Invalid draft data");
            }
        })();
    }, []);
    (0, react_1.useEffect)(() => {
        if (!autoPrint || !html)
            return;
        const timer = window.setTimeout(() => window.print(), 0);
        return () => window.clearTimeout(timer);
    }, [autoPrint, html]);
    if (err)
        return (0, jsx_runtime_1.jsx)("div", { className: "p-6", children: err });
    if (!html)
        return (0, jsx_runtime_1.jsx)("div", { className: "p-6", children: "Loading preview." });
    return ((0, jsx_runtime_1.jsx)("div", { className: "receipt-screen receipt-print-area p-4 bg-white min-h-screen flex justify-center items-start", children: (0, jsx_runtime_1.jsxs)("div", { className: "bg-white max-w-4xl w-full p-8", children: [(0, jsx_runtime_1.jsx)("div", { className: "no-print flex justify-end mb-4", children: (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => window.print(), className: "rounded-full border border-slate-400 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-200", children: "Print Receipt" }) }), (0, jsx_runtime_1.jsx)("div", { dangerouslySetInnerHTML: { __html: html } })] }) }));
}
