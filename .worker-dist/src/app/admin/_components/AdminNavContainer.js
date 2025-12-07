"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = AdminNavContainer;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const link_1 = __importDefault(require("next/link"));
const AdminTopNav_1 = __importDefault(require("./AdminTopNav"));
const AdminTopbarBadges_1 = __importDefault(require("./AdminTopbarBadges"));
const AdminUserMenu_1 = __importDefault(require("./AdminUserMenu"));
function AdminNavContainer() {
    const [open, setOpen] = (0, react_1.useState)(() => {
        try {
            return localStorage.getItem("adminNavOpen") === "1";
        }
        catch {
            return false;
        }
    });
    const drawerRef = (0, react_1.useRef)(null);
    const firstLinkRef = (0, react_1.useRef)(null);
    (0, react_1.useEffect)(() => {
        function onKey(e) {
            if (e.key === "Escape")
                setOpen(false);
        }
        function onClick(e) {
            if (open && drawerRef.current && !drawerRef.current.contains(e.target)) {
                if (!(e.target instanceof HTMLElement && e.target.dataset?.navToggle === "1")) {
                    setOpen(false);
                }
            }
        }
        window.addEventListener("keydown", onKey);
        window.addEventListener("click", onClick);
        return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("click", onClick); };
    }, [open]);
    // Persist the open state across page transitions and lock body scroll when open
    (0, react_1.useEffect)(() => {
        try {
            localStorage.setItem("adminNavOpen", open ? "1" : "0");
        }
        catch { }
        if (open)
            document.body.classList.add("overflow-hidden");
        else
            document.body.classList.remove("overflow-hidden");
    }, [open]);
    // Keyboard navigation for drawer links (Arrow keys, Home/End)
    (0, react_1.useEffect)(() => {
        if (!open)
            return;
        const root = drawerRef.current;
        if (!root)
            return;
        const links = Array.from(root.querySelectorAll("a.nav-link, a[href]"));
        if (!links.length)
            return;
        let idx = 0;
        // focus first
        links[0].focus();
        function onKey(e) {
            if (!links.length)
                return;
            if (e.key === "ArrowDown" || e.key === "ArrowRight") {
                e.preventDefault();
                idx = (idx + 1) % links.length;
                links[idx].focus();
            }
            else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
                e.preventDefault();
                idx = (idx - 1 + links.length) % links.length;
                links[idx].focus();
            }
            else if (e.key === "Home") {
                e.preventDefault();
                idx = 0;
                links[idx].focus();
            }
            else if (e.key === "End") {
                e.preventDefault();
                idx = links.length - 1;
                links[idx].focus();
            }
            else if (e.key === "Escape") {
                setOpen(false);
            }
        }
        root.addEventListener("keydown", onKey);
        return () => root.removeEventListener("keydown", onKey);
    }, [open]);
    return ((0, jsx_runtime_1.jsxs)("div", { className: "max-w-7xl mx-auto px-2 md:px-4 py-2 flex items-center gap-3", children: [(0, jsx_runtime_1.jsx)("button", { "data-nav-toggle": "1", "aria-label": "Toggle navigation menu", "aria-expanded": open, onClick: () => setOpen(o => !o), className: "md:hidden inline-flex items-center justify-center h-10 w-10 rounded-md border border-white/15 bg-white/5 hover:bg-white/10", children: (0, jsx_runtime_1.jsxs)("div", { className: "space-y-1", children: [(0, jsx_runtime_1.jsx)("span", { className: "block h-[2px] w-5 bg-white transition-transform " + (open ? "translate-y-[5px] rotate-45" : "") }), (0, jsx_runtime_1.jsx)("span", { className: "block h-[2px] w-5 bg-white transition-opacity " + (open ? "opacity-0" : "") }), (0, jsx_runtime_1.jsx)("span", { className: "block h-[2px] w-5 bg-white transition-transform " + (open ? "-translate-y-[5px] -rotate-45" : "") })] }) }), (0, jsx_runtime_1.jsx)(link_1.default, { href: "/admin", className: "font-semibold tracking-tight text-base md:text-lg shrink-0 whitespace-nowrap", children: "BetechOps \u2014 Unified Admin" }), (0, jsx_runtime_1.jsx)("div", { className: "flex-1 hidden md:block overflow-hidden", children: (0, jsx_runtime_1.jsx)(AdminTopNav_1.default, {}) }), (0, jsx_runtime_1.jsxs)("div", { className: "hidden md:flex items-center gap-2", children: [(0, jsx_runtime_1.jsx)(AdminTopbarBadges_1.default, {}), (0, jsx_runtime_1.jsx)(AdminUserMenu_1.default, {})] }), (0, jsx_runtime_1.jsxs)("div", { "aria-hidden": !open, className: "fixed inset-0 z-40 md:hidden pointer-events-none " + (open ? "" : "opacity-0"), children: [(0, jsx_runtime_1.jsx)("div", { className: "absolute inset-0 bg-black/60 transition-opacity " + (open ? "opacity-100 pointer-events-auto" : "opacity-0"), onClick: () => setOpen(false) }), (0, jsx_runtime_1.jsxs)("div", { ref: drawerRef, className: "absolute top-0 left-0 right-0 bg-[var(--panel,#121723)] border-b border-white/10 pt-2 pb-4 shadow-xl transform transition-transform " +
                            (open ? "translate-y-0 opacity-100 pointer-events-auto animate-slideDown" : "-translate-y-3 opacity-0 pointer-events-none"), role: "dialog", "aria-modal": "true", children: [(0, jsx_runtime_1.jsx)("div", { className: "px-3 mb-2", children: (0, jsx_runtime_1.jsx)(AdminUserMenu_1.default, { compact: true }) }), (0, jsx_runtime_1.jsx)("div", { className: "px-1", children: (0, jsx_runtime_1.jsx)(AdminTopNav_1.default, { mobile: true }) }), (0, jsx_runtime_1.jsx)("div", { className: "px-4 mt-4", children: (0, jsx_runtime_1.jsx)(AdminTopbarBadges_1.default, {}) })] })] })] }));
}
