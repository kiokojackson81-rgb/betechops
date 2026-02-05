"use strict";
/**
 * Polished redesign of the marketing attendant daily report page.
 *
 * This version matches the look and feel of the marketing tracker: dark
 * background, clearly delineated cards, and a modern header with date
 * selectors.  It preserves core functionality such as recording sales
 * receipts, counting product management activities, toggling customer
 * communication tasks, capturing live session details, and taking notes.
 */
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = DailyReportStyled;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const MarkdownRendererClient_1 = __importDefault(require("@/components/MarkdownRendererClient"));
const lucide_react_1 = require("lucide-react");
/**
 * Shared card classes consistent with the tracker UI.  Cards have a
 * translucent dark background, subtle borders, rounded corners and
 * soft shadows.
 */
const cardClasses = "rounded-2xl border border-white/10 bg-[var(--card,#171b23)] border-slate-800 bg-slate-900/60 shadow-xl shadow-black/20";
function DailyReportStyled() {
    // Date and day state
    const [selectedDate, setSelectedDate] = (0, react_1.useState)(() => new Date());
    const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const dayName = weekdays[selectedDate.getDay()];
    // Sales receipts state
    const [receipts, setReceipts] = (0, react_1.useState)([{
            sellingTotal: 0,
            receiptNumber: "",
            paymentMethod: "MPESA",
            items: [],
        }]);
    // Stats counts
    const [newProducts, setNewProducts] = (0, react_1.useState)(0);
    const [productsEdited, setProductsEdited] = (0, react_1.useState)(0);
    const [copiesUploaded, setCopiesUploaded] = (0, react_1.useState)(0);
    // Communications toggles
    const [shopNeat, setShopNeat] = (0, react_1.useState)(false);
    const [walkInCustomers, setWalkInCustomers] = (0, react_1.useState)(false);
    const [callsHandled, setCallsHandled] = (0, react_1.useState)(false);
    const [whatsAppHandled, setWhatsAppHandled] = (0, react_1.useState)(false);
    // Live session details
    const [liveDuration, setLiveDuration] = (0, react_1.useState)(0);
    const [livePlatform, setLivePlatform] = (0, react_1.useState)("Facebook");
    const [liveViewers, setLiveViewers] = (0, react_1.useState)(0);
    // Notes
    const [notes, setNotes] = (0, react_1.useState)("");
    // Helpers for receipts
    const addReceipt = () => {
        setReceipts((prev) => [...prev, { sellingTotal: 0, receiptNumber: "", paymentMethod: "MPESA", items: [] }]);
    };
    const removeReceipt = (index) => {
        setReceipts((prev) => prev.filter((_, i) => i !== index));
    };
    const updateReceiptField = (rIndex, field, value) => {
        setReceipts((prev) => {
            const copy = [...prev];
            copy[rIndex][field] = value;
            return copy;
        });
    };
    const addItemToReceipt = (rIndex) => {
        setReceipts((prev) => {
            const copy = [...prev];
            copy[rIndex].items.push({ name: "", price: 0 });
            return copy;
        });
    };
    const removeItemFromReceipt = (rIndex, iIndex) => {
        setReceipts((prev) => {
            const copy = [...prev];
            copy[rIndex].items = copy[rIndex].items.filter((_, idx) => idx !== iIndex);
            return copy;
        });
    };
    const updateReceiptItem = (rIndex, iIndex, field, value) => {
        setReceipts((prev) => {
            const copy = [...prev];
            copy[rIndex].items[iIndex] = { ...copy[rIndex].items[iIndex], [field]: value };
            return copy;
        });
    };
    // Compute totals
    const totalReceipts = receipts.length;
    const totalSales = receipts.reduce((sum, r) => sum + r.sellingTotal, 0);
    const totalItems = receipts.reduce((sum, r) => sum + r.items.length, 0);
    const totalProfit = receipts.reduce((profit, r) => {
        const cost = r.items.reduce((c, i) => c + i.price, 0);
        return profit + (r.sellingTotal - cost);
    }, 0);
    // Submit report handler – build a payload with all data
    const handleSubmit = () => {
        const payload = {
            date: selectedDate.toISOString().split("T")[0],
            day: dayName,
            receipts: receipts.map((r) => ({
                sellingTotal: r.sellingTotal,
                receiptNumber: r.receiptNumber,
                paymentMethod: r.paymentMethod,
                items: r.items,
            })),
            newProducts,
            productsEdited,
            copiesUploaded,
            communications: {
                shopNeat,
                walkInCustomers,
                callsHandled,
                whatsAppHandled,
            },
            liveSession: {
                duration: liveDuration,
                platform: livePlatform,
                viewers: liveViewers,
            },
            notes,
        };
        console.log("Submitting report", payload);
        alert(`Report submitted for ${dayName}! Check console for payload.`);
    };
    return ((0, jsx_runtime_1.jsxs)("div", { className: "min-h-screen bg-slate-950 text-slate-100 p-8 space-y-10", children: [(0, jsx_runtime_1.jsxs)("header", { className: "flex flex-col gap-4 md:flex-row md:items-center md:justify-between", children: [(0, jsx_runtime_1.jsx)("h1", { className: "text-3xl font-semibold", children: "Daily Report" }), (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap gap-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-700 bg-slate-900", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.CalendarIcon, { size: 16, className: "text-slate-400" }), (0, jsx_runtime_1.jsx)("input", { type: "date", className: "bg-transparent focus:outline-none text-sm", value: selectedDate.toISOString().split("T")[0], onChange: (e) => {
                                            const d = new Date(e.target.value);
                                            if (!isNaN(d.getTime()))
                                                setSelectedDate(d);
                                        } })] }), (0, jsx_runtime_1.jsx)("div", { className: "flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-700 bg-slate-900", children: (0, jsx_runtime_1.jsx)("select", { className: "bg-transparent focus:outline-none text-sm", value: dayName, onChange: (e) => {
                                        const nextIndex = weekdays.indexOf(e.target.value);
                                        const currentIndex = selectedDate.getDay();
                                        const diff = nextIndex - currentIndex;
                                        const nextDate = new Date(selectedDate);
                                        nextDate.setDate(selectedDate.getDate() + diff);
                                        setSelectedDate(nextDate);
                                    }, children: weekdays.map((d) => ((0, jsx_runtime_1.jsx)("option", { value: d, className: "bg-slate-800", children: d }, d))) }) })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-8", children: [(0, jsx_runtime_1.jsxs)("div", { className: cardClasses + " p-6 space-y-4", children: [(0, jsx_runtime_1.jsx)("h2", { className: "text-xl font-semibold", children: "Sales Receipts" }), receipts.map((receipt, rIndex) => ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-4 p-4 border border-slate-700 rounded-xl bg-black/20", children: [(0, jsx_runtime_1.jsxs)("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "space-y-1", children: [(0, jsx_runtime_1.jsx)("label", { className: "text-xs uppercase tracking-wide text-slate-400", children: "Selling total (KES)" }), (0, jsx_runtime_1.jsx)("input", { type: "number", value: receipt.sellingTotal, onChange: (e) => updateReceiptField(rIndex, "sellingTotal", parseFloat(e.target.value) || 0), className: "w-full rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-sm" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-1", children: [(0, jsx_runtime_1.jsx)("label", { className: "text-xs uppercase tracking-wide text-slate-400", children: "Payment method" }), (0, jsx_runtime_1.jsxs)("div", { className: "flex gap-2", children: [(0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => updateReceiptField(rIndex, "paymentMethod", "MPESA"), className: `px-3 py-1 rounded-full text-xs font-medium border ${receipt.paymentMethod === "MPESA"
                                                                    ? "bg-emerald-500 text-black border-emerald-600"
                                                                    : "bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700"}`, children: "MPESA" }), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => updateReceiptField(rIndex, "paymentMethod", "CASH"), className: `px-3 py-1 rounded-full text-xs font-medium border ${receipt.paymentMethod === "CASH"
                                                                    ? "bg-emerald-500 text-black border-emerald-600"
                                                                    : "bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700"}`, children: "Cash" })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-1", children: [(0, jsx_runtime_1.jsx)("label", { className: "text-xs uppercase tracking-wide text-slate-400", children: "Receipt number (required)" }), (0, jsx_runtime_1.jsx)("input", { type: "text", value: receipt.receiptNumber, onChange: (e) => updateReceiptField(rIndex, "receiptNumber", e.target.value), className: "w-full rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-sm" })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-2", children: [(0, jsx_runtime_1.jsx)("label", { className: "text-xs uppercase tracking-wide text-slate-400", children: "Products" }), receipt.items.map((item, iIndex) => ((0, jsx_runtime_1.jsxs)("div", { className: "grid grid-cols-1 md:grid-cols-[2fr_1fr_auto] gap-2 items-center", children: [(0, jsx_runtime_1.jsx)("input", { type: "text", value: item.name, onChange: (e) => updateReceiptItem(rIndex, iIndex, "name", e.target.value), className: "rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-sm", placeholder: "Product name" }), (0, jsx_runtime_1.jsx)("input", { type: "number", value: item.price, onChange: (e) => updateReceiptItem(rIndex, iIndex, "price", parseFloat(e.target.value) || 0), className: "rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-sm", placeholder: "Buying price" }), (0, jsx_runtime_1.jsx)("button", { type: "button", className: "text-xs text-red-400 hover:text-red-300", onClick: () => removeItemFromReceipt(rIndex, iIndex), children: "Remove" })] }, iIndex))), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => addItemToReceipt(rIndex), className: "inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-1 text-xs text-slate-200 hover:bg-white/5", children: "+ Add product" })] }), receipts.length > 1 && ((0, jsx_runtime_1.jsx)("button", { type: "button", className: "text-xs text-red-400 hover:text-red-300", onClick: () => removeReceipt(rIndex), children: "Remove receipt" }))] }, rIndex))), (0, jsx_runtime_1.jsxs)("div", { className: "flex justify-between items-center pt-4", children: [(0, jsx_runtime_1.jsx)("button", { type: "button", onClick: addReceipt, className: "inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-200 hover:bg-white/5", children: "+ Add Receipt" }), (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col text-xs text-slate-400 gap-1 text-right", children: [(0, jsx_runtime_1.jsxs)("span", { children: ["Total receipts: ", totalReceipts] }), (0, jsx_runtime_1.jsxs)("span", { children: ["Total sales (KES): ", totalSales.toLocaleString()] }), (0, jsx_runtime_1.jsxs)("span", { children: ["Total profit (KES): ", totalProfit.toLocaleString()] }), (0, jsx_runtime_1.jsxs)("span", { children: ["Total items: ", totalItems] })] })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-8", children: [(0, jsx_runtime_1.jsxs)("div", { className: cardClasses + " p-6 space-y-4", children: [(0, jsx_runtime_1.jsx)("h3", { className: "text-lg font-semibold", children: "Product Management" }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-3", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex justify-between items-center", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-sm", children: "New products uploaded" }), (0, jsx_runtime_1.jsx)("input", { type: "number", min: 0, value: newProducts, onChange: (e) => setNewProducts(parseInt(e.target.value) || 0), className: "w-20 rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-sm text-right" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex justify-between items-center", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-sm", children: "Products edited" }), (0, jsx_runtime_1.jsx)("input", { type: "number", min: 0, value: productsEdited, onChange: (e) => setProductsEdited(parseInt(e.target.value) || 0), className: "w-20 rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-sm text-right" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex justify-between items-center", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-sm", children: "Copies uploaded" }), (0, jsx_runtime_1.jsx)("input", { type: "number", min: 0, value: copiesUploaded, onChange: (e) => setCopiesUploaded(parseInt(e.target.value) || 0), className: "w-20 rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-sm text-right" })] })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: cardClasses + " p-6 space-y-4", children: [(0, jsx_runtime_1.jsx)("h3", { className: "text-lg font-semibold", children: "Customer Communications" }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-3", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex justify-between items-center", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-sm", children: "Shop neat" }), (0, jsx_runtime_1.jsx)("input", { type: "checkbox", checked: shopNeat, onChange: (e) => setShopNeat(e.target.checked), className: "h-4 w-4 rounded border-slate-700 bg-slate-800 text-emerald-500 focus:ring-emerald-500" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex justify-between items-center", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-sm", children: "Walk-in customers" }), (0, jsx_runtime_1.jsx)("input", { type: "checkbox", checked: walkInCustomers, onChange: (e) => setWalkInCustomers(e.target.checked), className: "h-4 w-4 rounded border-slate-700 bg-slate-800 text-emerald-500 focus:ring-emerald-500" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex justify-between items-center", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-sm", children: "Calls" }), (0, jsx_runtime_1.jsx)("input", { type: "checkbox", checked: callsHandled, onChange: (e) => setCallsHandled(e.target.checked), className: "h-4 w-4 rounded border-slate-700 bg-slate-800 text-emerald-500 focus:ring-emerald-500" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex justify-between items-center", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-sm", children: "WhatsApp" }), (0, jsx_runtime_1.jsx)("input", { type: "checkbox", checked: whatsAppHandled, onChange: (e) => setWhatsAppHandled(e.target.checked), className: "h-4 w-4 rounded border-slate-700 bg-slate-800 text-emerald-500 focus:ring-emerald-500" })] })] })] })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "grid grid-cols-1 xl:grid-cols-2 gap-8", children: [(0, jsx_runtime_1.jsxs)("div", { className: cardClasses + " p-6 space-y-4", children: [(0, jsx_runtime_1.jsx)("h3", { className: "text-lg font-semibold", children: "Live Session" }), (0, jsx_runtime_1.jsxs)("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "space-y-1", children: [(0, jsx_runtime_1.jsx)("label", { className: "text-xs uppercase tracking-wide text-slate-400", children: "Duration (min)" }), (0, jsx_runtime_1.jsx)("input", { type: "number", min: 0, value: liveDuration, onChange: (e) => setLiveDuration(parseInt(e.target.value) || 0), className: "w-full rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-sm" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-1", children: [(0, jsx_runtime_1.jsx)("label", { className: "text-xs uppercase tracking-wide text-slate-400", children: "Platform" }), (0, jsx_runtime_1.jsx)("select", { className: "w-full rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-sm", value: livePlatform, onChange: (e) => setLivePlatform(e.target.value), children: [
                                                    "Facebook",
                                                    "Instagram",
                                                    "TikTok",
                                                    "YouTube",
                                                ].map((opt) => ((0, jsx_runtime_1.jsx)("option", { value: opt, className: "bg-slate-700", children: opt }, opt))) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-1", children: [(0, jsx_runtime_1.jsx)("label", { className: "text-xs uppercase tracking-wide text-slate-400", children: "Viewers" }), (0, jsx_runtime_1.jsx)("input", { type: "number", min: 0, value: liveViewers, onChange: (e) => setLiveViewers(parseInt(e.target.value) || 0), className: "w-full rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-sm" })] })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: cardClasses + " p-6 space-y-4", children: [(0, jsx_runtime_1.jsx)("h3", { className: "text-lg font-semibold", children: "Notes" }), (0, jsx_runtime_1.jsx)("textarea", { rows: 4, value: notes, onChange: (e) => setNotes(e.target.value), placeholder: "Any additional comments or highlights\u2026", className: "w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500" }), notes ? ((0, jsx_runtime_1.jsx)("div", { className: "mt-2 text-sm text-slate-300", children: (0, jsx_runtime_1.jsx)(MarkdownRendererClient_1.default, { mdText: String(notes) }) })) : null] })] }), (0, jsx_runtime_1.jsx)("div", { className: "flex justify-end", children: (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: handleSubmit, className: "rounded-xl px-5 py-3 text-sm font-semibold bg-emerald-500 text-black hover:brightness-95", children: "Submit report" }) })] }));
}
