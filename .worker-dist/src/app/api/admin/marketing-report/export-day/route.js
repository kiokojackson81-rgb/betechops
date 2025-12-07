"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const server_1 = require("next/server");
const prisma_1 = require("@/lib/prisma");
const api_1 = require("@/lib/api");
const toNumber = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
};
async function GET(req) {
    const auth = await (0, api_1.requireRole)("ADMIN");
    if (!auth.ok)
        return auth.res;
    const url = new URL(req.url);
    const entryId = url.searchParams.get("entryId");
    if (!entryId)
        return server_1.NextResponse.json({ error: "entryId is required" }, { status: 400 });
    const entry = await prisma_1.prisma.marketingDailyEntry.findUnique({
        where: { id: entryId },
        include: { receipts: { include: { items: true } }, sales: true },
    });
    const rows = [];
    rows.push(["ReceiptNumber", "Product", "BuyingPrice", "ReceiptSellingTotal", "Profit", "PaymentMethod"].join(","));
    if (entry) {
        if (entry.receipts.length) {
            entry.receipts.forEach((r) => {
                const buyingSum = r.items.reduce((sum, it) => sum + (it.buyingPrice || 0), 0);
                const profit = (r.sellingTotal || 0) - buyingSum;
                if (r.items.length === 0) {
                    rows.push([r.receiptNumber || "", "", "", r.sellingTotal, profit, r.paymentMethod].join(","));
                }
                else {
                    r.items.forEach((it) => {
                        rows.push([r.receiptNumber || "", it.productName, it.buyingPrice, r.sellingTotal, profit, r.paymentMethod].join(","));
                    });
                }
            });
        }
        else {
            entry.sales.forEach((s) => {
                const profit = (s.sellingPrice || 0) - (s.buyingPrice || 0);
                rows.push([s.receiptNumber || "", s.product, s.buyingPrice, s.sellingPrice, profit, s.paymentMethod].join(","));
            });
        }
        const csv = rows.join("\n");
        const dateStr = entry.date.toISOString().split("T")[0];
        const filename = `marketing-sales-${dateStr}.csv`;
        return new server_1.NextResponse(csv, {
            status: 200,
            headers: {
                "Content-Type": "text/csv",
                "Content-Disposition": `attachment; filename="${filename}"`,
            },
        });
    }
    const dailyEntry = await prisma_1.prisma.dailyReport.findUnique({
        where: { id: entryId },
        include: { sales: true },
    });
    if (!dailyEntry)
        return server_1.NextResponse.json({ error: "Entry not found" }, { status: 404 });
    const totalSales = toNumber(dailyEntry.totalSales);
    const totalCost = (dailyEntry.sales || []).reduce((sum, sale) => sum + toNumber(sale.price), 0);
    const profit = totalSales - totalCost;
    if (dailyEntry.sales && dailyEntry.sales.length > 0) {
        dailyEntry.sales.forEach((sale) => {
            rows.push([
                sale.receiptNumber || dailyEntry.id,
                sale.productName,
                toNumber(sale.price),
                totalSales,
                profit,
                sale.paymentMethod ?? "",
            ].join(","));
        });
    }
    else {
        rows.push([dailyEntry.id, "", "", totalSales, profit, ""].join(","));
    }
    const csv = rows.join("\n");
    const dateStr = dailyEntry.date.toISOString().split("T")[0];
    const filename = `attendant-sales-${dateStr}.csv`;
    return new server_1.NextResponse(csv, {
        status: 200,
        headers: {
            "Content-Type": "text/csv",
            "Content-Disposition": `attachment; filename="${filename}"`,
        },
    });
}
