"use client";
import React from "react";
import Link from "next/link";

export default function ReceiptDuplicateModal({ owner, onClose }: { owner: any; onClose: () => void }) {
  if (!owner) return null;

  const renderOwnerInfo = () => {
    switch (owner.type) {
      case "pos":
        return (
          <div className="space-y-2">
            <p>Existing POS receipt found.</p>
            <p className="text-sm">Order: <strong>{owner.ref}</strong></p>
            <p className="text-sm">Receipt ID: <strong>{owner.id}</strong></p>
            <div className="flex gap-2">
              <Link className="btn-primary px-3 py-1" href={`/receipts/${owner.id}`} target="_blank" rel="noopener noreferrer">Open receipt</Link>
              <Link className="border px-3 py-1" href={`/orders/${owner.ref}`} target="_blank" rel="noopener noreferrer">Open order</Link>
            </div>
          </div>
        );
      case "marketing":
        return (
          <div className="space-y-2">
            <p>Existing marketing receipt found.</p>
            <p className="text-sm">Marketing record ID: <strong>{owner.id}</strong></p>
            <p className="text-sm">Daily entry ID: <strong>{owner.entryId}</strong></p>
            <div className="flex gap-2">
              <button className="btn-primary px-3 py-1" onClick={() => { navigator.clipboard?.writeText(owner.id); }}>Copy ID</button>
            </div>
          </div>
        );
      case "support":
        return (
          <div className="space-y-2">
            <p>Existing support receipt found.</p>
            <p className="text-sm">Support receipt ID: <strong>{owner.id}</strong></p>
            <p className="text-sm">Daily entry ID: <strong>{owner.entryId}</strong></p>
            <div className="flex gap-2">
              <button className="btn-primary px-3 py-1" onClick={() => { navigator.clipboard?.writeText(owner.id); }}>Copy ID</button>
            </div>
          </div>
        );
      default:
        return <div>Receipt already exists.</div>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-lg bg-white p-6 text-black">
        <h3 className="text-lg font-semibold">Duplicate receipt detected</h3>
        <div className="mt-4">{renderOwnerInfo()}</div>
        <div className="mt-6 flex justify-end gap-2">
          <button className="rounded-md border px-3 py-1" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
