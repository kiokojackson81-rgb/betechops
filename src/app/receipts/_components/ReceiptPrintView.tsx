"use client";
import React from "react";

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
  const servedBy =
    data?.attendantName ||
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
  const customerPhone = data?.customerPhone;

  return (
    <div
      className="border rounded-md p-6 text-sm bg-white text-black mx-auto"
      style={{ width: "210mm", minHeight: "279mm" }}
    >
      <div className="text-center mb-4">
        <h2 className="text-xs tracking-[0.35em] uppercase">{docHeading}</h2>
        <h1 className="text-2xl font-extrabold mt-2">BETECH SOLAR SOLUTIONS</h1>
        <p className="text-xs mt-1">Dealers in: Solar Solutions, Solar Products, e.t.c</p>
        <p className="text-[11px] mt-1">Tel: 0722 151 083 / 0703 241 917 - Pramukh Plaza 3rd Floor Shop No. 3</p>
        <p className="text-[11px]">Email: info@betech.co.ke - Website: www.betech.co.ke</p>
      </div>

      <div className="flex justify-between text-xs mb-2">
        <div>
          <span className="font-semibold">Date:</span> {date.toLocaleString()}
        </div>
        <div>
          <span className="font-semibold">{numberLabel}</span> {data?.serial}
        </div>
      </div>

      <div className="text-xs mb-4 space-y-1">
        <div>
          <span className="font-semibold">M/S:</span> {data?.customerName || "________________"}
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
                  {item.title}
                  {item.serial && (
                    <div className="text-[10px] text-slate-500">Serial / IMEI: {item.serial}</div>
                  )}
                </td>
                <td className="py-1 text-right">{formatKsh(unitPrice)}</td>
                <td className="py-1 text-right">{formatKsh(lineTotal)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="mt-4 text-sm space-y-1">
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

      <div className="mt-4 text-xs">
        <p>
          Payment method: <span className="font-semibold">{paymentLabel}</span>
        </p>
        {data?.paymentDetailsShown && (
          <div className="mt-1 space-y-0.5">
            <p>Paybill No. 516600</p>
            <p>Account No. 0710098001</p>
            <p>DTB Bank</p>
          </div>
        )}
      </div>

      {showFooter && (
        <div className="mt-8 text-center text-xs">
          <p>Thank you for shopping with Betech Solar Solutions. You were served by {servedBy}.</p>
          <p>Follow us on all social media platforms: @Betech Solar Solutions Kenya.</p>
          <div className="mt-6 flex justify-center items-center gap-2">
            <span>Official Stamp:</span>
            <span className="inline-block border-b w-48" />
          </div>
        </div>
      )}
    </div>
  );
}
