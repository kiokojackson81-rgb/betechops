"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.default = Page;
const jsx_runtime_1 = require("react/jsx-runtime");
const EndpointConsoleFrame_1 = __importDefault(require("@/app/admin/_components/EndpointConsoleFrame"));
exports.dynamic = 'force-dynamic';
function Page() {
    return ((0, jsx_runtime_1.jsx)("div", { className: "p-6", children: (0, jsx_runtime_1.jsx)(EndpointConsoleFrame_1.default, {}) }));
}
