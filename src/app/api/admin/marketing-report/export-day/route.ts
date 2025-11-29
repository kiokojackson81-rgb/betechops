import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api";

export async function GET(req: Request) {
  const auth = await requireRole("ADMIN");
  if (!auth.ok) return auth.res;

  const url = new URL(req.url);
  const entryId = url.searchParams.get("entryId");
  if (!entryId) return NextResponse.json({ error: "entryId is required" }, { status: 400 });

  const entry = await prisma.marketingDailyEntry.findUnique({
    where: { id: entryId },
    include: { receipts: { include: { items: true } }, sales: true },
  });
  if (!entry) return NextResponse.json({ error: "Entry not found" }, { status: 404 });

  const rows: string[] = [];
  rows.push(["ReceiptNumber", "Product", "BuyingPrice", "ReceiptSellingTotal", "Profit", "PaymentMethod"].join(","));
  if (entry.receipts.length) {
    entry.receipts.forEach((r) => {
      const buyingSum = r.items.reduce((sum, it) => sum + (it.buyingPrice || 0), 0);
      const profit = (r.sellingTotal || 0) - buyingSum;
      if (r.items.length === 0) {
        rows.push([r.receiptNumber || "", "", "", r.sellingTotal, profit, r.paymentMethod].join(","));
      } else {
        r.items.forEach((it) => {
          rows.push([r.receiptNumber || "", it.productName, it.buyingPrice, r.sellingTotal, profit, r.paymentMethod].join(","));
        });
      }
    });
  } else {
    entry.sales.forEach((s) => {
      const profit = (s.sellingPrice || 0) - (s.buyingPrice || 0);
      rows.push([s.receiptNumber || "", s.product, s.buyingPrice, s.sellingPrice, profit, s.paymentMethod].join(","));
    });
  }
  const csv = rows.join("\n");
  const dateStr = entry.date.toISOString().split("T")[0];
  const filename = `marketing-sales-${dateStr}.csv`;
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
