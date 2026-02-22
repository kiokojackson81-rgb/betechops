import { NextRequest, NextResponse } from "next/server";
import { pushInternalReceiptAlert } from "@/lib/chatraceInternalFixed";
import { pushReceiptToChatrace } from "@/lib/integrations/chatrace";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const account = (url.searchParams.get("account") || "internal").toLowerCase().trim();
  const toPhone = (url.searchParams.get("phone") || "").toString().trim();
  const tagName = (url.searchParams.get("tag") || "receipt_admin_alert").toString().trim();

  // This route is used for verifying Chatrace credentials + Flow triggers.
  // It does not create a real receipt; it only upserts contact fields and applies the tag.
  const receiptNumber = url.searchParams.get("receiptNumber") || `DEBUG-${Date.now()}`;
  const customerName = url.searchParams.get("customerName") || "Debug Customer";
  const customerPhone = url.searchParams.get("customerPhone") || "254700000000";
  const amount = url.searchParams.get("amount") || "100";
  const paymentMethod = url.searchParams.get("paymentMethod") || "MPESA";
  const createdBy = url.searchParams.get("createdBy") || "Debug User";
  const adminItems = url.searchParams.get("adminItems") || "1) Debug item x1";
  const totalSalesToday = url.searchParams.get("totalSalesToday") || "999";

  if (account === "main") {
    const result = await pushReceiptToChatrace({
      phoneE164: (toPhone || customerPhone).replace(/[^0-9+]/g, ""),
      customerName: "Admin",
      receiptNumber,
      amount: String(amount),
      currency: "KES",
      receiptLink: "https://ops.betech.co.ke/receipts/debug",
      tagName,
      skipDefaultTags: true,
      extraFields: {
        receipt_number: receiptNumber,
        customer_name: customerName,
        customer_phone: customerPhone,
        formatted_amount: Number(String(amount).replace(/[^0-9.-]/g, "")) || 0,
        payment_method: paymentMethod,
        created_by: createdBy,
        admin_items: adminItems,
        total_sales_today: Number(String(totalSalesToday).replace(/[^0-9.-]/g, "")) || 0,
      },
    });
    return NextResponse.json({ ok: result.ok, debug: result.debug, mode: "main" });
  }

  const result = await pushInternalReceiptAlert({
    requestId: "debug",
    toPhone: toPhone || undefined,
    tagName,
    receiptNumber,
    amount: String(amount),
    formattedAmount: Number(String(amount).replace(/[^0-9.-]/g, "")) || 0,
    paymentMethod,
    createdBy,
    itemsText: adminItems,
    customerName,
    customerPhone,
    totalSalesToday: Number(String(totalSalesToday).replace(/[^0-9.-]/g, "")) || 0,
  });
  return NextResponse.json({ ok: result.ok, debug: result.debug, mode: "internal" });
}
