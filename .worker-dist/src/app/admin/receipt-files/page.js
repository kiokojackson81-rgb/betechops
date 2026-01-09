"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = Page;
const jsx_runtime_1 = require("react/jsx-runtime");
const ReceiptFilesAdminClient_1 = __importDefault(require("./ReceiptFilesAdminClient"));
function Page() {
    return ((0, jsx_runtime_1.jsx)("div", { className: "p-4 max-w-4xl mx-auto", children: (0, jsx_runtime_1.jsx)(ReceiptFilesAdminClient_1.default, {}) }));
}
