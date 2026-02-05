"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.metadata = void 0;
exports.default = ReceiptPreviewLayout;
const jsx_runtime_1 = require("react/jsx-runtime");
exports.metadata = {
    title: "Betech receipt preview",
};
function ReceiptPreviewLayout({ children }) {
    return ((0, jsx_runtime_1.jsx)("html", { lang: "en", children: (0, jsx_runtime_1.jsx)("body", { className: "bg-white text-black", children: children }) }));
}
