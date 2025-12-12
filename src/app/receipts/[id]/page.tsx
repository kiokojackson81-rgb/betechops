import React from "react";
import { prisma } from "@/lib/prisma";
import PrintControls from "./PrintControls";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: { id: string } }) {
  const id = params?.id;
  if (!id) {
    // Defensive: avoid throwing a Prisma validation error if params are missing.
    return <div className="p-4">Invalid receipt identifier</div>;
  }

  let receipt = null;
  try {
    receipt = await prisma.receipt.findUnique({
      where: { id },
      include: { order: { include: { items: true, layawayPlan: { include: { payments: true } }, attendant: { select: { name: true } } } }, issuedBy: true },
    });
  } catch (err) {
    // Catch and render a friendly message instead of allowing a server exception to surface.
    // Log the error server-side for diagnostics (kept minimal here).
    // eslint-disable-next-line no-console
    console.error("[receipts page] failed to load receipt", err);
    return <div className="p-4">Failed to load receipt</div>;
  }
  if (!receipt) return <div className="p-4">Receipt not found</div>;

  const data = (receipt.data as any) || {};
  const totals = (receipt.totals as any) || {};
  const balance = totals.balance ?? receipt.order?.layawayPlan?.balance ?? 0;

  return (
    <div className="mx-auto max-w-3xl bg-white p-6 text-black">
      <PrintControls receiptId={id} />
      <header className="mb-4 space-y-1">
        <h1 className="text-2xl font-bold">Receipt</h1>
        <div>Ref: {receipt.order?.orderNumber}</div>
        <div>Date: {new Date(receipt.generatedAt).toLocaleString()}</div>
        <div>Customer: {receipt.order?.customerName || data.customerName || "-"}</div>
        <div>Phone: {receipt.order?.customerPhone || data.customerPhone || "-"}</div>
        <div>Issued by: {receipt.issuedBy?.name ?? data.issuedByName ?? "-"}</div>
        <div>Served by: {receipt.order?.attendant?.name ?? "-"}</div>
      </header>

      <section className="mb-3">
        <h2 className="text-lg font-semibold">Items</h2>
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="border p-1">Item</th>
              <th className="border p-1">Qty</th>
              <th className="border p-1">Unit</th>
              <th className="border p-1">Serial</th>
              <th className="border p-1">Warranty</th>
            </tr>
          </thead>
          <tbody>
            {(receipt.order?.items || []).map((it: any) => (
              <tr key={it.id}>
                <td className="border p-1">{it.title || it.productName}</td>
                <td className="border p-1">{it.quantity}</td>
                 <td className="border p-1">{String(it.sellingPrice ?? "")}</td>
                <td className="border p-1">{it.serial}</td>
                <td className="border p-1">{it.warranty}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mt-4 space-y-1 text-right">
        <div>Subtotal: {totals.subtotal ?? ""}</div>
        <div>Tax: {totals.tax ?? ""}</div>
         <div>Discount: {String(receipt.discount ?? 0)}</div>
        <div className="text-xl font-semibold">Total: {totals.total ?? ""}</div>
        {receipt.docType === "LAYAWAY" && <div className="text-amber-700">Balance: {balance}</div>}
      </section>

      {receipt.paymentDetailsShown && (
        <section className="mt-4 rounded border border-slate-200 p-3">
          <p className="text-sm font-semibold">Payment details</p>
          <p className="text-sm">Pay via M-Pesa Paybill: 516600 Account: 0710 098 001</p>
        </section>
      )}

      {receipt.notes && (
        <section className="mt-4">
          <p className="font-semibold">Notes</p>
          <p>{receipt.notes}</p>
        </section>
      )}

      {receipt.warrantyText && (
        <section className="mt-2">
          <p className="font-semibold">Warranty</p>
          <p>{receipt.warrantyText}</p>
        </section>
      )}

      <section className="mt-4 text-sm text-slate-700">
        Thank you for shopping with Betech Solar Solutions. You were served by {receipt.order?.attendant?.name || "____"}. Good once sold cannot be refunded
        <div className="mt-2">Official Stamp: __________________________</div>
      </section>

      {data.fileUrl && (
        <section className="mt-4">
          <a href={data.fileUrl} target="_blank" rel="noreferrer" className="text-blue-600">Download PDF</a>
        </section>
      )}
    </div>
  );
}
