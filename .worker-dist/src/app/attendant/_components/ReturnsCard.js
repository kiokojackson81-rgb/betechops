"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = ReturnsCard;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const toast_1 = __importDefault(require("@/lib/toast"));
function ReturnsCard() {
    const [open, setOpen] = (0, react_1.useState)(false);
    return ((0, jsx_runtime_1.jsxs)("section", { className: "rounded-2xl border border-white/10 bg-[linear-gradient(135deg,rgba(18,22,32,.9),rgba(18,22,32,.7))] p-4 backdrop-blur", children: [(0, jsx_runtime_1.jsxs)("div", { className: "mb-3 flex items-center justify-between", children: [(0, jsx_runtime_1.jsx)("h2", { className: "text-lg font-semibold", children: "Returns" }), (0, jsx_runtime_1.jsx)("button", { onClick: () => setOpen(true), className: "rounded-lg bg-white/10 px-3 py-1.5 text-sm hover:bg-white/20", children: "New Return" })] }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-400", children: "Capture return details with notes and photos." }), open && (0, jsx_runtime_1.jsx)(ReturnModal, { onClose: () => setOpen(false) })] }));
}
function ReturnModal({ onClose }) {
    const [product, setProduct] = (0, react_1.useState)("");
    const [qty, setQty] = (0, react_1.useState)("1");
    const [reason, setReason] = (0, react_1.useState)("Damaged");
    const [notes, setNotes] = (0, react_1.useState)("");
    const fileRef = (0, react_1.useRef)(null);
    const [busy, setBusy] = (0, react_1.useState)(false);
    const submit = async () => {
        setBusy(true);
        try {
            const fd = new FormData();
            fd.append("product", product);
            fd.append("qty", qty);
            fd.append("reason", reason);
            fd.append("notes", notes);
            if (fileRef.current?.files?.[0])
                fd.append("photo", fileRef.current.files[0]);
            const r = await fetch("/api/returns", { method: "POST", body: fd });
            if (!r.ok)
                throw new Error("return error");
            (0, toast_1.default)("Return submitted", 'success');
            onClose();
        }
        catch {
            (0, toast_1.default)("Failed to submit return", 'error');
        }
        finally {
            setBusy(false);
        }
    };
    return ((0, jsx_runtime_1.jsx)("div", { className: "fixed inset-0 z-50 grid place-items-center bg-black/60 p-4", children: (0, jsx_runtime_1.jsxs)("div", { className: "w-full max-w-lg rounded-2xl border border-white/10 bg-[#0b0e13] p-5", children: [(0, jsx_runtime_1.jsx)("h3", { className: "text-lg font-semibold", children: "New Return" }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-4 grid gap-3 sm:grid-cols-2", children: [(0, jsx_runtime_1.jsxs)("div", { className: "sm:col-span-2", children: [(0, jsx_runtime_1.jsx)("label", { className: "text-xs text-slate-400", children: "Product (name or SKU)" }), (0, jsx_runtime_1.jsx)("input", { value: product, onChange: (e) => setProduct(e.target.value), className: "mt-1 w-full rounded-lg border border-white/10 bg-transparent px-2 py-1 outline-none" })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "text-xs text-slate-400", children: "Quantity" }), (0, jsx_runtime_1.jsx)("input", { value: qty, onChange: (e) => setQty(e.target.value), className: "mt-1 w-full rounded-lg border border-white/10 bg-transparent px-2 py-1 outline-none" })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "text-xs text-slate-400", children: "Reason" }), (0, jsx_runtime_1.jsxs)("select", { value: reason, onChange: (e) => setReason(e.target.value), className: "mt-1 w-full rounded-lg border border-white/10 bg-transparent px-2 py-1 outline-none", children: [(0, jsx_runtime_1.jsx)("option", { children: "Damaged" }), (0, jsx_runtime_1.jsx)("option", { children: "Wrong item" }), (0, jsx_runtime_1.jsx)("option", { children: "Not working" }), (0, jsx_runtime_1.jsx)("option", { children: "Customer change of mind" })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "sm:col-span-2", children: [(0, jsx_runtime_1.jsx)("label", { className: "text-xs text-slate-400", children: "Notes" }), (0, jsx_runtime_1.jsx)("textarea", { value: notes, onChange: (e) => setNotes(e.target.value), className: "mt-1 w-full rounded-lg border border-white/10 bg-transparent px-2 py-1 outline-none", rows: 3 })] }), (0, jsx_runtime_1.jsxs)("div", { className: "sm:col-span-2", children: [(0, jsx_runtime_1.jsx)("label", { className: "text-xs text-slate-400", children: "Photo" }), (0, jsx_runtime_1.jsx)("input", { ref: fileRef, type: "file", accept: "image/*", className: "mt-1 w-full rounded-lg border border-white/10 bg-transparent file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-1 file:text-slate-100" })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-5 flex items-center justify-end gap-2", children: [(0, jsx_runtime_1.jsx)("button", { onClick: onClose, className: "rounded-lg border border-white/10 px-3 py-1.5 text-sm hover:bg-white/10", children: "Cancel" }), (0, jsx_runtime_1.jsx)("button", { onClick: submit, disabled: busy, className: "rounded-lg bg-white/10 px-3 py-1.5 text-sm hover:bg-white/20 disabled:opacity-50", children: "Submit" })] })] }) }));
}
