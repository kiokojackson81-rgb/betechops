"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = EditDayClient;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const toast_1 = require("@/lib/ui/toast");
function EditDayClient({ initialData }) {
    const [receipts, setReceipts] = (0, react_1.useState)(initialData.receipts || []);
    const [saving, setSaving] = (0, react_1.useState)(false);
    const [message, setMessage] = (0, react_1.useState)(null);
    const updateReceipt = (index, patch) => {
        setReceipts((r) => r.map((row, i) => (i === index ? { ...row, ...patch } : row)));
    };
    const addReceipt = () => {
        setReceipts((r) => [...r, { receiptNumber: "", sellingTotal: 0, paymentMethod: "MPESA", items: [{ productName: "", buyingPrice: 0 }] }]);
    };
    const removeReceipt = async (index) => {
        const ok = await (0, toast_1.confirmDialog)("Remove this receipt? This will delete its items too.");
        if (!ok)
            return;
        setReceipts((r) => r.filter((_, i) => i !== index));
        (0, toast_1.showToast)("Receipt removed", "info");
    };
    const updateItem = (rIndex, iIndex, patch) => {
        setReceipts((rows) => rows.map((r, ri) => (ri === rIndex ? { ...r, items: r.items.map((it, ii) => (ii === iIndex ? { ...it, ...patch } : it)) } : r)));
    };
    const addItem = (rIndex) => {
        setReceipts((rows) => rows.map((r, i) => (i === rIndex ? { ...r, items: [...r.items, { productName: "", buyingPrice: 0 }] } : r)));
    };
    const save = async () => {
        setSaving(true);
        setMessage(null);
        try {
            const res = await fetch("/api/admin/marketing-report/update-entry", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "same-origin",
                body: JSON.stringify({ entryId: initialData.id, receipts }),
            });
            const data = await res.json();
            if (!res.ok)
                throw new Error(data?.error || "Failed to save");
            // If API returns the updated entry, refresh local state
            if (data?.entry && Array.isArray(data.entry.receipts)) {
                setReceipts(data.entry.receipts.map((r) => ({
                    id: r.id,
                    receiptNumber: r.receiptNumber ?? "",
                    sellingTotal: Number(r.sellingTotal) || 0,
                    paymentMethod: r.paymentMethod,
                    items: (r.items || []).map((it) => ({
                        id: it.id,
                        productName: it.productName || "",
                        buyingPrice: Number(it.buyingPrice) || 0,
                    })),
                })));
            }
            setMessage("Saved successfully");
        }
        catch (err) {
            setMessage(err instanceof Error ? err.message : "Save failed");
        }
        finally {
            setSaving(false);
        }
    };
    const wipeAll = async () => {
        const ok = await (0, toast_1.confirmDialog)("This will delete all receipts and items for this day. Are you sure?");
        if (!ok)
            return;
        setSaving(true);
        setMessage(null);
        try {
            const res = await fetch("/api/admin/marketing-report/update-entry", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "same-origin",
                body: JSON.stringify({ entryId: initialData.id, action: "wipe" }),
            });
            const data = await res.json();
            if (!res.ok)
                throw new Error(data?.error || "Failed to wipe");
            // Prefer server-canonical entry if returned
            if (data?.entry && Array.isArray(data.entry.receipts)) {
                setReceipts(data.entry.receipts.map((r) => ({
                    id: r.id,
                    receiptNumber: r.receiptNumber ?? "",
                    sellingTotal: Number(r.sellingTotal) || 0,
                    paymentMethod: r.paymentMethod,
                    items: (r.items || []).map((it) => ({
                        id: it.id,
                        productName: it.productName || "",
                        buyingPrice: Number(it.buyingPrice) || 0,
                    })),
                })));
            }
            else {
                setReceipts([]);
            }
            setMessage("Wiped receipts for the day.");
            (0, toast_1.showToast)("Wiped receipts for the day.", "success");
        }
        catch (err) {
            const message = err instanceof Error ? err.message : "Wipe failed";
            setMessage(message);
            (0, toast_1.showToast)(message, "error");
        }
        finally {
            setSaving(false);
        }
    };
    return ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-4", children: [receipts.map((r, ri) => ((0, jsx_runtime_1.jsxs)("div", { className: "rounded border border-slate-800 bg-slate-950/40 p-3", children: [(0, jsx_runtime_1.jsxs)("div", { className: "grid gap-2 md:grid-cols-3", children: [(0, jsx_runtime_1.jsx)("input", { value: r.receiptNumber ?? "", onChange: (e) => updateReceipt(ri, { receiptNumber: e.target.value }), placeholder: "Receipt number", className: "px-2 py-1 bg-slate-900 border border-slate-800 rounded" }), (0, jsx_runtime_1.jsx)("input", { type: "number", value: r.sellingTotal, onChange: (e) => updateReceipt(ri, { sellingTotal: Number(e.target.value) || 0 }), className: "px-2 py-1 bg-slate-900 border border-slate-800 rounded" }), (0, jsx_runtime_1.jsxs)("select", { value: r.paymentMethod, onChange: (e) => updateReceipt(ri, { paymentMethod: e.target.value }), className: "px-2 py-1 bg-slate-900 border border-slate-800 rounded", children: [(0, jsx_runtime_1.jsx)("option", { value: "MPESA", children: "MPESA" }), (0, jsx_runtime_1.jsx)("option", { value: "CASH", children: "CASH" })] })] }), (0, jsx_runtime_1.jsx)("div", { className: "mt-2 flex justify-end", children: (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => removeReceipt(ri), className: "text-sm text-red-400", children: "Remove receipt" }) }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-2 space-y-2", children: [r.items.map((it, ii) => ((0, jsx_runtime_1.jsxs)("div", { className: "flex gap-2", children: [(0, jsx_runtime_1.jsx)("input", { value: it.productName, onChange: (e) => updateItem(ri, ii, { productName: e.target.value }), placeholder: "Product", className: "flex-1 px-2 py-1 bg-slate-900 border border-slate-800 rounded" }), (0, jsx_runtime_1.jsx)("input", { type: "number", value: it.buyingPrice, onChange: (e) => updateItem(ri, ii, { buyingPrice: Number(e.target.value) || 0 }), className: "w-40 px-2 py-1 bg-slate-900 border border-slate-800 rounded" })] }, ii))), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => addItem(ri), className: "text-sm text-emerald-300", children: "+ Add item" })] })] }, ri))), (0, jsx_runtime_1.jsx)("div", { children: (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: addReceipt, className: "text-sm text-emerald-300", children: "+ Add receipt" }) }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-3", children: [(0, jsx_runtime_1.jsx)("button", { onClick: save, disabled: saving, className: "rounded px-4 py-2 bg-emerald-500 text-black", children: saving ? "Saving..." : "Save changes" }), (0, jsx_runtime_1.jsx)("button", { onClick: wipeAll, disabled: saving, className: "rounded px-4 py-2 bg-rose-600 text-white", children: saving ? "Working..." : "Wipe all receipts" }), message && (0, jsx_runtime_1.jsx)("div", { className: "text-sm", children: message })] })] }));
}
