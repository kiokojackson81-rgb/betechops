"use client";
import React from 'react';

export default function PrintControls({ receiptId }: { receiptId: string }) {
  return (
    <div className="mb-4">
      <button onClick={() => window.print()} className="px-3 py-1 bg-blue-600 text-white mr-2">Print</button>
      <a href={`/api/receipts/${receiptId}/send?channels=email`} className="px-3 py-1 border mr-2">Send via e-mail</a>
      <button
        onClick={() => {
          // Placeholder: WhatsApp sending will be implemented later.
          fetch(`/api/receipts/${receiptId}/send?channels=whatsapp`, { method: 'POST' }).catch(() => {});
          alert('WhatsApp send queued (placeholder)');
        }}
        className="px-3 py-1 border bg-green-600 text-white"
      >
        Send via WhatsApp
      </button>
    </div>
  );
}
