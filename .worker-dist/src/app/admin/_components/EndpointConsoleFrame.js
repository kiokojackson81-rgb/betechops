"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = EndpointConsoleFrame;
const jsx_runtime_1 = require("react/jsx-runtime");
const EndpointConsole_1 = __importDefault(require("./jumia/EndpointConsole"));
function EndpointConsoleFrame() {
    return ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-4 p-6", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("h1", { className: "text-2xl font-bold", children: "Jumia Console" }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-400", children: "Run allow-listed vendor API calls using stored shop credentials." })] }), (0, jsx_runtime_1.jsx)("div", { className: "text-sm text-slate-500", children: (0, jsx_runtime_1.jsx)("a", { className: "underline", href: "/docs/INTEGRATIONS/JUMIA.md", children: "Docs" }) })] }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-400", children: "Run allow-listed vendor API calls using stored shop credentials." }), (0, jsx_runtime_1.jsx)(EndpointConsole_1.default, {})] }));
}
