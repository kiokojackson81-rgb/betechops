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
    const email = session?.user?.email?.toLowerCase() ?? null;
    const role = session?.user?.role;
    if (!email) {
        return server_1.NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const allowed = role === "ADMIN" || email === "jeniffer@betech.co.ke";
    if (!allowed) {
        return server_1.NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    let payload;
    try {
        payload = await req.json();
    }
    catch {
        return server_1.NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }
    const { saleId, source } = payload ?? {};
    if (!saleId || typeof saleId !== "string") {
        return server_1.NextResponse.json({ error: "saleId is required" }, { status: 400 });
    }
    if (source !== "daily-sale" && source !== "support") {
        return server_1.NextResponse.json({ error: "source must be daily-sale or support" }, { status: 400 });
    }
    try {
        if (source === "daily-sale") {
            const sale = await prisma_1.prisma.dailySale.findUnique({
                where: { id: saleId },
                include: { marketingSales: true },
            });
            if (!sale) {
                return server_1.NextResponse.json({ error: "Sale not found" }, { status: 404 });
            }
            if (sale.marketingSales.length > 0) {
                return server_1.NextResponse.json({ error: "Sale already priced" }, { status: 409 });
            }
            await prisma_1.prisma.dailySale.delete({ where: { id: saleId } });
            return server_1.NextResponse.json({ ok: true, removed: "daily-sale" });
        }
        const item = await prisma_1.prisma.supportReceiptItem.findUnique({
            where: { id: saleId },
        });
        if (!item) {
            return server_1.NextResponse.json({ error: "Support sale not found" }, { status: 404 });
        }
        if (item.buyingPrice > 0) {
            return server_1.NextResponse.json({ error: "Sale already has a buying price" }, { status: 409 });
        }
        await prisma_1.prisma.supportReceiptItem.delete({ where: { id: saleId } });
        return server_1.NextResponse.json({ ok: true, removed: "support" });
    }
    catch (err) {
        console.error("Failed to delete unpriced sale", err);
        return server_1.NextResponse.json({ error: "Failed to delete sale" }, { status: 500 });
    }
}
