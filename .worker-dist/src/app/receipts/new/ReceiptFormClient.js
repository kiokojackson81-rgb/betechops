"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = ReceiptFormClient;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const Input_1 = __importDefault(require("@/app/_components/Input"));
const Button_1 = __importDefault(require("@/app/_components/Button"));
const toast_1 = require("@/lib/ui/toast");
const warrantyOptions = ["1 Year", "2 Years", "3 Years", "5 Years", "6 Years", "10 Years"];
const newItem = () => ({
    id: Math.random().toString(36).slice(2),
    title: "",
    quantity: 1,
    unitPrice: "",
    serial: "",
    warranty: warrantyOptions[0],
});
function ReceiptFormClient() {
    const [attendants, setAttendants] = (0, react_1.useState)([]);
    const [attendantId, setAttendantId] = (0, react_1.useState)(null);
    const [docType, setDocType] = (0, react_1.useState)("RECEIPT");
    const [serial, setSerial] = (0, react_1.useState)("");
    const [customerName, setCustomerName] = (0, react_1.useState)("");
    const [customerPhone, setCustomerPhone] = (0, react_1.useState)("");
    const [customerEmail, setCustomerEmail] = (0, react_1.useState)("");
    const [items, setItems] = (0, react_1.useState)([newItem()]);
    const [taxRate, setTaxRate] = (0, react_1.useState)(16);
    const [showTax, setShowTax] = (0, react_1.useState)(true);
    const [discount, setDiscount] = (0, react_1.useState)(0);
    const [showDiscount, setShowDiscount] = (0, react_1.useState)(false);
    const [paymentDetailsShown, setPaymentDetailsShown] = (0, react_1.useState)(false);
    const [notes, setNotes] = (0, react_1.useState)("");
    const [warrantyText, setWarrantyText] = (0, react_1.useState)("");
    const [deposit, setDeposit] = (0, react_1.useState)(0);
    const [showSerials, setShowSerials] = (0, react_1.useState)(true);
    const [showWarranty, setShowWarranty] = (0, react_1.useState)(true);
    const [sendEmail, setSendEmail] = (0, react_1.useState)(false);
    const [sendWhatsapp, setSendWhatsapp] = (0, react_1.useState)(false);
    const [saving, setSaving] = (0, react_1.useState)(false);
    (0, react_1.useEffect)(() => {
        (async () => {
            try {
                const res = await fetch("/api/users?role=ATTENDANT");
                const json = await res.json();
                if (Array.isArray(json?.users))
                    setAttendants(json.users.map((u) => ({ id: u.id, name: u.name || u.email })));
            }
            catch (e) {
                // ignore
            }
        })();
    }, []);
    const addRow = () => setItems((s) => [...s, newItem()]);
    const removeRow = (id) => setItems((s) => (s.length > 1 ? s.filter((r) => r.id !== id) : s));
    const updateRow = (id, patch) => setItems((s) => s.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    const subtotal = (0, react_1.useMemo)(() => items.reduce((acc, it) => acc + (Number(it.unitPrice || 0) * Number(it.quantity || 1)), 0), [items]);
    const taxAmount = showTax ? subtotal * (taxRate / 100) : 0;
    const total = subtotal + taxAmount - discount;
    const balance = docType === "LAYAWAY" ? Math.max(0, total - deposit) : 0;
    const handleSave = async () => {
        if (!attendantId)
            return (0, toast_1.showToast)("Select attendant", "error");
        if (!items.length)
            return (0, toast_1.showToast)("Add at least one item", "error");
        setSaving(true);
        try {
            const payload = {
                docType: docType.toLowerCase(),
                serial,
                date: new Date().toISOString(),
                customerName,
                customerPhone,
                customerEmail,
                attendantId,
                issuedById: attendantId,
                taxRate,
                showTax,
                discount,
                showDiscount,
                paymentDetailsShown,
                notes,
                warrantyText,
                deposit: docType === "LAYAWAY" ? deposit : undefined,
                items: items.map((it) => ({
                    title: it.title,
                    quantity: it.quantity,
                    unitPrice: Number(it.unitPrice || 0),
                    serial: showSerials ? it.serial || null : null,
                    warranty: showWarranty ? it.warranty || null : null,
                })),
                sendChannels: {
                    email: sendEmail,
                    whatsapp: sendWhatsapp,
                },
            };
            const res = await fetch("/api/receipts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), credentials: "same-origin" });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                return (0, toast_1.showToast)(data?.error || "Failed to save receipt", "error");
            }
            (0, toast_1.showToast)("Saved receipt", "success");
            setTimeout(() => window.print(), 300);
        }
        catch (err) {
            (0, toast_1.showToast)(err instanceof Error ? err.message : "Failed to save", "error");
        }
        finally {
            setSaving(false);
        }
    };
    return ((0, jsx_runtime_1.jsxs)("div", { className: "mx-auto max-w-5xl p-4 space-y-6", children: [(0, jsx_runtime_1.jsxs)("header", { className: "space-y-2", children: [(0, jsx_runtime_1.jsx)("h1", { className: "text-2xl font-semibold", children: "Create receipt / invoice / quotation / layaway" }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-500", children: "Saves to the unified receipts table and is ready for printing or sending." })] }), (0, jsx_runtime_1.jsxs)("div", { className: "grid grid-cols-1 gap-4 md:grid-cols-2", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "text-sm", children: "Attendant" }), (0, jsx_runtime_1.jsxs)("select", { value: attendantId ?? "", onChange: (e) => setAttendantId(e.target.value || null), className: "w-full rounded border px-3 py-2", children: [(0, jsx_runtime_1.jsx)("option", { value: "", children: "Select attendant" }), attendants.map((a) => (0, jsx_runtime_1.jsx)("option", { value: a.id, children: a.name }, a.id))] })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "text-sm", children: "Document Type" }), (0, jsx_runtime_1.jsxs)("select", { value: docType, onChange: (e) => setDocType(e.target.value), className: "w-full rounded border px-3 py-2", children: [(0, jsx_runtime_1.jsx)("option", { children: "RECEIPT" }), (0, jsx_runtime_1.jsx)("option", { children: "INVOICE" }), (0, jsx_runtime_1.jsx)("option", { children: "QUOTATION" }), (0, jsx_runtime_1.jsx)("option", { children: "LAYAWAY" })] })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "grid gap-4 md:grid-cols-3", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "text-sm", children: "Serial / Receipt No." }), (0, jsx_runtime_1.jsx)(Input_1.default, { value: serial, onChange: (e) => setSerial(e.target.value), placeholder: "Serial" })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "text-sm", children: "Customer Name" }), (0, jsx_runtime_1.jsx)(Input_1.default, { value: customerName, onChange: (e) => setCustomerName(e.target.value), placeholder: "Customer name" })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "text-sm", children: "Customer Phone" }), (0, jsx_runtime_1.jsx)(Input_1.default, { value: customerPhone, onChange: (e) => setCustomerPhone(e.target.value), placeholder: "07..." })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "grid gap-4 md:grid-cols-2", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "text-sm", children: "Customer Email (for sending)" }), (0, jsx_runtime_1.jsx)(Input_1.default, { value: customerEmail, onChange: (e) => setCustomerEmail(e.target.value), placeholder: "email@example.com" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-end gap-3", children: [(0, jsx_runtime_1.jsxs)("label", { className: "inline-flex items-center gap-2 text-sm", children: [(0, jsx_runtime_1.jsx)("input", { type: "checkbox", checked: sendEmail, onChange: (e) => setSendEmail(e.target.checked) }), "Send via e-mail"] }), (0, jsx_runtime_1.jsxs)("label", { className: "inline-flex items-center gap-2 text-sm", children: [(0, jsx_runtime_1.jsx)("input", { type: "checkbox", checked: sendWhatsapp, onChange: (e) => setSendWhatsapp(e.target.checked) }), "Send via WhatsApp"] })] })] }), (0, jsx_runtime_1.jsxs)("section", { className: "space-y-3 rounded-xl border border-slate-200 p-3", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap items-center gap-4", children: [(0, jsx_runtime_1.jsxs)("label", { className: "inline-flex items-center gap-2 text-sm", children: [(0, jsx_runtime_1.jsx)("input", { type: "checkbox", checked: showSerials, onChange: (e) => setShowSerials(e.target.checked) }), "Capture serial / IMEI per item"] }), (0, jsx_runtime_1.jsxs)("label", { className: "inline-flex items-center gap-2 text-sm", children: [(0, jsx_runtime_1.jsx)("input", { type: "checkbox", checked: showWarranty, onChange: (e) => setShowWarranty(e.target.checked) }), "Capture warranty per item"] })] }), (0, jsx_runtime_1.jsx)("div", { className: "space-y-2", children: items.map((it) => ((0, jsx_runtime_1.jsxs)("div", { className: "grid gap-2 md:grid-cols-6 items-center border-b pb-2", children: [(0, jsx_runtime_1.jsx)("input", { className: "col-span-2 rounded border px-2 py-1", value: it.title, onChange: (e) => updateRow(it.id, { title: e.target.value }), placeholder: "Item description" }), (0, jsx_runtime_1.jsx)("input", { type: "number", min: 1, className: "rounded border px-2 py-1", value: it.quantity, onChange: (e) => updateRow(it.id, { quantity: Math.max(1, Number(e.target.value || 1)) }) }), (0, jsx_runtime_1.jsx)("input", { type: "number", min: 0, className: "rounded border px-2 py-1", value: it.unitPrice, onChange: (e) => updateRow(it.id, { unitPrice: e.target.value === "" ? "" : Number(e.target.value) }), placeholder: "Unit price" }), showSerials ? ((0, jsx_runtime_1.jsx)("input", { className: "rounded border px-2 py-1", value: it.serial, onChange: (e) => updateRow(it.id, { serial: e.target.value }), placeholder: "Serial / IMEI" })) : ((0, jsx_runtime_1.jsx)("div", {})), showWarranty ? ((0, jsx_runtime_1.jsx)("select", { className: "rounded border px-2 py-1", value: it.warranty, onChange: (e) => updateRow(it.id, { warranty: e.target.value }), children: warrantyOptions.map((w) => (0, jsx_runtime_1.jsx)("option", { value: w, children: w }, w)) })) : ((0, jsx_runtime_1.jsx)("div", {})), (0, jsx_runtime_1.jsx)("div", { className: "flex gap-2", children: (0, jsx_runtime_1.jsx)(Button_1.default, { variant: "secondary", onClick: () => removeRow(it.id), children: "Remove" }) })] }, it.id))) }), (0, jsx_runtime_1.jsx)("div", { className: "mt-2", children: (0, jsx_runtime_1.jsx)(Button_1.default, { onClick: addRow, children: "+ Add item" }) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "grid gap-4 md:grid-cols-3", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "text-sm", children: "Tax %" }), (0, jsx_runtime_1.jsx)(Input_1.default, { type: "number", value: taxRate, onChange: (e) => setTaxRate(Number(e.target.value || 0)) }), (0, jsx_runtime_1.jsxs)("label", { className: "inline-flex items-center mt-1 text-sm", children: [(0, jsx_runtime_1.jsx)("input", { type: "checkbox", checked: showTax, onChange: (e) => setShowTax(e.target.checked), className: "mr-2" }), " Show Tax"] })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "text-sm", children: "Discount (KES)" }), (0, jsx_runtime_1.jsx)(Input_1.default, { type: "number", value: discount, onChange: (e) => setDiscount(Number(e.target.value || 0)) }), (0, jsx_runtime_1.jsxs)("label", { className: "inline-flex items-center mt-1 text-sm", children: [(0, jsx_runtime_1.jsx)("input", { type: "checkbox", checked: showDiscount, onChange: (e) => setShowDiscount(e.target.checked), className: "mr-2" }), " Show Discount"] })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "text-sm", children: "Payment details" }), (0, jsx_runtime_1.jsx)("div", { className: "mt-1", children: (0, jsx_runtime_1.jsxs)("label", { className: "inline-flex items-center text-sm", children: [(0, jsx_runtime_1.jsx)("input", { type: "checkbox", checked: paymentDetailsShown, onChange: (e) => setPaymentDetailsShown(e.target.checked), className: "mr-2" }), " Include payment details on receipt"] }) }), docType === "LAYAWAY" && ((0, jsx_runtime_1.jsxs)("div", { className: "mt-3 space-y-1", children: [(0, jsx_runtime_1.jsx)("label", { className: "text-sm", children: "Deposit (KES)" }), (0, jsx_runtime_1.jsx)(Input_1.default, { type: "number", value: deposit, onChange: (e) => setDeposit(Number(e.target.value || 0)) }), (0, jsx_runtime_1.jsx)("p", { className: "text-xs text-slate-500", children: "Balance auto-computed from total." })] }))] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "grid gap-4 md:grid-cols-2", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "text-sm", children: "Warranty note" }), (0, jsx_runtime_1.jsx)(Input_1.default, { value: warrantyText, onChange: (e) => setWarrantyText(e.target.value), placeholder: "Global warranty text (optional)" })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "text-sm", children: "General notes / terms" }), (0, jsx_runtime_1.jsx)("textarea", { value: notes, onChange: (e) => setNotes(e.target.value), className: "w-full rounded border p-2 h-full min-h-[60px]" })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm", children: [(0, jsx_runtime_1.jsxs)("div", { className: "space-y-1 text-sm", children: [(0, jsx_runtime_1.jsxs)("div", { children: ["Subtotal: KES ", subtotal.toLocaleString()] }), (0, jsx_runtime_1.jsxs)("div", { children: ["Tax: KES ", taxAmount.toLocaleString()] }), (0, jsx_runtime_1.jsxs)("div", { children: ["Discount: KES ", discount.toLocaleString()] }), (0, jsx_runtime_1.jsxs)("div", { className: "text-lg font-semibold", children: ["Total: KES ", total.toLocaleString()] }), docType === "LAYAWAY" && (0, jsx_runtime_1.jsxs)("div", { className: "text-amber-700", children: ["Balance after deposit: KES ", balance.toLocaleString()] }), (0, jsx_runtime_1.jsxs)("p", { className: "text-xs text-slate-500", children: ["Thank you for shopping with Betech Solar Solutions. You were served by ", attendants.find((a) => a.id === attendantId)?.name || "____", ". Follow us on all social media platforms: @Betech Solar Solutions Kenya."] }), (0, jsx_runtime_1.jsx)("p", { className: "text-xs text-slate-500", children: "Official Stamp: __________________________" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex gap-2", children: [(0, jsx_runtime_1.jsx)(Button_1.default, { variant: "secondary", onClick: () => { navigator.clipboard?.writeText(JSON.stringify({ items, subtotal, taxAmount, total })); (0, toast_1.showToast)("Copied snapshot", "info"); }, children: "Copy snapshot" }), (0, jsx_runtime_1.jsx)(Button_1.default, { onClick: handleSave, disabled: saving, children: saving ? "Saving..." : "Save to System & Print" })] })] })] }));
}
