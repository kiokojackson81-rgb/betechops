"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = FeedLookup;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
function FeedLookup() {
    const [feedId, setFeedId] = (0, react_1.useState)("");
    const [busy, setBusy] = (0, react_1.useState)(false);
    const [result, setResult] = (0, react_1.useState)(null);
    async function run(e) {
        e.preventDefault();
        if (!feedId.trim())
            return;
        setBusy(true);
        setResult(null);
        try {
            const r = await fetch(`/api/jumia/feeds/${encodeURIComponent(feedId.trim())}`, { cache: "no-store" });
            const j = await r.json().catch(() => ({}));
            setResult(j);
        }
        catch (err) {
            setResult({ ok: false, error: err?.message || String(err) });
        }
        finally {
            setBusy(false);
        }
    }
    return ((0, jsx_runtime_1.jsxs)("div", { className: "rounded border border-white/10 p-3 bg-white/5", children: [(0, jsx_runtime_1.jsxs)("form", { onSubmit: run, className: "flex flex-wrap gap-2 items-end", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-xs mb-1", children: "Feed ID" }), (0, jsx_runtime_1.jsx)("input", { value: feedId, onChange: e => setFeedId(e.target.value), placeholder: "fb53ce1d-6268-...", className: "rounded bg-white/5 border border-white/10 px-3 py-1.5" })] }), (0, jsx_runtime_1.jsx)("button", { disabled: busy, className: "rounded border border-white/10 px-3 py-1.5 hover:bg-white/10", children: "Lookup" })] }), (0, jsx_runtime_1.jsx)("div", { className: "mt-3 text-xs text-slate-300 font-mono whitespace-pre-wrap break-words", children: result ? JSON.stringify(result, null, 2) : (0, jsx_runtime_1.jsx)("span", { className: "text-slate-500", children: "Result will appear here\u2026" }) })] }));
}
