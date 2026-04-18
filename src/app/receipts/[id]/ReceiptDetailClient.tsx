"use client";

import { showToast } from "@/lib/ui/toast";
import ReceiptPaymentMethodEditor from "./ReceiptPaymentMethodEditor";

type Props = {
  receiptId: string;
  html: string;
  canEditPaymentMethod: boolean;
  initialPaymentMethod: "MPESA" | "CASH";
};

export default function ReceiptDetailClient({
  receiptId,
  html,
  canEditPaymentMethod,
  initialPaymentMethod,
}: Props) {
  return (
    <div className="mx-auto bg-transparent p-0 text-black">
      <div className="no-print mb-4 flex flex-nowrap items-center gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => window.print()}
          className="shrink-0 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white"
        >
          Print
        </button>
        <button
          type="button"
          onClick={() => {
            fetch(`/api/receipts/${receiptId}/send?channels=whatsapp`, { method: "POST" }).catch(() => {});
            showToast("WhatsApp send queued", "success");
          }}
          className="shrink-0 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white"
        >
          Send via WhatsApp
        </button>
        {canEditPaymentMethod ? (
          <ReceiptPaymentMethodEditor
            receiptId={receiptId}
            initialPaymentMethod={initialPaymentMethod}
            className="mb-0"
          />
        ) : null}
      </div>

      <div dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
