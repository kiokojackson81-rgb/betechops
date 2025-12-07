"use strict";
"use client";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = ReceiptsAdminClient;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = __importStar(require("react"));
function ReceiptsAdminClient({ initial, allowEdit = true }) {
    const [rows, setRows] = (0, react_1.useState)(initial || []);
    const [expanded, setExpanded] = (0, react_1.useState)({});
    const [editing, setEditing] = (0, react_1.useState)(null);
    const [start, setStart] = (0, react_1.useState)(() => new Date().toISOString().split("T")[0]);
    const [end, setEnd] = (0, react_1.useState)(() => new Date().toISOString().split("T")[0]);
    const [search, setSearch] = (0, react_1.useState)("");
    const [docType, setDocType] = (0, react_1.useState)("");
    const [loading, setLoading] = (0, react_1.useState)(false);
    const toggle = (id) => setExpanded((s) => ({ ...s, [id]: !s[id] }));
    const openEdit = async (id) => {
        if (!allowEdit)
            return;
        try {
            const res = await fetch(`/api/receipts/${id}`);
            const json = await res.json();
            const receipt = json?.receipt ?? null;
            if (receipt) {
                const orderItems = (receipt.order?.items || []).map((it) => ({
                    id: it.id,
                    title: it.title || it.productName || "",
                    quantity: it.quantity,
                    unitPrice: Number(it.sellingPrice || it.unitPrice || 0),
                    serial: it.serial || "",
                    warranty: it.warranty || "",
                }));
                setEditing({
                    id,
                    notes: receipt.notes || "",
                    taxRate: Number(receipt.taxRate || 0),
                    showTax: Boolean(receipt.showTax),
                    discount: Number(receipt.discount || 0),
                    showDiscount: Boolean(receipt.showDiscount),
                    paymentDetailsShown: Boolean(receipt.paymentDetailsShown),
                    warrantyText: receipt.warrantyText || "",
                    customerName: receipt.order?.customerName || "",
                    customerPhone: receipt.order?.customerPhone || "",
                    customerEmail: receipt.order?.customerEmail || "",
                    attendantId: receipt.order?.attendantId || "",
                    items: orderItems,
                });
            }
        }
        catch (e) {
            console.error(e);
        }
    };
    const closeEdit = () => setEditing(null);
    const saveEdit = async () => {
        if (!editing)
            return;
        try {
            const payload = {
                notes: editing.notes,
                taxRate: editing.taxRate,
                showTax: editing.showTax,
                discount: editing.discount,
                showDiscount: editing.showDiscount,
                paymentDetailsShown: editing.paymentDetailsShown,
                warrantyText: editing.warrantyText,
                customerName: editing.customerName,
                customerPhone: editing.customerPhone,
                customerEmail: editing.customerEmail,
                attendantId: editing.attendantId,
                items: editing.items,
            };
            const res = await fetch(`/api/receipts/${editing.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
            const json = await res.json();
            if (json?.ok) {
                await fetchList();
                closeEdit();
            }
            else {
                alert(json?.error || "Failed to save");
            }
        }
        catch (e) {
            alert("Failed to save");
        }
    };
    const fetchList = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            if (start)
                params.append("start", start);
            if (end)
                params.append("end", end);
            if (search)
                params.append("q", search);
            if (docType)
                params.append("docType", docType);
            params.append("includeItems", "true");
            const res = await fetch(`/api/receipts/list?${params.toString()}`);
            const json = await res.json();
            setRows(json.receipts || []);
        }
        catch (e) {
            console.error("Failed to fetch receipts list", e);
        }
        finally {
            setLoading(false);
        }
    };
    return ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "grid gap-2 rounded border border-slate-200 p-3 md:grid-cols-5", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "text-xs", children: "From" }), (0, jsx_runtime_1.jsx)("input", { type: "date", value: start, onChange: (e) => setStart(e.target.value), className: "w-full rounded border p-1" })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "text-xs", children: "To" }), (0, jsx_runtime_1.jsx)("input", { type: "date", value: end, onChange: (e) => setEnd(e.target.value), className: "w-full rounded border p-1" })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "text-xs", children: "Search (name / phone / ref)" }), (0, jsx_runtime_1.jsx)("input", { value: search, onChange: (e) => setSearch(e.target.value), className: "w-full rounded border p-1", placeholder: "Name, phone, ref" })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "text-xs", children: "Doc Type" }), (0, jsx_runtime_1.jsxs)("select", { value: docType, onChange: (e) => setDocType(e.target.value), className: "w-full rounded border p-1", children: [(0, jsx_runtime_1.jsx)("option", { value: "", children: "All" }), (0, jsx_runtime_1.jsx)("option", { value: "RECEIPT", children: "Receipt" }), (0, jsx_runtime_1.jsx)("option", { value: "INVOICE", children: "Invoice" }), (0, jsx_runtime_1.jsx)("option", { value: "QUOTATION", children: "Quotation" }), (0, jsx_runtime_1.jsx)("option", { value: "LAYAWAY", children: "Layaway" })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-end gap-2", children: [(0, jsx_runtime_1.jsx)("button", { className: "rounded border px-3 py-1", onClick: fetchList, children: loading ? "Loading..." : "Search" }), (0, jsx_runtime_1.jsx)("button", { className: "rounded border px-3 py-1", onClick: () => {
                                    const today = new Date().toISOString().split("T")[0];
                                    setStart(today);
                                    setEnd(today);
                                    setSearch("");
                                    setDocType("");
                                    fetchList();
                                }, children: "Reset" })] })] }), (0, jsx_runtime_1.jsxs)("table", { className: "w-full table-auto border-collapse text-sm", children: [(0, jsx_runtime_1.jsx)("thead", { children: (0, jsx_runtime_1.jsxs)("tr", { className: "text-left", children: [(0, jsx_runtime_1.jsx)("th", { children: "No." }), (0, jsx_runtime_1.jsx)("th", { children: "Date" }), (0, jsx_runtime_1.jsx)("th", { children: "Doc Type" }), (0, jsx_runtime_1.jsx)("th", { children: "Customer" }), (0, jsx_runtime_1.jsx)("th", { children: "Attendant" }), (0, jsx_runtime_1.jsx)("th", { children: "Total" }), (0, jsx_runtime_1.jsx)("th", { children: "Status" }), (0, jsx_runtime_1.jsx)("th", { children: "Actions" })] }) }), (0, jsx_runtime_1.jsx)("tbody", { children: rows.map((r, idx) => ((0, jsx_runtime_1.jsxs)(react_1.default.Fragment, { children: [(0, jsx_runtime_1.jsxs)("tr", { className: "border-t", children: [(0, jsx_runtime_1.jsx)("td", { children: idx + 1 }), (0, jsx_runtime_1.jsx)("td", { children: new Date(r.createdAt).toLocaleString() }), (0, jsx_runtime_1.jsx)("td", { children: r.docType }), (0, jsx_runtime_1.jsx)("td", { children: r.customerName }), (0, jsx_runtime_1.jsx)("td", { children: r.attendantName }), (0, jsx_runtime_1.jsx)("td", { children: r.total }), (0, jsx_runtime_1.jsx)("td", { children: r.status }), (0, jsx_runtime_1.jsxs)("td", { className: "space-x-2", children: [(0, jsx_runtime_1.jsx)("button", { onClick: () => toggle(r.id), className: "text-blue-600", children: expanded[r.id] ? "Hide" : "Expand" }), allowEdit && (0, jsx_runtime_1.jsx)("button", { onClick: () => openEdit(r.id), className: "text-emerald-700", children: "Edit" })] })] }), expanded[r.id] && ((0, jsx_runtime_1.jsx)("tr", { children: (0, jsx_runtime_1.jsx)("td", { colSpan: 8, children: (0, jsx_runtime_1.jsxs)("div", { className: "rounded border border-slate-200 bg-slate-50 p-3", children: [(0, jsx_runtime_1.jsxs)("p", { className: "text-xs text-slate-500 mb-2", children: ["Items for ", r.orderRef] }), (0, jsx_runtime_1.jsxs)("table", { className: "w-full text-xs", children: [(0, jsx_runtime_1.jsx)("thead", { children: (0, jsx_runtime_1.jsxs)("tr", { children: [(0, jsx_runtime_1.jsx)("th", { children: "Title" }), (0, jsx_runtime_1.jsx)("th", { children: "Qty" }), (0, jsx_runtime_1.jsx)("th", { children: "Unit" }), (0, jsx_runtime_1.jsx)("th", { children: "Serial" }), (0, jsx_runtime_1.jsx)("th", { children: "Warranty" })] }) }), (0, jsx_runtime_1.jsx)("tbody", { children: (r.items || []).map((it, i) => ((0, jsx_runtime_1.jsxs)("tr", { children: [(0, jsx_runtime_1.jsx)("td", { children: it.title || it.productName }), (0, jsx_runtime_1.jsx)("td", { children: it.quantity }), (0, jsx_runtime_1.jsx)("td", { children: it.unitPrice || it.sellingPrice }), (0, jsx_runtime_1.jsx)("td", { children: it.serial }), (0, jsx_runtime_1.jsx)("td", { children: it.warranty })] }, i))) })] })] }) }) }))] }, r.id))) })] }), editing && ((0, jsx_runtime_1.jsx)("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/50", children: (0, jsx_runtime_1.jsxs)("div", { className: "max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded bg-white p-4", children: [(0, jsx_runtime_1.jsxs)("h2", { className: "text-lg font-semibold", children: ["Edit Receipt ", editing.id] }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-2 grid gap-3 md:grid-cols-2", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "text-xs", children: "Customer name" }), (0, jsx_runtime_1.jsx)("input", { value: editing.customerName || "", onChange: (e) => setEditing((s) => s ? { ...s, customerName: e.target.value } : s), className: "w-full rounded border p-1" })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "text-xs", children: "Customer phone" }), (0, jsx_runtime_1.jsx)("input", { value: editing.customerPhone || "", onChange: (e) => setEditing((s) => s ? { ...s, customerPhone: e.target.value } : s), className: "w-full rounded border p-1" })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "text-xs", children: "Customer email" }), (0, jsx_runtime_1.jsx)("input", { value: editing.customerEmail || "", onChange: (e) => setEditing((s) => s ? { ...s, customerEmail: e.target.value } : s), className: "w-full rounded border p-1" })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "text-xs", children: "Notes" }), (0, jsx_runtime_1.jsx)("textarea", { value: editing.notes || "", onChange: (e) => setEditing((s) => s ? { ...s, notes: e.target.value } : s), className: "w-full rounded border p-1" })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-3 grid gap-2 md:grid-cols-3", children: [(0, jsx_runtime_1.jsxs)("label", { className: "text-xs flex flex-col gap-1", children: ["Tax %", (0, jsx_runtime_1.jsx)("input", { type: "number", value: editing.taxRate ?? 0, onChange: (e) => setEditing((s) => s ? { ...s, taxRate: Number(e.target.value || 0) } : s), className: "rounded border p-1" })] }), (0, jsx_runtime_1.jsxs)("label", { className: "text-xs flex items-center gap-2", children: [(0, jsx_runtime_1.jsx)("input", { type: "checkbox", checked: Boolean(editing.showTax), onChange: (e) => setEditing((s) => s ? { ...s, showTax: e.target.checked } : s) }), " Show tax"] }), (0, jsx_runtime_1.jsxs)("label", { className: "text-xs flex flex-col gap-1", children: ["Discount (KES)", (0, jsx_runtime_1.jsx)("input", { type: "number", value: editing.discount ?? 0, onChange: (e) => setEditing((s) => s ? { ...s, discount: Number(e.target.value || 0) } : s), className: "rounded border p-1" })] }), (0, jsx_runtime_1.jsxs)("label", { className: "text-xs flex items-center gap-2", children: [(0, jsx_runtime_1.jsx)("input", { type: "checkbox", checked: Boolean(editing.showDiscount), onChange: (e) => setEditing((s) => s ? { ...s, showDiscount: e.target.checked } : s) }), " Show discount"] }), (0, jsx_runtime_1.jsxs)("label", { className: "text-xs flex items-center gap-2", children: [(0, jsx_runtime_1.jsx)("input", { type: "checkbox", checked: Boolean(editing.paymentDetailsShown), onChange: (e) => setEditing((s) => s ? { ...s, paymentDetailsShown: e.target.checked } : s) }), " Include payment details"] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-3", children: [(0, jsx_runtime_1.jsx)("label", { className: "text-xs", children: "Warranty text" }), (0, jsx_runtime_1.jsx)("input", { value: editing.warrantyText || "", onChange: (e) => setEditing((s) => s ? { ...s, warrantyText: e.target.value } : s), className: "w-full rounded border p-1" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-3", children: [(0, jsx_runtime_1.jsx)("h3", { className: "font-semibold", children: "Items" }), (editing.items || []).map((it, idx) => ((0, jsx_runtime_1.jsxs)("div", { className: "mt-2 grid grid-cols-6 items-center gap-2", children: [(0, jsx_runtime_1.jsx)("input", { value: it.title, onChange: (e) => setEditing((s) => {
                                                if (!s)
                                                    return s;
                                                const copy = { ...s };
                                                copy.items[idx].title = e.target.value;
                                                return copy;
                                            }), className: "col-span-2 rounded border p-1", placeholder: "Title" }), (0, jsx_runtime_1.jsx)("input", { type: "number", value: it.quantity, onChange: (e) => setEditing((s) => {
                                                if (!s)
                                                    return s;
                                                const copy = { ...s };
                                                copy.items[idx].quantity = Number(e.target.value);
                                                return copy;
                                            }), className: "rounded border p-1" }), (0, jsx_runtime_1.jsx)("input", { type: "number", value: it.unitPrice, onChange: (e) => setEditing((s) => {
                                                if (!s)
                                                    return s;
                                                const copy = { ...s };
                                                copy.items[idx].unitPrice = Number(e.target.value);
                                                return copy;
                                            }), className: "rounded border p-1" }), (0, jsx_runtime_1.jsx)("input", { value: it.serial || "", onChange: (e) => setEditing((s) => {
                                                if (!s)
                                                    return s;
                                                const copy = { ...s };
                                                copy.items[idx].serial = e.target.value;
                                                return copy;
                                            }), className: "rounded border p-1", placeholder: "Serial" }), (0, jsx_runtime_1.jsx)("input", { value: it.warranty || "", onChange: (e) => setEditing((s) => {
                                                if (!s)
                                                    return s;
                                                const copy = { ...s };
                                                copy.items[idx].warranty = e.target.value;
                                                return copy;
                                            }), className: "rounded border p-1", placeholder: "Warranty" }), (0, jsx_runtime_1.jsx)("button", { className: "text-red-600", onClick: () => setEditing((s) => {
                                                if (!s)
                                                    return s;
                                                const copy = { ...s };
                                                copy.items = copy.items.filter((_, i) => i !== idx);
                                                return copy;
                                            }), children: "Remove" })] }, it.id || idx))), (0, jsx_runtime_1.jsx)("div", { className: "mt-2", children: (0, jsx_runtime_1.jsx)("button", { className: "rounded border px-2 py-1", onClick: () => setEditing((s) => s ? { ...s, items: [...s.items, { id: null, title: "", quantity: 1, unitPrice: 0, serial: "", warranty: "" }] } : s), children: "Add Item" }) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-4 flex justify-end gap-2", children: [(0, jsx_runtime_1.jsx)("button", { onClick: closeEdit, className: "rounded border px-3 py-1", children: "Cancel" }), (0, jsx_runtime_1.jsx)("button", { onClick: saveEdit, className: "rounded bg-blue-600 px-3 py-1 text-white", children: "Save" })] })] }) }))] }));
}
