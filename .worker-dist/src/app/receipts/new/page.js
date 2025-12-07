"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.default = NewReceiptPage;
const jsx_runtime_1 = require("react/jsx-runtime");
const ReceiptFormClient_1 = __importDefault(require("./ReceiptFormClient"));
exports.dynamic = "force-dynamic";
function NewReceiptPage() {
    return ((0, jsx_runtime_1.jsx)("main", { className: "max-w-5xl mx-auto p-4", children: (0, jsx_runtime_1.jsx)(ReceiptFormClient_1.default, {}) }));
}
