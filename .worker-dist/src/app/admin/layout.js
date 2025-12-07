"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.default = AdminLayout;
const jsx_runtime_1 = require("react/jsx-runtime");
const AdminStatusBanner_1 = __importDefault(require("./_components/AdminStatusBanner"));
const AdminNavContainer_1 = __importDefault(require("./_components/AdminNavContainer"));
const AdminTips_1 = __importDefault(require("./_components/AdminTips"));
require("./admin.css");
exports.dynamic = "force-dynamic";
// NAV items live in _components/adminNav.ts now.
function AdminLayout({ children }) {
    return ((0, jsx_runtime_1.jsxs)("div", { className: "min-h-screen bg-[var(--bg,#0f131b)] text-slate-100", children: [(0, jsx_runtime_1.jsxs)("div", { className: "sticky top-0 z-50 shadow-lg shadow-black/30", children: [(0, jsx_runtime_1.jsx)(AdminStatusBanner_1.default, {}), (0, jsx_runtime_1.jsx)("div", { className: "border-b border-white/10 bg-[var(--panel,#121723)] backdrop-blur supports-[backdrop-filter]:bg-[color-mix(in_srgb,var(--panel)#121723,transparent_15%)]", children: (0, jsx_runtime_1.jsx)(AdminNavContainer_1.default, {}) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "max-w-7xl mx-auto px-4 py-6", children: [(0, jsx_runtime_1.jsx)("main", { children: children }), (0, jsx_runtime_1.jsx)(AdminTips_1.default, {})] })] }));
}
