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
    include: { sales: true },
  });
  if (!entry) return NextResponse.json({ error: "Entry not found" }, { status: 404 });

  const rows: string[] = [];
  rows.push(["Product", "BuyingPrice", "SellingPrice", "Profit", "ItemsCount", "Receipt", "PaymentMethod"].join(","));
  entry.sales.forEach((s) => {
    const profit = (s.sellingPrice || 0) - (s.buyingPrice || 0);
    rows.push([s.product, s.buyingPrice, s.sellingPrice, profit, (s as any).itemsCount ?? 1, s.receiptNumber || "", s.paymentMethod].join(","));
  });
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
