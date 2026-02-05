"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.viewport = exports.metadata = void 0;
exports.default = RootLayout;
const jsx_runtime_1 = require("react/jsx-runtime");
// Avoid fetching Google Fonts during CI/local build; use CSS variable placeholders
// instead of `next/font/google` which performs network requests at build time.
require("./globals.css");
const ToastContainer_1 = __importDefault(require("./_components/ToastContainer"));
const ConfirmProvider_1 = __importDefault(require("./_components/ConfirmProvider"));
const geistSans = { variable: "--font-geist-sans" };
const geistMono = { variable: "--font-geist-mono" };
exports.metadata = {
    title: {
        default: "BetechOps Operations",
        template: "%s · BetechOps",
    },
    description: "Real-time operations dashboards, support portals, and workflows for the BetechOps team.",
    openGraph: {
        type: "website",
        title: "BetechOps Operations",
        description: "Real-time operations dashboards, support portals, and workflows for the BetechOps team.",
        url: "https://betech.co.ke",
    },
};
exports.viewport = {
    width: "device-width",
    initialScale: 1,
};
function RootLayout({ children, }) {
    return ((0, jsx_runtime_1.jsx)("html", { lang: "en", children: (0, jsx_runtime_1.jsx)("body", { className: `${geistSans.variable} ${geistMono.variable} antialiased bg-slate-950 text-slate-50`, children: (0, jsx_runtime_1.jsxs)("div", { className: "flex min-h-screen flex-col", children: [(0, jsx_runtime_1.jsx)(ToastContainer_1.default, {}), (0, jsx_runtime_1.jsx)(ConfirmProvider_1.default, {}), (0, jsx_runtime_1.jsx)("main", { className: "flex-1 w-full", children: children })] }) }) }));
}
