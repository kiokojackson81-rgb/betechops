import React from 'react';
import { prisma } from '@/lib/prisma';
import PrintControls from './PrintControls';

export const dynamic = 'force-dynamic';

export default async function Page({ params }: { params: { id: string } }) {
  const id = params.id;
  const receipt = await prisma.receipt.findUnique({ where: { id }, include: { order: { include: { items: true } }, issuedBy: true } });
  if (!receipt) return <div className="p-4">Receipt not found</div>;

  const data = receipt.data as any || {};

  return (
    <div className="p-6 max-w-3xl mx-auto bg-white text-black">
      <PrintControls receiptId={id} />
      <header className="mb-4">
        <h1 className="text-2xl font-bold">Receipt</h1>
        <div>Ref: {receipt.order?.orderNumber}</div>
        <div>Date: {new Date(receipt.generatedAt).toLocaleString()}</div>
        <div>Issued by: {receipt.issuedBy?.name ?? data.issuedByName ?? '—'}</div>
      </header>

      <section>
        <h2 className="text-lg font-semibold">Items</h2>
        <table className="w-full border-collapse">
          <thead>
            <tr><th className="border p-1">Item</th><th className="border p-1">Qty</th><th className="border p-1">Unit</th><th className="border p-1">Serial</th><th className="border p-1">Warranty</th></tr>
          </thead>
          <tbody>
            {(receipt.order?.items || []).map((it: any) => (
              <tr key={it.id}><td className="border p-1">{it.title || it.productName}</td><td className="border p-1">{it.quantity}</td><td className="border p-1">{it.sellingPrice}</td><td className="border p-1">{it.serial}</td><td className="border p-1">{it.warranty}</td></tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mt-4 text-right">
        <div>Subtotal: {(receipt.totals as any)?.subtotal ?? ''}</div>
        <div>Tax: {(receipt.totals as any)?.tax ?? ''}</div>
        <div className="text-xl font-semibold">Total: {(receipt.totals as any)?.total ?? ''}</div>
      </section>

      {data.fileUrl && (
        <section className="mt-4">
          <a href={data.fileUrl} target="_blank" rel="noreferrer" className="text-blue-600">Download PDF</a>
        </section>
      )}
    </div>
  );
}
