"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = AdminUserMenu;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const link_1 = __importDefault(require("next/link"));
const react_2 = require("next-auth/react");
function useOutside(ref, onClose) {
    (0, react_1.useEffect)(() => {
        function handler(e) {
            if (!ref.current)
                return;
            if (!ref.current.contains(e.target))
                onClose();
        }
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [onClose, ref]);
}
function AdminUserMenu({ compact = false }) {
    const [open, setOpen] = (0, react_1.useState)(false);
    const ref = (0, react_1.useRef)(null);
    useOutside(ref, () => setOpen(false));
    // Try to use next-auth session if available
    // Guard useSession return shape to avoid runtime crash when the hook returns undefined
    const _sess = (0, react_2.useSession)();
    const session = _sess?.data;
    const name = session?.user?.name ?? session?.user?.email ?? "Admin";
    const image = session?.user?.image;
    const initial = (name && name.length) ? name.charAt(0).toUpperCase() : "A";
    return ((0, jsx_runtime_1.jsxs)("div", { className: "relative", ref: ref, children: [(0, jsx_runtime_1.jsxs)("button", { onClick: () => setOpen(o => !o), "aria-haspopup": "menu", "aria-expanded": open, className: "flex items-center gap-2 rounded-full border border-white/15 bg-white/5 hover:bg-white/10 px-2 py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 " + (compact ? "text-xs" : "text-sm"), children: [image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    (0, jsx_runtime_1.jsx)("img", { src: image, alt: name, className: "h-6 w-6 rounded-full object-cover" })) : ((0, jsx_runtime_1.jsx)("span", { className: "inline-flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500/40 to-pink-500/40 text-white text-xs font-semibold shadow-inner", children: initial })), !compact && (0, jsx_runtime_1.jsx)("span", { className: "font-medium", children: name }), (0, jsx_runtime_1.jsx)("svg", { width: "12", height: "12", viewBox: "0 0 12 12", className: "transition-transform " + (open ? "rotate-180" : ""), children: (0, jsx_runtime_1.jsx)("path", { d: "M2 4l4 4 4-4", stroke: "currentColor", strokeWidth: "1.5", fill: "none", strokeLinecap: "round", strokeLinejoin: "round" }) })] }), open && ((0, jsx_runtime_1.jsxs)("div", { role: "menu", className: "absolute right-0 mt-2 w-48 rounded-lg border border-white/10 bg-[var(--panel,#121723)] shadow-lg p-2 text-sm z-50", children: [(0, jsx_runtime_1.jsx)("div", { className: "px-2 py-1 text-xs uppercase tracking-wide text-slate-400", children: "Account" }), (0, jsx_runtime_1.jsx)(link_1.default, { href: "/admin/settings", role: "menuitem", className: "block px-2 py-1 rounded hover:bg-white/5", children: "Settings" }), (0, jsx_runtime_1.jsx)("button", { onClick: () => (0, react_2.signOut)(), role: "menuitem", className: "w-full text-left block px-2 py-1 rounded hover:bg-white/5", children: "Sign out" })] }))] }));
}
