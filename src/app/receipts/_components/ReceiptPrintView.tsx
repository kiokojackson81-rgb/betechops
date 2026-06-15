"use client";
import React, { useState } from "react";
// small, safe markdown -> HTML renderer supporting **bold**, paragraphs, '-' bullets and numbered lists
function escapeHtml(unsafe: string) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function simpleMarkdownToHtml(md: string) {
  if (!md) return "";
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

type Props = {
  data: any;
  mode?: "editor" | "print" | "preview";
};

function formatKsh(v: number | string) {
  const n = Number(v || 0);
  return n.toLocaleString("en-KE", { maximumFractionDigits: 0 });
}

export default function ReceiptPrintView({ data, mode = "editor" }: Props) {
  const showFooter = mode === "print" || mode === "preview";
  const items = Array.isArray(data?.items) ? data.items : [];
  const date = data?.date ? new Date(data.date) : new Date();
  const docTypeRaw = typeof data?.docType === "string" ? data.docType.toUpperCase() : "RECEIPT";
  const headingMap: Record<string, string> = {
    INVOICE: "INVOICE",
    QUOTATION: "QUOTATION",
    LAYAWAY: "LAYAWAY AGREEMENT",
  };
  const docHeading = headingMap[docTypeRaw] || "CASH SALE RECEIPT";
  const numberLabelMap: Record<string, string> = {
    INVOICE: "Invoice No.",
    QUOTATION: "Quotation No.",
    LAYAWAY: "Layaway No.",
  };
  const numberLabel = numberLabelMap[docTypeRaw] || "Receipt No.";
  const normalizedAttendantName =
    typeof data?.attendantName === "string" ? data.attendantName.trim() : "";
  const normalizedOrderAttendantName =
    typeof data?.attendant?.name === "string" ? data.attendant.name.trim() : "";
  const normalizedIssuedByName =
    typeof data?.issuedByName === "string" ? data.issuedByName.trim() : "";
  const normalizedIssuedByObjectName =
    typeof data?.issuedBy?.name === "string" ? data.issuedBy.name.trim() : "";
  const servedBy =
    normalizedAttendantName ||
    normalizedOrderAttendantName ||
    normalizedIssuedByName ||
    normalizedIssuedByObjectName ||
    "____";
  const paymentMethodRaw = (data?.paymentMethod || "").toString().toUpperCase();
  const paymentLabel = paymentMethodRaw === "CASH" ? "Cash" : "MPESA";
  const showDiscount = Boolean(data?.showDiscount) || Number(data?.discount || 0) > 0;
  const discountValue = Number(data?.discount || 0);
  const depositValue = Number(data?.deposit || data?.totals?.deposit || 0);
  const balanceValue = Number(data?.totals?.balance ?? data?.balance ?? 0);
  const paymentBreakdown = (data?.paymentBreakdown ?? {}) as {
    mpesa?: number;
    cash?: number;
    reference?: string;
    mpesaReference?: string;
  };
  const mpesaPaidAmount = Number(paymentBreakdown.mpesa ?? 0);
  const cashPaidAmount = Number(paymentBreakdown.cash ?? 0);
  const paymentReference =
    (typeof paymentBreakdown.reference === "string" && paymentBreakdown.reference.trim()) ||
    (typeof paymentBreakdown.mpesaReference === "string" && paymentBreakdown.mpesaReference.trim()) ||
    "";
  const customerPhone = data?.customerPhone;
  const [name, setName] = useState<string>(data?.customerName || "");
  const [loading, setLoading] = useState(false);

  const handleNormalize = async () => {
    if (!name) return;
    setLoading(true);
    try {
      const res = await fetch("/api/ai/normalize-name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, receiptId: (data as any)?.id ?? undefined }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json?.normalizedName) setName(String(json.normalizedName));
      } else {
        console.error("/api/ai/normalize-name returned", res.status);
      }
    } catch (e) {
      console.error("AI normalize error", e);
    } finally {
      setLoading(false);
    }
  };

  // Always render using A5 layout for printed receipts
  const sizeClass = `receipt-sheet receipt-sheet--a5`;
  const borderClass = mode === "print" ? "" : "border";

  return (
    <div
      className={`${sizeClass} ${borderClass} mx-auto flex min-h-[calc(210mm-4mm)] flex-col rounded-md bg-white p-2 text-sm text-black`}
      style={{ minHeight: "calc(210mm - 4mm)" }}
    >
      <div className="mb-2 border-b pb-2 text-center">
        <h2 className="text-[10px] tracking-[0.35em] uppercase">{docHeading}</h2>
        <h1 className="mt-1 text-2xl font-extrabold">BETECH SOLAR SOLUTIONS</h1>
        <p className="mt-1 text-xs">Dealers in: Solar Solutions, Solar Products, e.t.c</p>
        <p className="mt-1 text-[11px]">Tel: 0722 151 083 / 0703 241 917 - Pramukh Plaza 3rd Floor Shop No. 3 Nairobi CBD</p>
        <p className="text-[11px]">Email: info@betech.co.ke - Website: www.betech.co.ke</p>
      </div>

      <div className="mb-2 flex justify-between text-xs">
        <div>
          <span className="font-semibold">Date:</span> {date.toLocaleString()}
        </div>
          <div>
          <span className="font-semibold">{numberLabel}</span> {data?.serial}
          <div style={{ marginTop: 6 }}>
            <strong>Address :</strong> {data?.deliveryAddress || '-'}
          </div>
         </div>
      </div>

      <div className="mb-3 text-xs space-y-1">
        <div>
          <span className="font-semibold">M/S:</span>
          <span className="ml-1">{name || "________________"}</span>
          {mode !== "print" && (
            <button
              type="button"
              disabled={!name || loading}
              onClick={handleNormalize}
              className="ml-2 inline-flex items-center px-2 py-1 text-[10px] border rounded bg-emerald-50 text-emerald-700"
              title="Normalize capitalization"
            >
              {loading ? "..." : "AI"}
            </button>
          )}
        </div>
        {customerPhone && (
          <div>
            <span className="font-semibold">Phone:</span> {customerPhone}
          </div>
        )}
      </div>

      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="border-t border-b">
            <th className="w-12 py-1 text-left">Qty</th>
            <th className="py-1 text-left">Particulars</th>
            <th className="w-24 py-1 text-right">@ (Ksh)</th>
            <th className="w-24 py-1 text-right">Kshs.</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item: any, idx: number) => {
            const qty = item.quantity ?? item.qty ?? 1;
            const unitPrice = item.unitPrice ?? item.price ?? item.sellingPrice ?? 0;
            const lineTotal = qty * Number(unitPrice);
            return (
              <tr key={idx} className="border-b align-top">
                <td className="py-1">{qty}</td>
                <td className="py-1 whitespace-pre-wrap">
                  <div dangerouslySetInnerHTML={{ __html: simpleMarkdownToHtml(String(item.title || "")) }} />
                  {item.serial && (
                    <div className="text-[10px] text-slate-500">Serial / IMEI: {item.serial}</div>
                  )}
                  {item.warranty && (
                    <div className="text-[10px] text-slate-500">Warranty: {item.warranty}</div>
                  )}
                </td>
                <td className="py-1 text-right">{formatKsh(unitPrice)}</td>
                <td className="py-1 text-right">{formatKsh(lineTotal)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="mt-3 text-sm space-y-1">
        <div className="flex justify-end gap-4">
          <div className="text-right">
            Subtotal: KES {formatKsh(data?.totals?.subtotal ?? data?.subtotal ?? 0)}
          </div>
        </div>
        {data?.showTax && (
          <div className="flex justify-end gap-4 text-right">
            Tax: KES {formatKsh(data?.totals?.tax ?? data?.taxAmount ?? 0)}
          </div>
        )}
        {showDiscount && (
          <div className="flex justify-end gap-4 text-right">
            Discount: KES {formatKsh(discountValue)}
          </div>
        )}
        <div className="flex justify-end gap-4 text-right font-semibold">
          Total: KES {formatKsh(data?.totals?.total ?? data?.total ?? 0)}
        </div>
        {depositValue > 0 && (
          <div className="flex justify-end gap-4 text-right">
            Deposit: KES {formatKsh(depositValue)}
          </div>
        )}
        {balanceValue > 0 && (
          <div className="flex justify-end gap-4 text-right text-amber-600">
            Balance due: KES {formatKsh(balanceValue)}
          </div>
        )}
      </div>

      <div className="mt-3 text-xs">
        <p>
          Payment method: <span className="font-semibold">{paymentLabel}</span>
        </p>
        {data?.notes && (
          <div className="mt-2 text-[12px]">
            <strong>Notes:</strong>
            <div className="mt-1" dangerouslySetInnerHTML={{ __html: simpleMarkdownToHtml(String(data.notes || "")) }} />
          </div>
        )}
        {(mpesaPaidAmount > 0 || cashPaidAmount > 0 || paymentReference) && (
          <div className="mt-2 space-y-0.5">
            <p className="font-semibold">Payment details</p>
            {mpesaPaidAmount > 0 && (
              <p>
                MPESA: KES {formatKsh(mpesaPaidAmount)}
                {paymentReference ? ` (Ref: ${paymentReference})` : ""}
              </p>
            )}
            {cashPaidAmount > 0 && <p>Cash: KES {formatKsh(cashPaidAmount)}</p>}
          </div>
        )}
      </div>

      {showFooter && (
        <div className="mt-auto border-t pt-3 text-center text-xs">
          <p>Thank you for shopping with Betech Solar Solutions. You were served by {servedBy}.</p>
          <p>Goods once sold cannot be refunded.</p>
          <div className="mt-4 flex items-center justify-center gap-2">
            <span>Official Stamp:</span>
            <span className="inline-block border-b w-48" />
          </div>
        </div>
      )}
    </div>
  );
}
