"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.POST = POST;
const server_1 = require("next/server");
const next_1 = require("next-auth/next");
const nextAuth_1 = require("@/lib/nextAuth");
const prisma_1 = require("@/lib/prisma");
exports.dynamic = "force-dynamic";
async function POST(req) {
    const session = (await (0, next_1.getServerSession)(nextAuth_1.authOptions));
    const email = session?.user?.email?.toLowerCase();
    const role = session?.user?.role;
    if (!email) {
        return server_1.NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const allowed = role === "ADMIN" || email === "jeniffer@betech.co.ke";
    if (!allowed) {
        return server_1.NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const actor = await prisma_1.prisma.user.findUnique({ where: { email }, select: { id: true, name: true, email: true } });
    if (!actor) {
        return server_1.NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    let payload;
    try {
        payload = await req.json();
    }
    catch {
        return server_1.NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }
    const { dailySaleId, buyingPrice } = payload ?? {};
    if (!dailySaleId || typeof dailySaleId !== "string") {
        return server_1.NextResponse.json({ error: "dailySaleId is required" }, { status: 400 });
    }
    if (!Number.isFinite(buyingPrice) || buyingPrice <= 0) {
        return server_1.NextResponse.json({ error: "buyingPrice must be a positive number" }, { status: 400 });
    }
    const sale = await prisma_1.prisma.dailySale.findUnique({
        where: { id: dailySaleId },
        include: {
            dailyReport: {
                include: { user: { select: { id: true, name: true, email: true } } },
            },
            marketingSales: true,
        },
    });
    if (!sale) {
        return server_1.NextResponse.json({ error: "Daily sale not found" }, { status: 404 });
    }
    if (sale.marketingSales.length > 0) {
        return server_1.NextResponse.json({ error: "Sale already priced" }, { status: 409 });
    }
    const reportDate = sale.dailyReport?.date ?? sale.createdAt;
    const dayStart = new Date(reportDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);
    const entryDay = sale.dailyReport?.day ?? dayStart.toLocaleDateString("en-KE", { weekday: "long" });
    let entry = await prisma_1.prisma.marketingDailyEntry.findFirst({
        where: {
            submittedById: actor.id,
            date: {
                gte: dayStart,
                lt: dayEnd,
            },
        },
    });
    if (!entry) {
        entry = await prisma_1.prisma.marketingDailyEntry.create({
            data: {
                date: new Date(reportDate),
                dayOfWeek: entryDay,
                submittedById: actor.id,
                submittedByName: session?.user?.name ?? actor.name ?? null,
                submittedByEmail: session?.user?.email ?? actor.email ?? null,
            },
        });
    }
    const sellingPrice = Math.round(Number(sale.price));
    const roundedBuyingPrice = Math.round(buyingPrice);
    const paymentMethod = (sale.paymentMethod === "CASH" ? "CASH" : "MPESA");
    const receiptNumber = sale.receiptNumber && sale.receiptNumber.trim() !== "" ? sale.receiptNumber.trim() : null;
    try {
        const marketingSale = await prisma_1.prisma.$transaction(async (tx) => {
            const createdSale = await tx.marketingSale.create({
                data: {
                    entryId: entry.id,
                    dailySaleId: sale.id,
                    product: sale.productName,
                    buyingPrice: roundedBuyingPrice,
                    sellingPrice,
                    receiptNumber: receiptNumber ?? undefined,
                    paymentMethod,
                    itemsCount: 1,
                },
            });
            await tx.marketingDailyEntry.update({
                where: { id: entry.id },
                data: {
                    totalSales: { increment: sellingPrice },
                    totalProfit: { increment: sellingPrice - roundedBuyingPrice },
                },
            });
            if (receiptNumber) {
                const existingReceipt = await tx.marketingReceipt.findFirst({
                    where: {
                        dailyEntryId: entry.id,
                        receiptNumber,
                    },
                });
                if (existingReceipt) {
                    await tx.marketingReceipt.update({
                        where: { id: existingReceipt.id },
                        data: {
                            sellingTotal: { increment: sellingPrice },
                            items: {
                                create: [
                                    {
                                        productName: sale.productName,
                                        buyingPrice: roundedBuyingPrice,
                                    },
                                ],
                            },
                        },
                    });
                }
                else {
                    await tx.marketingReceipt.create({
                        data: {
                            dailyEntryId: entry.id,
                            receiptNumber,
                            sellingTotal: sellingPrice,
                            paymentMethod,
                            items: {
                                create: [
                                    {
                                        productName: sale.productName,
                                        buyingPrice: roundedBuyingPrice,
                                    },
                                ],
                            },
                        },
                    });
                }
            }
            else {
                await tx.marketingReceipt.create({
                    data: {
                        dailyEntryId: entry.id,
                        sellingTotal: sellingPrice,
                        paymentMethod,
                        items: {
                            create: [
                                {
                                    productName: sale.productName,
                                    buyingPrice: roundedBuyingPrice,
                                },
                            ],
                        },
                    },
                });
            }
            return createdSale;
        });
        return server_1.NextResponse.json({
            ok: true,
            marketingSaleId: marketingSale.id,
            saleValue: sellingPrice,
            profit: sellingPrice - roundedBuyingPrice,
        });
    }
    catch (error) {
        console.error("Failed to price sale", error);
        return server_1.NextResponse.json({ error: "Failed to price sale" }, { status: 500 });
    }
}
