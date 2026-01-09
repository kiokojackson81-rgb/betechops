"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = ReceiptPage;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = __importDefault(require("react"));
function ReceiptPage() {
    const [items, setItems] = react_1.default.useState([
        { id: 1, description: "", quantity: 1, unitPrice: 0 },
    ]);
    const [paymentMethod, setPaymentMethod] = react_1.default.useState("MPESA");
    const [notes, setNotes] = react_1.default.useState("");
    const [descLoadingId, setDescLoadingId] = react_1.default.useState(null);
    const [notesLoading, setNotesLoading] = react_1.default.useState(false);
    const updateItem = (id, patch) => {
        setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
    };
    const addItem = () => {
        setItems((prev) => [
            ...prev,
            {
                id: prev.length ? prev[prev.length - 1].id + 1 : 1,
                description: "",
                quantity: 1,
                unitPrice: 0,
            },
        ]);
    };
    const removeItem = (id) => {
        setItems((prev) => prev.filter((it) => it.id !== id));
    };
    const aiDescription = async (item) => {
        if (!item.description.trim())
            return;
        setDescLoadingId(item.id);
        try {
            const res = await fetch("/api/ai/receipt-description", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ rawDescription: item.description }),
            });
            if (!res.ok)
                return;
            const data = await res.json();
            if (data.description) {
                updateItem(item.id, { description: data.description });
            }
        }
        finally {
            setDescLoadingId(null);
        }
    };
    const aiNotes = async () => {
        if (!items.length)
            return;
        setNotesLoading(true);
        try {
            const res = await fetch("/api/ai/receipt-notes", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    items: items.map((it) => ({ description: it.description })),
                    paymentMethod,
                }),
            });
            if (!res.ok)
                return;
            const data = await res.json();
            if (data.notes)
                setNotes(data.notes);
        }
        finally {
            setNotesLoading(false);
        }
    };
    return ((0, jsx_runtime_1.jsxs)("div", { className: "p-6 space-y-6", children: [(0, jsx_runtime_1.jsxs)("div", { className: "rounded-2xl border border-slate-700 p-4 space-y-3", children: [items.map((item) => ((0, jsx_runtime_1.jsxs)("div", { className: "flex gap-2 items-start", children: [(0, jsx_runtime_1.jsx)("textarea", { className: "flex-1 rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm", placeholder: "Item description", value: item.description, onChange: (e) => updateItem(item.id, { description: e.target.value }) }), (0, jsx_runtime_1.jsx)("input", { type: "number", className: "w-16 rounded-lg bg-slate-900 border border-slate-700 px-2 py-2 text-sm", value: item.quantity, onChange: (e) => updateItem(item.id, { quantity: Number(e.target.value) }) }), (0, jsx_runtime_1.jsx)("input", { type: "number", className: "w-28 rounded-lg bg-slate-900 border border-slate-700 px-2 py-2 text-sm", value: item.unitPrice, onChange: (e) => updateItem(item.id, { unitPrice: Number(e.target.value) }) }), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => aiDescription(item), disabled: descLoadingId === item.id, className: "px-2 py-1 rounded-full border border-slate-600 text-xs", children: descLoadingId === item.id ? "…" : "✨ AI" }), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => removeItem(item.id), className: "text-xs text-red-400", children: "Remove" })] }, item.id))), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: addItem, className: "mt-2 rounded-full bg-emerald-500 px-4 py-2 text-sm font-medium", children: "+ Add item" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex gap-4 items-center", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-sm text-slate-300", children: "Payment method:" }), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => setPaymentMethod("MPESA"), className: `px-4 py-2 rounded-full text-sm ${paymentMethod === "MPESA" ? "bg-emerald-500 text-black" : "bg-slate-800"}`, children: "MPESA" }), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => setPaymentMethod("CASH"), className: `px-4 py-2 rounded-full text-sm ${paymentMethod === "CASH" ? "bg-emerald-500 text-black" : "bg-slate-800"}`, children: "Cash" })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex justify-between items-center mb-2", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-sm text-slate-300", children: "GENERAL NOTES / TERMS" }), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: aiNotes, disabled: notesLoading, className: "px-3 py-1 rounded-full border border-slate-600 text-xs", children: notesLoading ? "…" : "✨ Generate notes" })] }), (0, jsx_runtime_1.jsx)("textarea", { className: "w-full min-h-[120px] rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm", value: notes, onChange: (e) => setNotes(e.target.value), placeholder: "Any special notes or terms for this receipt\u2026" })] })] }));
}
