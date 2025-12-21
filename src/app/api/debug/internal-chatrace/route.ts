import { NextResponse } from "next/server";
import { pushInternalReceiptAlert } from "@/lib/chatraceInternal";

export async function GET() {
  const result = await pushInternalReceiptAlert({
    requestId: "debug",
    receiptNumber: "DEBUG-000",
    amount: "0",
    paymentMethod: "DEBUG",
    createdBy: "Debug User",
    itemsText: "1) Widget x1",
    receiptLink: "https://ops.betech.co.ke/receipts/debug",
  });
  return NextResponse.json({ ok: result.ok, debug: result.debug });
}
