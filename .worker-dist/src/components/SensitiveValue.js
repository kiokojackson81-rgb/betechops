"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = SensitiveValue;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const react_2 = require("next-auth/react");
function SensitiveValue({ value, format, storageKey, placeholder = "•••", className = "", forceVisible, forceHidden, }) {
    // Remove session gating for toggling visibility — allow local toggle
    // so users can lock/unlock locally without requiring authentication.
    const _sess = (0, react_2.useSession)();
    const session = _sess?.data;
    const key = typeof storageKey === "string" && storageKey.length > 0
        ? `sensitive:${storageKey}`
        : typeof window !== "undefined"
            ? `sensitive:${window.location.pathname}:${String(value).slice(0, 40)}`
            : `sensitive:unknown`;
    const [visible, setVisible] = (0, react_1.useState)(() => {
        try {
            if (typeof window === "undefined")
                return false;
            const raw = localStorage.getItem(key);
            const val = raw === "1";
            return val;
        }
        catch {
            return false;
        }
    });
    (0, react_1.useEffect)(() => {
        try {
            localStorage.setItem(key, visible ? "1" : "0");
        }
        catch {
            // ignore
        }
    }, [key, visible]);
    (0, react_1.useEffect)(() => {
        if (forceHidden) {
            setVisible(false);
            return;
        }
        if (forceVisible) {
            setVisible(true);
        }
    }, [forceHidden, forceVisible]);
    const onToggle = () => {
        if (forceHidden)
            return;
        if (visible) {
            setVisible(false);
            return;
        }
        // Allow local unhide without requiring a server session. This keeps
        // behavior simple: clicking toggles visibility and stores it in
        // localStorage. Auto-lock behavior (if desired) is handled by the
        // adjacent `useCardLock` hook for cards.
        setVisible(true);
        return;
    };
    const formatted = format ? format(value) : String(value);
    return ((0, jsx_runtime_1.jsx)("button", { type: "button", onClick: onToggle, className: `inline-flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded ${className} cursor-pointer`, "aria-pressed": visible, "aria-label": visible ? "Hide value" : "Show value (login required)", title: visible ? "Hide value" : "Click to show (login required)", children: visible ? ((0, jsx_runtime_1.jsx)("span", { className: "select-none pointer-events-auto", children: formatted })) : ((0, jsx_runtime_1.jsxs)("span", { className: "inline-flex items-center gap-2 pointer-events-auto", children: [(0, jsx_runtime_1.jsx)("span", { className: "blur-sm opacity-60 select-none", children: formatted }), (0, jsx_runtime_1.jsx)("span", { "aria-hidden": true, className: "text-xs text-slate-400", children: placeholder })] })) }));
}
