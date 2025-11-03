"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const api_1 = require("@/lib/api");
const prisma_1 = require("@/lib/prisma");
const zod_1 = require("zod");
async function GET(req) {
    const auth = await (0, api_1.requireRole)(["ADMIN", "SUPERVISOR"]);
    if (!auth.ok)
        return auth.res;
    const { searchParams } = new URL(req.url);
    const schema = zod_1.z.object({
        shopId: zod_1.z.string().optional(),
        staffId: zod_1.z.string().optional(),
        from: zod_1.z.coerce.date().optional(),
        to: zod_1.z.coerce.date().optional(),
        status: zod_1.z.enum(["pending", "approved", "reversed"]).optional(),
        page: zod_1.z.coerce.number().int().min(1).default(1),
        size: zod_1.z.coerce.number().int().min(1).max(200).default(50),
    });
    const parsed = schema.safeParse(Object.fromEntries(searchParams.entries()));
    if (!parsed.success)
        return (0, api_1.noStoreJson)({ error: parsed.error.flatten() }, { status: 400 });
    const { shopId, staffId, from, to, status, page, size } = parsed.data;
    const where = {};
    if (status)
        where.status = status;
    if (staffId)
        where.staffId = staffId;
    if (from || to)
        where.createdAt = { gte: from, lte: to };
    if (shopId)
        where.orderItem = { order: { shopId } };
    const [items, total] = await Promise.all([
        prisma_1.prisma.commissionEarning.findMany({
            where,
            include: { orderItem: { include: { order: true, product: true } }, staff: true },
            orderBy: { createdAt: "desc" },
            skip: (page - 1) * size,
            take: size,
        }),
        prisma_1.prisma.commissionEarning.count({ where }),
    ]);
    return (0, api_1.noStoreJson)({ items, page, size, total });
}
