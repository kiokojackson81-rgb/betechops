import { NextResponse } from "next/server";
import { pushOpsEventToChatraceInternal } from "@/lib/chatraceInternal";

export async function GET() {
  const result = await pushOpsEventToChatraceInternal({
    tagName: "ops_receipt_created",
    fields: {
      receipt_number: "DEBUG-000",
      amount: 0,
      payment_method: "DEBUG",
      staff_name: "Debug User",
      items_short: "1) Widget x1",
      receipt_link: "https://ops.betech.co.ke/receipts/debug",
    },
  });
  return NextResponse.json({ ok: result.ok, debug: result.debug });
}
