"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = AdminOnlineLayout;
const jsx_runtime_1 = require("react/jsx-runtime");
const AdminOnlineNav_1 = __importDefault(require("./_components/AdminOnlineNav"));
function AdminOnlineLayout({ children }) {
    return ((0, jsx_runtime_1.jsxs)("div", { className: "min-h-screen bg-slate-950 text-slate-50", children: [(0, jsx_runtime_1.jsx)("header", { className: "border-b border-white/10 bg-slate-900/60", children: (0, jsx_runtime_1.jsxs)("div", { className: "mx-auto max-w-7xl px-6 py-6 space-y-4", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("p", { className: "text-xs font-semibold uppercase tracking-wide text-slate-400", children: "Admin" }), (0, jsx_runtime_1.jsx)("h1", { className: "text-2xl font-semibold text-white", children: "Online Operations" }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-400", children: "Monitor marketplace accounts, returns and aggregate sales synced via the new online ops pipelines." })] }), (0, jsx_runtime_1.jsx)(AdminOnlineNav_1.default, {})] }) }), (0, jsx_runtime_1.jsx)("main", { className: "mx-auto max-w-7xl px-6 py-8", children: children })] }));
}
