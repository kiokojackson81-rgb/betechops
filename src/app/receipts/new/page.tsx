import React from "react";
import ReceiptFormClient from "./ReceiptFormClient";

export const dynamic = "force-dynamic";

export default function NewReceiptPage() {
  return (
    <main className="max-w-5xl mx-auto p-4">
      <ReceiptFormClient />
    </main>
  );
}

