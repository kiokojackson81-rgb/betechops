"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = ReceiptPrintView;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
// small, safe markdown -> HTML renderer supporting **bold**, paragraphs, '-' bullets and numbered lists
function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
function simpleMarkdownToHtml(md) {
    if (!md)
        return "";
    // normalize line endings
    const text = md.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    // escape HTML first
    let out = escapeHtml(text);
    // Handle bold **text**
    out = out.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    // Split into paragraphs by blank lines
    const paragraphs = out.split(/\n{2,}/g).map((p) => p.trim()).filter(Boolean);
    const rendered = paragraphs
        .map((p) => {
        const lines = p.split(/\n+/g).map((l) => l.trim());
        // detect bullet list (lines starting with '-') or numbered list (1.)
        if (lines.every((l) => /^(-|\d+\.)\s+/.test(l))) {
            if (/^\d+\./.test(lines[0])) {
                // ordered list
                const items = lines.map((l) => l.replace(/^\d+\.\s+/, "")).map((s) => `<li>${s}</li>`).join("");
                return `<ol>${items}</ol>`;
            }
            const items = lines.map((l) => l.replace(/^-\s+/, "")).map((s) => `<li>${s}</li>`).join("");
            return `<ul>${items}</ul>`;
        }
        // fallback: wrap as paragraph, preserving single-line breaks as <br/>
        return `<p>${lines.join("<br/>")}</p>`;
    })
        .join("");
    return rendered;
}
function formatKsh(v) {
    const n = Number(v || 0);
    return n.toLocaleString("en-KE", { maximumFractionDigits: 0 });
}
function ReceiptPrintView({ data, mode = "editor" }) {
    const showFooter = mode === "print" || mode === "preview";
    const items = Array.isArray(data?.items) ? data.items : [];
    const date = data?.date ? new Date(data.date) : new Date();
    const docTypeRaw = typeof data?.docType === "string" ? data.docType.toUpperCase() : "RECEIPT";
    const headingMap = {
        INVOICE: "INVOICE",
        QUOTATION: "QUOTATION",
        LAYAWAY: "LAYAWAY AGREEMENT",
    };
    const docHeading = headingMap[docTypeRaw] || "CASH SALE RECEIPT";
    const numberLabelMap = {
        INVOICE: "Invoice No.",
        QUOTATION: "Quotation No.",
        LAYAWAY: "Layaway No.",
    };
    const numberLabel = numberLabelMap[docTypeRaw] || "Receipt No.";
    const servedBy = data?.attendantName ||
        data?.issuedByName ||
        data?.issuedBy?.name ||
        data?.attendant?.name ||
        "____";
    const paymentMethodRaw = (data?.paymentMethod || "").toString().toUpperCase();
    const paymentLabel = paymentMethodRaw === "CASH" ? "Cash" : "MPESA";
    const showDiscount = Boolean(data?.showDiscount) || Number(data?.discount || 0) > 0;
    const discountValue = Number(data?.discount || 0);
    const depositValue = Number(data?.deposit || data?.totals?.deposit || 0);
    const balanceValue = Number(data?.totals?.balance ?? data?.balance ?? 0);
    const paymentBreakdown = (data?.paymentBreakdown ?? {});
    const mpesaPaidAmount = Number(paymentBreakdown.mpesa ?? 0);
    const cashPaidAmount = Number(paymentBreakdown.cash ?? 0);
    const paymentReference = (typeof paymentBreakdown.reference === "string" && paymentBreakdown.reference.trim()) ||
        (typeof paymentBreakdown.mpesaReference === "string" && paymentBreakdown.mpesaReference.trim()) ||
        "";
    const customerPhone = data?.customerPhone;
    const [name, setName] = (0, react_1.useState)(data?.customerName || "");
    const [loading, setLoading] = (0, react_1.useState)(false);
    const handleNormalize = async () => {
        if (!name)
            return;
        setLoading(true);
        try {
            const res = await fetch("/api/ai/normalize-name", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, receiptId: data?.id ?? undefined }),
            });
            if (res.ok) {
                const json = await res.json();
                if (json?.normalizedName)
                    setName(String(json.normalizedName));
            }
            else {
                console.error("/api/ai/normalize-name returned", res.status);
            }
        }
        catch (e) {
            console.error("AI normalize error", e);
        }
        finally {
            setLoading(false);
        }
    };
    // Always render using A5 layout for printed receipts
    const sizeClass = `receipt-sheet receipt-sheet--a5`;
    const borderClass = mode === "print" ? "" : "border";
    return ((0, jsx_runtime_1.jsxs)("div", { className: `${sizeClass} ${borderClass} rounded-md p-6 text-sm bg-white text-black mx-auto`, children: [(0, jsx_runtime_1.jsxs)("div", { className: "text-center mb-4", children: [(0, jsx_runtime_1.jsx)("h2", { className: "text-xs tracking-[0.35em] uppercase", children: docHeading }), (0, jsx_runtime_1.jsx)("h1", { className: "text-2xl font-extrabold mt-2", children: "BETECH SOLAR SOLUTIONS" }), (0, jsx_runtime_1.jsx)("p", { className: "text-xs mt-1", children: "Dealers in: Solar Solutions, Solar Products, e.t.c" }), (0, jsx_runtime_1.jsx)("p", { className: "text-[11px] mt-1", children: "Tel: 0722 151 083 / 0703 241 917 - Pramukh Plaza 3rd Floor Shop No. 3 Nairobi CBD" }), (0, jsx_runtime_1.jsx)("p", { className: "text-[11px]", children: "Email: info@betech.co.ke - Website: www.betech.co.ke" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex justify-between text-xs mb-2", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("span", { className: "font-semibold", children: "Date:" }), " ", date.toLocaleString()] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("span", { className: "font-semibold", children: numberLabel }), " ", data?.serial, (0, jsx_runtime_1.jsxs)("div", { style: { marginTop: 6 }, children: [(0, jsx_runtime_1.jsx)("strong", { children: "Address :" }), " ", data?.deliveryAddress || '-'] })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "text-xs mb-4 space-y-1", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("span", { className: "font-semibold", children: "M/S:" }), (0, jsx_runtime_1.jsx)("span", { className: "ml-1", children: name || "________________" }), mode !== "print" && ((0, jsx_runtime_1.jsx)("button", { type: "button", disabled: !name || loading, onClick: handleNormalize, className: "ml-2 inline-flex items-center px-2 py-1 text-[10px] border rounded bg-emerald-50 text-emerald-700", title: "Normalize capitalization", children: loading ? "..." : "AI" }))] }), customerPhone && ((0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("span", { className: "font-semibold", children: "Phone:" }), " ", customerPhone] }))] }), (0, jsx_runtime_1.jsxs)("table", { className: "w-full border-collapse text-xs", children: [(0, jsx_runtime_1.jsx)("thead", { children: (0, jsx_runtime_1.jsxs)("tr", { className: "border-t border-b", children: [(0, jsx_runtime_1.jsx)("th", { className: "w-12 py-1 text-left", children: "Qty" }), (0, jsx_runtime_1.jsx)("th", { className: "py-1 text-left", children: "Particulars" }), (0, jsx_runtime_1.jsx)("th", { className: "w-24 py-1 text-right", children: "@ (Ksh)" }), (0, jsx_runtime_1.jsx)("th", { className: "w-24 py-1 text-right", children: "Kshs." })] }) }), (0, jsx_runtime_1.jsx)("tbody", { children: items.map((item, idx) => {
                            const qty = item.quantity ?? item.qty ?? 1;
                            const unitPrice = item.unitPrice ?? item.price ?? item.sellingPrice ?? 0;
                            const lineTotal = qty * Number(unitPrice);
                            return ((0, jsx_runtime_1.jsxs)("tr", { className: "border-b align-top", children: [(0, jsx_runtime_1.jsx)("td", { className: "py-1", children: qty }), (0, jsx_runtime_1.jsxs)("td", { className: "py-1 whitespace-pre-wrap", children: [(0, jsx_runtime_1.jsx)("div", { dangerouslySetInnerHTML: { __html: simpleMarkdownToHtml(String(item.title || "")) } }), item.serial && ((0, jsx_runtime_1.jsxs)("div", { className: "text-[10px] text-slate-500", children: ["Serial / IMEI: ", item.serial] })), item.warranty && ((0, jsx_runtime_1.jsxs)("div", { className: "text-[10px] text-slate-500", children: ["Warranty: ", item.warranty] }))] }), (0, jsx_runtime_1.jsx)("td", { className: "py-1 text-right", children: formatKsh(unitPrice) }), (0, jsx_runtime_1.jsx)("td", { className: "py-1 text-right", children: formatKsh(lineTotal) })] }, idx));
                        }) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-4 text-sm space-y-1", children: [(0, jsx_runtime_1.jsx)("div", { className: "flex justify-end gap-4", children: (0, jsx_runtime_1.jsxs)("div", { className: "text-right", children: ["Subtotal: KES ", formatKsh(data?.totals?.subtotal ?? data?.subtotal ?? 0)] }) }), data?.showTax && ((0, jsx_runtime_1.jsxs)("div", { className: "flex justify-end gap-4 text-right", children: ["Tax: KES ", formatKsh(data?.totals?.tax ?? data?.taxAmount ?? 0)] })), showDiscount && ((0, jsx_runtime_1.jsxs)("div", { className: "flex justify-end gap-4 text-right", children: ["Discount: KES ", formatKsh(discountValue)] })), (0, jsx_runtime_1.jsxs)("div", { className: "flex justify-end gap-4 text-right font-semibold", children: ["Total: KES ", formatKsh(data?.totals?.total ?? data?.total ?? 0)] }), depositValue > 0 && ((0, jsx_runtime_1.jsxs)("div", { className: "flex justify-end gap-4 text-right", children: ["Deposit: KES ", formatKsh(depositValue)] })), balanceValue > 0 && ((0, jsx_runtime_1.jsxs)("div", { className: "flex justify-end gap-4 text-right text-amber-600", children: ["Balance due: KES ", formatKsh(balanceValue)] }))] }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-4 text-xs", children: [(0, jsx_runtime_1.jsxs)("p", { children: ["Payment method: ", (0, jsx_runtime_1.jsx)("span", { className: "font-semibold", children: paymentLabel })] }), data?.notes && ((0, jsx_runtime_1.jsxs)("div", { className: "mt-2 text-[12px]", children: [(0, jsx_runtime_1.jsx)("strong", { children: "Notes:" }), (0, jsx_runtime_1.jsx)("div", { className: "mt-1", dangerouslySetInnerHTML: { __html: simpleMarkdownToHtml(String(data.notes || "")) } })] })), (mpesaPaidAmount > 0 || cashPaidAmount > 0 || paymentReference) && ((0, jsx_runtime_1.jsxs)("div", { className: "mt-2 space-y-0.5", children: [(0, jsx_runtime_1.jsx)("p", { className: "font-semibold", children: "Payment details" }), mpesaPaidAmount > 0 && ((0, jsx_runtime_1.jsxs)("p", { children: ["MPESA: KES ", formatKsh(mpesaPaidAmount), paymentReference ? ` (Ref: ${paymentReference})` : ""] })), cashPaidAmount > 0 && (0, jsx_runtime_1.jsxs)("p", { children: ["Cash: KES ", formatKsh(cashPaidAmount)] })] }))] }), showFooter && ((0, jsx_runtime_1.jsxs)("div", { className: "mt-8 text-center text-xs", children: [(0, jsx_runtime_1.jsxs)("p", { children: ["Thank you for shopping with Betech Solar Solutions. You were served by ", servedBy, "."] }), (0, jsx_runtime_1.jsx)("p", { children: "Goods once sold cannot be refunded." }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-6 flex justify-center items-center gap-2", children: [(0, jsx_runtime_1.jsx)("span", { children: "Official Stamp:" }), (0, jsx_runtime_1.jsx)("span", { className: "inline-block border-b w-48" })] })] }))] }));
}
