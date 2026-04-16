"use client";

import { useState } from "react";
import { showToast } from "@/lib/ui/toast";

type Props = {
  receiptId: string;
  initialPaymentMethod: "MPESA" | "CASH";
};

export default function ReceiptPaymentMethodEditor({ receiptId, initialPaymentMethod }: Props) {
  const [paymentMethod, setPaymentMethod] = useState<"MPESA" | "CASH">(initialPaymentMethod);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/receipts/${receiptId}/payment-method`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentMethod }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to update payment method");
      showToast("Payment method updated", "success");
      window.location.reload();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to update payment method", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="no-print mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      <span className="text-sm font-medium text-slate-700">Payment method</span>
      <div className="flex overflow-hidden rounded-lg border border-slate-300 bg-white">
        {(["MPESA", "CASH"] as const).map((method) => {
          const active = paymentMethod === method;
          return (
            <button
              key={method}
              type="button"
              onClick={() => setPaymentMethod(method)}
              className={`px-4 py-2 text-sm ${active ? "bg-emerald-500 font-semibold text-white" : "text-slate-700 hover:bg-slate-100"}`}
            >
              {method}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={save}
        disabled={saving || paymentMethod === initialPaymentMethod}
        className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-400"
      >
        {saving ? "Saving..." : "Save payment method"}
      </button>
    </div>
  );
}
