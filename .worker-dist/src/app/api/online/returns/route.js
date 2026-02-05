"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.GET = GET;
const server_1 = require("next/server");
const auth_1 = require("@/lib/auth");
const prisma_1 = require("@/lib/prisma");
const onlineOps_1 = require("@/lib/onlineOps");
exports.dynamic = "force-dynamic";
async function GET(req) {
    const auth = await (0, auth_1.requireAttendant)(req, ["JUMIA_KILIMALL_OPS", "BETECH_OPS", "SUPERVISOR", "ADMIN"]);
    if (!auth.ok)
        return auth.res;
    const { accountIds } = await (0, onlineOps_1.getMarketplaceAssignmentsForUser)(auth.user.id);
    if (!accountIds.length) {
        return server_1.NextResponse.json({ returns: [] });
    }
    const returns = await prisma_1.prisma.marketplaceReturn.findMany({
        where: {
            accountId: { in: accountIds },
        },
        include: {
            account: true,
            attachments: true,
        },
        orderBy: [{ createdAt: "desc" }],
    });
    const now = Date.now();
    return server_1.NextResponse.json({
        returns: returns.map((entry) => ({
            id: entry.id,
            accountName: entry.account.displayName,
            platform: entry.platform,
            orderItemId: entry.orderItemId,
            expectedAmount: Number(entry.expectedAmount ?? 0),
            status: entry.status,
            createdAt: entry.createdAt.toISOString(),
            dueAt: entry.dueAt.toISOString(),
            daysRemaining: Math.ceil((entry.dueAt.getTime() - now) / (1000 * 60 * 60 * 24)),
            notes: entry.notes,
            attachments: entry.attachments.map((att) => ({
                id: att.id,
                url: att.url,
                uploadedAt: att.createdAt.toISOString(),
            })),
        })),
    });
}
