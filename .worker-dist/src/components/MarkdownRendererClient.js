"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useRichFormatting = useRichFormatting;
exports.default = MarkdownRendererClient;
exports.RichFormattingToggle = RichFormattingToggle;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const PREF_KEY = "betech.richFormatting";
function useRichFormatting() {
    const [enabled, setEnabled] = (0, react_1.useState)(() => {
        try {
            if (typeof window === "undefined")
                return true;
            const raw = localStorage.getItem(PREF_KEY);
            if (raw === null)
                return true;
            return raw === "1" || raw === "true";
        }
        catch (e) {
            return true;
        }
    });
    (0, react_1.useEffect)(() => {
        try {
            if (typeof window === "undefined")
                return;
            localStorage.setItem(PREF_KEY, enabled ? "1" : "0");
        }
        catch (e) {
            // ignore
        }
    }, [enabled]);
    return { enabled, setEnabled };
}
function escapeHtml(str) {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
function renderInline(text) {
    // escaped text as input
    let t = text;
    // code spans `code`
    t = t.replace(/`([^`]+?)`/g, "<code>$1</code>");
    // strong **bold**
    t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    // emphasis *italic*
    t = t.replace(/\*([^*]+)\*/g, "<em>$1</em>");
    // simple link detection
    t = t.replace(/(https?:\/\/[^\s]+)/g, "<a href='$1' target='_blank' rel='noopener noreferrer'>$1</a>");
    return t;
}
function MarkdownRendererClient({ mdText, enabled = true }) {
    if (!mdText)
        return null;
    const raw = String(mdText || "");
    if (!enabled)
        return (0, jsx_runtime_1.jsx)("div", { className: "whitespace-pre-wrap text-sm text-slate-200", children: raw });
    // Lightweight, dependency-free markdown-ish renderer:
    // - paragraphs from blank lines
    // - unordered lists with lines starting with `- `
    // - inline `**bold**`, `*italic*`, `\`code\``, and http/https links
    const lines = raw.split(/\r?\n/);
    let html = "";
    let inList = false;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trimRight();
        if (line.match(/^\s*$/)) {
            if (inList) {
                html += "</ul>";
                inList = false;
            }
            continue;
        }
        const listMatch = line.match(/^\s*[-*+]\s+(.*)$/);
        if (listMatch) {
            if (!inList) {
                html += "<ul class='list-disc pl-5'>";
                inList = true;
            }
            const content = escapeHtml(listMatch[1]);
            html += `<li>${renderInline(content)}</li>`;
            continue;
        }
        // normal paragraph
        if (inList) {
            html += "</ul>";
            inList = false;
        }
        const content = escapeHtml(line);
        html += `<p>${renderInline(content)}</p>`;
    }
    if (inList)
        html += "</ul>";
    return (0, jsx_runtime_1.jsx)("div", { className: "prose max-w-none text-slate-200", dangerouslySetInnerHTML: { __html: html } });
}
function RichFormattingToggle({ className }) {
    const { enabled, setEnabled } = useRichFormatting();
    return ((0, jsx_runtime_1.jsxs)("label", { className: `inline-flex items-center gap-2 text-xs ${className ?? ""}`, children: [(0, jsx_runtime_1.jsx)("input", { type: "checkbox", checked: enabled, onChange: (e) => setEnabled(e.target.checked), className: "h-4 w-4 rounded border-slate-700 bg-slate-900 text-emerald-500" }), (0, jsx_runtime_1.jsx)("span", { className: "text-slate-400", children: "Rich format" })] }));
}
