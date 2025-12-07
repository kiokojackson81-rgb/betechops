"use client";
import React from 'react';

export default function PrintControls({ receiptId }: { receiptId: string }) {
  return (
    <div className="mb-4">
      <button onClick={() => window.print()} className="px-3 py-1 bg-blue-600 text-white mr-2">Print</button>
      <a href={`/api/receipts/${receiptId}/send`} className="px-3 py-1 border">Send</a>
    </div>
  );
}
