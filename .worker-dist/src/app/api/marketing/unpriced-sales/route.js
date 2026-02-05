"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.GET = GET;
const server_1 = require("next/server");
const next_1 = require("next-auth/next");
const nextAuth_1 = require("@/lib/nextAuth");
const marketingUnpricedSales_1 = require("@/lib/marketingUnpricedSales");
exports.dynamic = "force-dynamic";
async function GET() {
    const session = (await (0, next_1.getServerSession)(nextAuth_1.authOptions));
    if (!session?.user) {
        return server_1.NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const role = session.user.role;
    const attendantCategory = session.user.attendantCategory;
    if (role !== "ADMIN" && attendantCategory !== "DIRECT_SALES_OPS") {
        return server_1.NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const sales = await (0, marketingUnpricedSales_1.getUnpricedDailySalesForCurrentPeriod)();
    return server_1.NextResponse.json({ sales });
}
