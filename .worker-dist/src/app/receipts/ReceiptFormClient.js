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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = ReceiptFormClient;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const MarkdownRendererClient_1 = __importStar(require("@/components/MarkdownRendererClient"));
const toast_1 = require("@/lib/ui/toast");
const serial_1 = require("@/lib/receipts/serial");
const ReceiptDuplicateModal_1 = __importDefault(require("./_components/ReceiptDuplicateModal"));
const warrantyOptions = ["1 Year", "2 Years", "3 Years", "5 Years", "6 Years", "10 Years"];
const newItem = () => ({
    id: Math.random().toString(36).slice(2),
    title: "",
    quantity: 1,
    unitPrice: "",
    serial: "",
    warranty: "",
});
const sanitizeNumericInput = (value) => {
    const cleaned = value.replace(/[^0-9.]/g, "");
    if (!cleaned || cleaned === ".")
        return "";
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : "";
};
function ReceiptFormClient({ onCreated, showHero = true }) {
    const [staffMembers, setStaffMembers] = (0, react_1.useState)([]);
    const [staffId, setStaffId] = (0, react_1.useState)(null);
    const [docType, setDocType] = (0, react_1.useState)("RECEIPT");
    const [serial, setSerial] = (0, react_1.useState)(() => (0, serial_1.generateReceiptSerial)());
    const [customerName, setCustomerName] = (0, react_1.useState)("");
    const [customerPhone, setCustomerPhone] = (0, react_1.useState)("");
    const [normalizingName, setNormalizingName] = (0, react_1.useState)(false);
    const [items, setItems] = (0, react_1.useState)([newItem()]);
    const [taxRate, setTaxRate] = (0, react_1.useState)(16);
    const [showTax, setShowTax] = (0, react_1.useState)(false);
    const [discount, setDiscount] = (0, react_1.useState)(0);
    const [showDiscount, setShowDiscount] = (0, react_1.useState)(false);
    const [selectedPaymentMethods, setSelectedPaymentMethods] = (0, react_1.useState)({ MPESA: true, CASH: false });
    const hasPaymentMethodSelection = selectedPaymentMethods.MPESA || selectedPaymentMethods.CASH;
    const primaryPaymentMethod = selectedPaymentMethods.MPESA ? "MPESA" : "CASH";
    const paymentDetailsShown = true;
    // Paper size is fixed to A5 by default; remove runtime selector
    const [notes, setNotes] = (0, react_1.useState)("");
    const [deliveryAddress, setDeliveryAddress] = (0, react_1.useState)(undefined);
    const [addressLoading, setAddressLoading] = (0, react_1.useState)(false);
    const [showAddressInput, setShowAddressInput] = (0, react_1.useState)(false);
    const [customerType, setCustomerType] = (0, react_1.useState)("");
    const [deliveryStatus, setDeliveryStatus] = (0, react_1.useState)("pending");
    const [deposit, setDeposit] = (0, react_1.useState)(0);
    const [showSerials, setShowSerials] = (0, react_1.useState)(false);
    const [showWarranty, setShowWarranty] = (0, react_1.useState)(false);
    const [globalWarranty, setGlobalWarranty] = (0, react_1.useState)("");
    const [saving, setSaving] = (0, react_1.useState)(false);
    const [duplicateOwner, setDuplicateOwner] = (0, react_1.useState)(null);
    const [notesLoading, setNotesLoading] = (0, react_1.useState)(false);
    const [descLoadingId, setDescLoadingId] = (0, react_1.useState)(null);
    const [cashPaid, setCashPaid] = (0, react_1.useState)(0);
    const [mpesaPaid, setMpesaPaid] = (0, react_1.useState)(0);
    (0, react_1.useEffect)(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch("/api/receipts/staff");
                const json = await res.json().catch(() => null);
                const rows = Array.isArray(json)
                    ? json
                    : Array.isArray(json?.users)
                        ? json.users
                        : [];
                if (cancelled)
                    return;
                const mapped = rows
                    .filter((u) => u && u.id)
                    .map((u) => ({ id: u.id, name: u.name || u.email || u.id, email: u.email ?? null }));
                setStaffMembers(mapped);
                if (mapped.length) {
                    setStaffId((prev) => {
                        if (prev)
                            return prev;
                        const preferredNames = ["jeniffer", "jennifer", "jenifer"];
                        const defaultStaff = mapped.find((item) => {
                            const haystack = `${item.name || ""} ${item.email || ""}`.toLowerCase();
                            return preferredNames.some((needle) => haystack.includes(needle));
                        });
                        return (defaultStaff ?? mapped[0]).id;
                    });
                }
            }
            catch (e) {
                // ignore
            }
        })();
        return () => { cancelled = true; };
    }, []);
    const addRow = () => setItems((s) => [...s, newItem()]);
    const removeRow = (id) => setItems((s) => (s.length > 1 ? s.filter((r) => r.id !== id) : s));
    const updateRow = (id, patch) => setItems((s) => s.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    const addDeliveryFeeRow = () => setItems((s) => [
        ...s,
        {
            ...newItem(),
            title: "Delivery fee",
            unitPrice: 0,
            isDeliveryFee: true,
        },
    ]);
    const aiDescription = async (row) => {
        if (!row.title.trim())
            return;
        setDescLoadingId(row.id);
        try {
            const response = await fetch("/api/ai/receipt-description", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ rawDescription: row.title }),
            });
            if (!response.ok)
                throw new Error("AI description failed");
            const data = await response.json().catch(() => null);
            if (data?.description) {
                updateRow(row.id, { title: data.description });
            }
        }
        catch (err) {
            (0, toast_1.showToast)(err instanceof Error ? err.message : "AI description failed", "error");
        }
        finally {
            setDescLoadingId(null);
        }
    };
    const normalizeName = async () => {
        if (!customerName || !customerName.trim())
            return (0, toast_1.showToast)('Enter a name to normalize', 'error');
        setNormalizingName(true);
        try {
            const res = await fetch('/api/ai/normalize-name', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: customerName }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err?.error || 'Name normalization failed');
            }
            const data = await res.json().catch(() => null);
            const normalized = data?.name || data?.normalizedName || data?.normalized || null;
            if (normalized) {
                setCustomerName(String(normalized));
                (0, toast_1.showToast)('Name normalized', 'success');
            }
            else {
                (0, toast_1.showToast)('Name normalization returned no value', 'error');
            }
        }
        catch (e) {
            (0, toast_1.showToast)(e instanceof Error ? e.message : 'Name normalization failed', 'error');
        }
        finally {
            setNormalizingName(false);
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
                    items: items.map((item) => ({ description: item.title })),
                    paymentMethod: primaryPaymentMethod,
                }),
            });
            if (!res.ok)
                throw new Error("AI notes failed");
            const data = await res.json().catch(() => null);
            if (data?.notes) {
                setNotes(data.notes);
            }
        }
        catch (err) {
            (0, toast_1.showToast)(err instanceof Error ? err.message : "AI notes failed", "error");
        }
        finally {
            setNotesLoading(false);
        }
    };
    const normalizedTaxRate = Number.isFinite(taxRate) ? taxRate : 0;
    const normalizedDiscount = Number.isFinite(discount) ? discount : 0;
    const toNumber = (value) => (typeof value === "number" ? value : 0);
    const subtotal = (0, react_1.useMemo)(() => items.reduce((acc, it) => acc + (Number(it.unitPrice || 0) * Number(it.quantity || 1)), 0), [items]);
    const taxAmount = showTax ? subtotal * (normalizedTaxRate / 100) : 0;
    const total = subtotal + taxAmount - normalizedDiscount;
    const balance = docType === "LAYAWAY" ? Math.max(0, total - deposit) : 0;
    const selectedStaff = staffMembers.find((a) => a.id === staffId);
    const effectiveShowDiscount = showDiscount || normalizedDiscount > 0;
    const showSplitPaymentInputs = selectedPaymentMethods.MPESA && selectedPaymentMethods.CASH;
    const numericCashPaid = toNumber(cashPaid);
    const numericMpesaPaid = toNumber(mpesaPaid);
    (0, react_1.useEffect)(() => {
        const cash = toNumber(cashPaid);
        const mpesa = toNumber(mpesaPaid);
        if (cash > total) {
            setCashPaid(total);
            setMpesaPaid(0);
            return;
        }
        if (Math.abs(cash + mpesa - total) > 0.1) {
            setMpesaPaid(Math.max(0, total - cash));
        }
    }, [total, cashPaid, mpesaPaid]);
    const buildDraft = (resolvedPaymentMethod) => ({
        items,
        subtotal,
        taxAmount,
        total,
        taxRate,
        showTax,
        discount: normalizedDiscount,
        showDiscount: effectiveShowDiscount,
        customerName,
        customerPhone,
        serial,
        docType,
        attendantName: selectedStaff?.name ?? "",
        paymentMethod: resolvedPaymentMethod,
        paymentDetailsShown,
        deposit: docType === "LAYAWAY" ? deposit : undefined,
        notes,
        deliveryAddress,
        // paperSize: fixed to A5, omitted from draft
        customerType,
        deliveryStatus: customerType === "delivery" ? deliveryStatus : undefined,
        paymentBreakdown: {
            cash: numericCashPaid,
            mpesa: numericMpesaPaid,
        },
        paymentMethods: selectedPaymentMethods,
    });
    const [lastPrintableUrl, setLastPrintableUrl] = (0, react_1.useState)(null);
    const buildPreviewUrl = (draft) => {
        const encoded = encodeURIComponent(btoa(JSON.stringify(draft)));
        // always preview using A5
        return `/receipts/preview?draft=${encoded}`;
    };
    const openPreviewWindow = (draft, autoPrint = false) => {
        try {
            const url = buildPreviewUrl(draft);
            setLastPrintableUrl(url);
            const target = autoPrint ? `${url}&autoPrint=1` : url;
            const previewWindow = window.open(target, "_blank");
            if (!previewWindow) {
                throw new Error("Popup blocked");
            }
            return true;
        }
        catch (err) {
            (0, toast_1.showToast)(err instanceof Error ? err.message : "Failed to open preview", "error");
            return false;
        }
    };
    const togglePaymentMethodSelection = (method) => {
        setSelectedPaymentMethods((prev) => {
            const isActive = prev[method];
            const other = method === "MPESA" ? "CASH" : "MPESA";
            if (isActive && !prev[other]) {
                return prev; // always keep at least one method selected
            }
            return { ...prev, [method]: !isActive };
        });
    };
    const handleCustomerTypeSelection = (type) => {
        setCustomerType(type);
        if (type === "delivery") {
            // ensure address input is visible for delivery customers
            setShowAddressInput(true);
        }
        if (type !== "delivery") {
            setDeliveryStatus("pending");
        }
    };
    const handleCashPaidChange = (rawValue) => {
        if (rawValue === "") {
            setCashPaid("");
            setMpesaPaid(Math.max(0, total));
            return;
        }
        const parsed = Number(rawValue);
        if (Number.isNaN(parsed))
            return;
        const clamped = Math.max(0, Math.min(total, parsed));
        setCashPaid(clamped);
        setMpesaPaid(Math.max(0, total - clamped));
    };
    const handleMpesaPaidChange = (rawValue) => {
        if (rawValue === "") {
            setMpesaPaid("");
            setCashPaid(Math.max(0, total));
            return;
        }
        const parsed = Number(rawValue);
        if (Number.isNaN(parsed))
            return;
        const clamped = Math.max(0, Math.min(total, parsed));
        setMpesaPaid(clamped);
        setCashPaid(Math.max(0, total - clamped));
    };
    const handlePreview = (autoPrint = false) => {
        if (!hasPaymentMethodSelection) {
            (0, toast_1.showToast)("Select a payment method before previewing", "error");
            return;
        }
        if (!customerType) {
            (0, toast_1.showToast)("Select a customer type before previewing", "error");
            return;
        }
        const draft = buildDraft(primaryPaymentMethod);
        return openPreviewWindow(draft, autoPrint);
    };
    const resetForm = () => {
        setItems([newItem()]);
        setCustomerName("");
        setCustomerPhone("");
        setCustomerType("");
        setDeliveryStatus("pending");
        setDeposit(0);
        setShowSerials(false);
        setShowWarranty(false);
        setGlobalWarranty("");
        setCashPaid(0);
        setMpesaPaid(0);
        setNotes("");
        setSerial((0, serial_1.generateReceiptSerial)());
        setDocType("RECEIPT");
    };
    const handleSave = async () => {
        if (!staffId)
            return (0, toast_1.showToast)("Select staff", "error");
        if (!items.length)
            return (0, toast_1.showToast)("Add at least one item", "error");
        if (!hasPaymentMethodSelection)
            return (0, toast_1.showToast)("Select payment method", "error");
        if (!customerName.trim())
            return (0, toast_1.showToast)("Customer name is required", "error");
        if (!customerPhone.trim())
            return (0, toast_1.showToast)("Customer phone is required", "error");
        if (!customerType)
            return (0, toast_1.showToast)("Select a customer type", "error");
        if (customerType === "delivery" && deliveryStatus === "failed") {
            return (0, toast_1.showToast)("Delivery marked as failed cannot be submitted", "error");
        }
        if (total <= 0)
            return (0, toast_1.showToast)("Total must be greater than zero", "error");
        if (showSplitPaymentInputs && Math.abs(numericCashPaid + numericMpesaPaid - total) > 0.1) {
            return (0, toast_1.showToast)("Cash + MPESA must equal the total", "error");
        }
        const resolvedPaymentMethod = primaryPaymentMethod;
        const normalizedItems = items.map((it) => ({
            title: it.title.trim(),
            quantity: Number(it.quantity || 1),
            unitPrice: Number(it.unitPrice || 0),
            serial: showSerials ? it.serial || null : null,
            warranty: showWarranty ? it.warranty || null : null,
        }));
        const hasInvalidItem = normalizedItems.some((it) => !it.title || it.unitPrice <= 0);
        if (hasInvalidItem) {
            return (0, toast_1.showToast)("Each item needs a description and price", "error");
        }
        setSaving(true);
        try {
            const payload = {
                docType: docType.toLowerCase(),
                serial,
                date: new Date().toISOString(),
                customerName,
                customerPhone,
                deliveryAddress: deliveryAddress || undefined,
                attendantId: staffId,
                issuedById: staffId,
                attendantName: selectedStaff?.name || "",
                taxRate: normalizedTaxRate,
                showTax,
                discount: normalizedDiscount,
                showDiscount: effectiveShowDiscount,
                paymentDetailsShown,
                paymentMethod: resolvedPaymentMethod,
                customerType,
                deliveryStatus: customerType === "delivery" ? deliveryStatus : undefined,
                notes,
                globalWarranty: globalWarranty || undefined,
                deposit: docType === "LAYAWAY" ? deposit : undefined,
                paymentBreakdown: {
                    cash: numericCashPaid,
                    mpesa: numericMpesaPaid,
                },
                items: normalizedItems,
            };
            const res = await fetch("/api/receipts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), credentials: "same-origin" });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                // handle duplicate owner (409) specially
                if (res.status === 409 && data?.code === "DUPLICATE_RECEIPT") {
                    setDuplicateOwner(data.owner ?? { message: data.message });
                    (0, toast_1.showToast)(data?.message || "Duplicate receipt detected", "error");
                    return;
                }
                return (0, toast_1.showToast)(data?.error || "Failed to save receipt", "error");
            }
            (0, toast_1.showToast)("Saved receipt", "success");
            onCreated?.(data);
            // Open preview and auto-print; if preview opens successfully reset form
            const previewOpened = handlePreview(true);
            if (previewOpened) {
                resetForm();
            }
        }
        catch (err) {
            (0, toast_1.showToast)(err instanceof Error ? err.message : "Failed to save", "error");
        }
        finally {
            setSaving(false);
        }
    };
    const labelClass = "text-xs uppercase tracking-wide text-slate-400";
    const fieldClass = "mt-1 w-full min-w-0 rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-400/60 focus:outline-none";
    const compactFieldClass = "rounded-xl border border-slate-800 bg-slate-950/80 px-2 py-1 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-400/60 focus:outline-none";
    const checkboxClass = "h-4 w-4 rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-500";
    return ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsxs)("div", { className: "receipt-screen space-y-6", children: [showHero && ((0, jsx_runtime_1.jsxs)("header", { className: "space-y-1", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-xs uppercase tracking-[0.2em] text-slate-400", children: "Receipts desk" }), (0, jsx_runtime_1.jsx)("h1", { className: "text-2xl font-semibold sm:text-3xl", children: "Betech Customers Operations" }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-300", children: "Track every printable document, search by customer, and open the PDF drawer without leaving this page." })] })), (0, jsx_runtime_1.jsxs)("div", { className: "grid grid-cols-1 gap-4 md:grid-cols-2", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: labelClass, children: "Staff" }), (0, jsx_runtime_1.jsxs)("select", { value: staffId ?? "", onChange: (e) => setStaffId(e.target.value || null), className: `${fieldClass} appearance-none`, children: [(0, jsx_runtime_1.jsx)("option", { value: "", children: "Select staff" }), staffMembers.map((a) => ((0, jsx_runtime_1.jsx)("option", { value: a.id, children: a.name }, a.id)))] })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: labelClass, children: "Document Type" }), (0, jsx_runtime_1.jsxs)("select", { value: docType, onChange: (e) => setDocType(e.target.value), className: `${fieldClass} appearance-none`, children: [(0, jsx_runtime_1.jsx)("option", { children: "RECEIPT" }), (0, jsx_runtime_1.jsx)("option", { children: "INVOICE" }), (0, jsx_runtime_1.jsx)("option", { children: "QUOTATION" }), (0, jsx_runtime_1.jsx)("option", { children: "LAYAWAY" })] })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "grid gap-4 md:grid-cols-3 items-center", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsxs)("label", { className: `${labelClass} flex items-center justify-between`, children: [(0, jsx_runtime_1.jsx)("span", { children: "Serial / Receipt No." }), (0, jsx_runtime_1.jsx)("button", { type: "button", className: "text-[11px] font-medium text-emerald-300 hover:underline", onClick: () => setSerial((0, serial_1.generateReceiptSerial)()), children: "Regenerate" })] }), (0, jsx_runtime_1.jsx)("input", { value: serial, readOnly: true, placeholder: "Auto-generated", className: `${fieldClass} cursor-not-allowed text-slate-400` })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: labelClass, children: "Customer Name" }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-2 min-w-0", children: [(0, jsx_runtime_1.jsx)("input", { value: customerName, onChange: (e) => setCustomerName(e.target.value), placeholder: "Customer name", className: `${fieldClass} flex-1` }), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: normalizeName, disabled: normalizingName, className: `flex-none inline-flex items-center justify-center whitespace-nowrap h-10 rounded-xl border border-slate-700 bg-slate-900 px-3 text-sm font-semibold text-amber-300 hover:bg-slate-800 ${normalizingName ? 'opacity-60 pointer-events-none' : ''}`, children: (0, jsx_runtime_1.jsx)("span", { className: "inline-flex items-center gap-2", children: normalizingName ? '…' : (0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)("span", { children: "\u2728" }), (0, jsx_runtime_1.jsx)("span", { children: "AI" })] }) }) })] })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: labelClass, children: "Customer Phone" }), (0, jsx_runtime_1.jsx)("input", { value: customerPhone, onChange: (e) => setCustomerPhone(e.target.value), placeholder: "07...", className: fieldClass })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap items-center gap-3", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-xs uppercase tracking-wide text-slate-400", children: "Customer type*" }), ["walk-in", "online", "delivery"].map((type) => ((0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => handleCustomerTypeSelection(type), className: `rounded-full px-4 py-1 text-sm font-semibold ${customerType === type ? "bg-emerald-500 text-black" : "border border-white/10 text-slate-200"}`, children: type.replace("-", " ") }, type)))] }), customerType === "delivery" && ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap items-center gap-2 text-xs uppercase tracking-wide text-slate-400", children: [(0, jsx_runtime_1.jsx)("span", { children: "Delivery status" }), ["pending", "delivered", "failed"].map((status) => ((0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => setDeliveryStatus(status), className: `rounded-full px-3 py-1 text-[11px] font-semibold ${deliveryStatus === status ? "bg-emerald-500 text-black" : "border border-white/10 text-slate-200"}`, children: status }, status)))] }), deliveryStatus === "failed" && ((0, jsx_runtime_1.jsx)("p", { className: "text-xs text-rose-300", children: "Failed deliveries are recorded but cannot be submitted." }))] })), (0, jsx_runtime_1.jsxs)("section", { className: "space-y-3 rounded-2xl border border-slate-800 bg-slate-950/70 p-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap items-center gap-4", children: [(0, jsx_runtime_1.jsxs)("label", { className: "inline-flex items-center gap-2 text-sm text-slate-200", children: [(0, jsx_runtime_1.jsx)("input", { type: "checkbox", checked: showSerials, onChange: (e) => setShowSerials(e.target.checked), className: checkboxClass }), "Add serial / IMEI (optional)"] }), (0, jsx_runtime_1.jsxs)("label", { className: "inline-flex items-center gap-2 text-sm text-slate-200", children: [(0, jsx_runtime_1.jsx)("input", { type: "checkbox", checked: showWarranty, onChange: (e) => setShowWarranty(e.target.checked), className: checkboxClass }), "Capture warranty per item"] })] }), (0, jsx_runtime_1.jsx)("div", { className: "space-y-2", children: items.map((it) => ((0, jsx_runtime_1.jsx)("div", { className: "w-full border-b border-slate-800 pb-3 last:border-none last:pb-0", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4", children: [(0, jsx_runtime_1.jsx)("div", { className: "flex-1 min-w-0", children: (0, jsx_runtime_1.jsx)("textarea", { className: "w-full min-h-[48px] px-3 py-2 rounded-md bg-[#060b1b] border border-gray-700 text-gray-200 resize-y", value: it.title, onChange: (e) => updateRow(it.id, { title: e.target.value }), placeholder: "Item description", rows: 2 }) }), (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap items-center justify-end gap-2", children: [(0, jsx_runtime_1.jsx)("button", { type: "button", className: "flex-shrink-0 h-12 px-4 rounded-md bg-[#060b1b] border border-gray-700 text-gray-200 flex items-center justify-center", onClick: () => aiDescription(it), disabled: descLoadingId === it.id, children: descLoadingId === it.id ? "…" : "✨ AI" }), (0, jsx_runtime_1.jsx)("input", { type: "number", min: 1, className: "flex-shrink-0 h-12 min-w-[68px] px-3 rounded-md bg-[#060b1b] border border-gray-700 text-gray-200", value: it.quantity, onChange: (e) => updateRow(it.id, { quantity: Math.max(1, Number(e.target.value || 1)) }) }), (0, jsx_runtime_1.jsx)("input", { type: "number", min: 0, className: "flex-shrink-0 h-12 min-w-[92px] px-3 rounded-md bg-[#060b1b] border border-gray-700 text-gray-200", value: it.unitPrice === "" ? "" : it.unitPrice, onChange: (e) => updateRow(it.id, { unitPrice: sanitizeNumericInput(e.target.value) }), placeholder: "Unit price" }), showSerials && ((0, jsx_runtime_1.jsx)("input", { className: "h-12 min-w-[92px] px-3 rounded-md bg-[#060b1b] border border-gray-700 text-gray-200 w-full sm:w-auto", value: it.serial, onChange: (e) => updateRow(it.id, { serial: e.target.value }), placeholder: "Serial / IMEI (optional)" })), showWarranty && ((0, jsx_runtime_1.jsxs)("select", { className: "h-12 min-w-[120px] rounded-md bg-[#060b1b] border border-gray-700 text-gray-200 w-full sm:w-auto", value: it.warranty, onChange: (e) => updateRow(it.id, { warranty: e.target.value }), children: [(0, jsx_runtime_1.jsx)("option", { value: "", children: "No warranty" }), warrantyOptions.map((w) => ((0, jsx_runtime_1.jsx)("option", { value: w, children: w }, w)))] })), (0, jsx_runtime_1.jsx)("button", { type: "button", className: "flex-shrink-0 h-12 px-4 rounded-md bg-red-600 text-white hover:bg-red-700", onClick: () => removeRow(it.id), children: "Remove" })] })] }) }, it.id))) }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-2 no-print flex flex-wrap gap-2", children: [(0, jsx_runtime_1.jsx)("button", { type: "button", className: "rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-black hover:brightness-95", onClick: addRow, children: "+ Add item" }), (0, jsx_runtime_1.jsx)("button", { type: "button", className: "rounded-xl border border-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-500 hover:bg-emerald-500 hover:text-black", onClick: addDeliveryFeeRow, children: "+ Add delivery fee" }), (0, jsx_runtime_1.jsx)("button", { type: "button", className: `rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold ${showAddressInput ? "text-black bg-emerald-500" : "text-slate-200 hover:bg-white/5"}`, onClick: () => setShowAddressInput((prev) => !prev), children: showAddressInput ? "Hide address" : "+ Add address" })] })] }), (showAddressInput || customerType === "delivery") && ((0, jsx_runtime_1.jsxs)("div", { className: "mt-3", children: [(0, jsx_runtime_1.jsx)("label", { className: labelClass, children: "Delivery address" }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-1 flex gap-2", children: [(0, jsx_runtime_1.jsx)("input", { value: deliveryAddress ?? "", onChange: (e) => setDeliveryAddress(e.target.value || undefined), placeholder: "Customer delivery address", className: `${fieldClass} flex-1` }), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: async () => {
                                            if (!deliveryAddress || !deliveryAddress.trim())
                                                return;
                                            setAddressLoading(true);
                                            try {
                                                const res = await fetch('/api/ai/address-correct', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rawAddress: deliveryAddress }) });
                                                if (!res.ok)
                                                    throw new Error('Address correction failed');
                                                const data = await res.json().catch(() => null);
                                                if (data?.address)
                                                    setDeliveryAddress(data.address);
                                            }
                                            catch (err) {
                                                (0, toast_1.showToast)(err instanceof Error ? err.message : 'AI address failed', 'error');
                                            }
                                            finally {
                                                setAddressLoading(false);
                                            }
                                        }, className: "rounded-xl px-3 py-2 bg-[#060b1b] border border-gray-700 text-gray-200", disabled: addressLoading, children: addressLoading ? '…' : '✨ AI' })] })] })), (0, jsx_runtime_1.jsxs)("div", { className: "grid gap-4 md:grid-cols-3", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: labelClass, children: "Tax %" }), (0, jsx_runtime_1.jsx)("input", { type: "number", value: Number.isFinite(taxRate) ? taxRate : "", onChange: (e) => {
                                            const raw = e.target.value;
                                            if (raw === "") {
                                                setTaxRate(NaN);
                                            }
                                            else {
                                                setTaxRate(Number(raw));
                                            }
                                        }, className: fieldClass }), (0, jsx_runtime_1.jsxs)("label", { className: "mt-2 inline-flex items-center text-sm text-slate-200", children: [(0, jsx_runtime_1.jsx)("input", { type: "checkbox", checked: showTax, onChange: (e) => setShowTax(e.target.checked), className: `${checkboxClass} mr-2` }), "Show Tax"] })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: labelClass, children: "Discount (KES)" }), (0, jsx_runtime_1.jsx)("input", { type: "number", value: Number.isFinite(discount) ? discount : "", onChange: (e) => {
                                            const raw = e.target.value;
                                            if (raw === "") {
                                                setDiscount(NaN);
                                            }
                                            else {
                                                setDiscount(Number(raw));
                                            }
                                        }, className: fieldClass }), (0, jsx_runtime_1.jsxs)("label", { className: "mt-2 inline-flex items-center text-sm text-slate-200", children: [(0, jsx_runtime_1.jsx)("input", { type: "checkbox", checked: showDiscount, onChange: (e) => setShowDiscount(e.target.checked), className: `${checkboxClass} mr-2` }), "Show Discount"] })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: labelClass, children: "Payment method" }), (0, jsx_runtime_1.jsx)("div", { className: "mt-2 flex gap-2", children: ["MPESA", "CASH"].map((method) => ((0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => togglePaymentMethodSelection(method), className: `flex-1 rounded-full px-3 py-2 text-xs font-semibold transition ${selectedPaymentMethods[method]
                                                ? "bg-emerald-500 text-black"
                                                : "border border-white/10 text-slate-200"}`, "aria-pressed": selectedPaymentMethods[method], children: method === "MPESA" ? "MPESA" : "Cash" }, method))) }), docType === "LAYAWAY" && ((0, jsx_runtime_1.jsxs)("div", { className: "mt-3 space-y-1", children: [(0, jsx_runtime_1.jsx)("label", { className: labelClass, children: "Deposit (KES)" }), (0, jsx_runtime_1.jsx)("input", { type: "number", value: deposit, onChange: (e) => setDeposit(Number(e.target.value || 0)), className: fieldClass }), (0, jsx_runtime_1.jsx)("p", { className: "text-xs text-slate-400", children: "Balance auto-computed from total." })] }))] })] }), showSplitPaymentInputs && ((0, jsx_runtime_1.jsxs)("div", { className: "grid gap-4 md:grid-cols-2", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: labelClass, children: "Cash paid (KES)" }), (0, jsx_runtime_1.jsx)("input", { type: "number", value: cashPaid === "" ? "" : cashPaid, min: 0, max: total, placeholder: "0", onChange: (e) => handleCashPaidChange(e.target.value), className: fieldClass }), (0, jsx_runtime_1.jsxs)("p", { className: "text-xs text-slate-400", children: ["Automatic MPESA value: KES ", (total - numericCashPaid).toLocaleString()] })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: labelClass, children: "MPESA paid (KES)" }), (0, jsx_runtime_1.jsx)("input", { type: "number", value: mpesaPaid === "" ? "" : mpesaPaid, min: 0, max: total, placeholder: "0", onChange: (e) => handleMpesaPaidChange(e.target.value), className: fieldClass }), (0, jsx_runtime_1.jsxs)("p", { className: "text-xs text-slate-400", children: ["Cash portion: KES ", (total - numericMpesaPaid).toLocaleString()] })] })] })), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between gap-2", children: [(0, jsx_runtime_1.jsx)("label", { className: labelClass, children: "General notes / terms" }), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: aiNotes, disabled: notesLoading, className: "rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:border-emerald-400 disabled:opacity-40", children: notesLoading ? "…" : "✨ Generate notes" })] }), (0, jsx_runtime_1.jsx)("textarea", { value: notes, onChange: (e) => setNotes(e.target.value), className: "mt-1 min-h-[60px] w-full rounded-xl border border-slate-800 bg-slate-950/80 p-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-400/60 focus:outline-none" }), notes && ((0, jsx_runtime_1.jsxs)("div", { className: "mt-3 rounded-2xl border border-slate-800 bg-slate-950/70 p-3 text-sm text-slate-100", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-xs uppercase tracking-wide text-slate-400", children: "Notes preview" }), (0, jsx_runtime_1.jsx)("div", { className: "no-print", children: (0, jsx_runtime_1.jsx)(MarkdownRendererClient_1.RichFormattingToggle, {}) })] }), (0, jsx_runtime_1.jsx)(MarkdownRendererClient_1.default, { mdText: notes })] }))] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col items-start justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-950/70 p-4 shadow-xl shadow-black/40 md:flex-row md:items-center", children: [(0, jsx_runtime_1.jsxs)("div", { className: "space-y-1 text-sm text-slate-200", children: [(0, jsx_runtime_1.jsxs)("div", { children: ["Subtotal: KES ", subtotal.toLocaleString()] }), showTax && (0, jsx_runtime_1.jsxs)("div", { children: ["Tax: KES ", taxAmount.toLocaleString()] }), effectiveShowDiscount && (0, jsx_runtime_1.jsxs)("div", { children: ["Discount: KES ", normalizedDiscount.toLocaleString()] }), (0, jsx_runtime_1.jsxs)("div", { className: "text-lg font-semibold text-white", children: ["Total: KES ", total.toLocaleString()] }), docType === "LAYAWAY" && ((0, jsx_runtime_1.jsxs)("div", { className: "text-amber-300", children: ["Balance after deposit: KES ", balance.toLocaleString()] }))] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap gap-3 no-print", children: [(0, jsx_runtime_1.jsx)("button", { type: "button", className: "rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-100 hover:bg-white/5", onClick: () => handlePreview(false), children: "Preview receipt" }), (0, jsx_runtime_1.jsx)("button", { type: "button", disabled: !lastPrintableUrl, onClick: () => {
                                            if (lastPrintableUrl)
                                                window.open(lastPrintableUrl, "_blank");
                                        }, className: "rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-100 hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed", children: "Reopen last printable" }), (0, jsx_runtime_1.jsx)("button", { type: "button", disabled: saving, className: "rounded-xl bg-emerald-500 px-5 py-2 text-sm font-semibold text-black hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60", onClick: handleSave, children: saving ? "Saving..." : "Save to System & Print" })] })] })] }), duplicateOwner && ((0, jsx_runtime_1.jsx)(ReceiptDuplicateModal_1.default, { owner: duplicateOwner, onClose: () => setDuplicateOwner(null) }))] }));
}
