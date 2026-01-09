"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = ReceiptDuplicateModal;
const jsx_runtime_1 = require("react/jsx-runtime");
const link_1 = __importDefault(require("next/link"));
function ReceiptDuplicateModal({ owner, onClose }) {
    if (!owner)
        return null;
    const renderOwnerInfo = () => {
        switch (owner.type) {
            case "pos":
                return ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-2", children: [(0, jsx_runtime_1.jsx)("p", { children: "Existing POS receipt found." }), (0, jsx_runtime_1.jsxs)("p", { className: "text-sm", children: ["Order: ", (0, jsx_runtime_1.jsx)("strong", { children: owner.ref })] }), (0, jsx_runtime_1.jsxs)("p", { className: "text-sm", children: ["Receipt ID: ", (0, jsx_runtime_1.jsx)("strong", { children: owner.id })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex gap-2", children: [(0, jsx_runtime_1.jsx)(link_1.default, { className: "btn-primary px-3 py-1", href: `/receipts/${owner.id}`, target: "_blank", rel: "noopener noreferrer", children: "Open receipt" }), (0, jsx_runtime_1.jsx)(link_1.default, { className: "border px-3 py-1", href: `/orders/${owner.ref}`, target: "_blank", rel: "noopener noreferrer", children: "Open order" })] })] }));
            case "marketing":
                return ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-2", children: [(0, jsx_runtime_1.jsx)("p", { children: "Existing marketing receipt found." }), (0, jsx_runtime_1.jsxs)("p", { className: "text-sm", children: ["Marketing record ID: ", (0, jsx_runtime_1.jsx)("strong", { children: owner.id })] }), (0, jsx_runtime_1.jsxs)("p", { className: "text-sm", children: ["Daily entry ID: ", (0, jsx_runtime_1.jsx)("strong", { children: owner.entryId })] }), (0, jsx_runtime_1.jsx)("div", { className: "flex gap-2", children: (0, jsx_runtime_1.jsx)("button", { className: "btn-primary px-3 py-1", onClick: () => { navigator.clipboard?.writeText(owner.id); }, children: "Copy ID" }) })] }));
            case "support":
                return ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-2", children: [(0, jsx_runtime_1.jsx)("p", { children: "Existing support receipt found." }), (0, jsx_runtime_1.jsxs)("p", { className: "text-sm", children: ["Support receipt ID: ", (0, jsx_runtime_1.jsx)("strong", { children: owner.id })] }), (0, jsx_runtime_1.jsxs)("p", { className: "text-sm", children: ["Daily entry ID: ", (0, jsx_runtime_1.jsx)("strong", { children: owner.entryId })] }), (0, jsx_runtime_1.jsx)("div", { className: "flex gap-2", children: (0, jsx_runtime_1.jsx)("button", { className: "btn-primary px-3 py-1", onClick: () => { navigator.clipboard?.writeText(owner.id); }, children: "Copy ID" }) })] }));
            default:
                return (0, jsx_runtime_1.jsx)("div", { children: "Receipt already exists." });
        }
    };
    return ((0, jsx_runtime_1.jsx)("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/50", children: (0, jsx_runtime_1.jsxs)("div", { className: "w-full max-w-lg rounded-lg bg-white p-6 text-black", children: [(0, jsx_runtime_1.jsx)("h3", { className: "text-lg font-semibold", children: "Duplicate receipt detected" }), (0, jsx_runtime_1.jsx)("div", { className: "mt-4", children: renderOwnerInfo() }), (0, jsx_runtime_1.jsx)("div", { className: "mt-6 flex justify-end gap-2", children: (0, jsx_runtime_1.jsx)("button", { className: "rounded-md border px-3 py-1", onClick: onClose, children: "Close" }) })] }) }));
}
