"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
exports.POST = POST;
const server_1 = require("next/server");
const prisma_1 = require("@/lib/prisma");
const api_1 = require("@/lib/api");
const categories_1 = require("@/lib/attendants/categories");
const metricValues = new Set(Object.keys(categories_1.ATTENDANT_ACTIVITY_METRICS));
async function GET(request) {
    const auth = await (0, api_1.requireRole)(["ATTENDANT", "SUPERVISOR", "ADMIN"]);
    if (!auth.ok)
        return auth.res;
    const actorId = await (0, api_1.getActorId)();
    if (!actorId)
        return server_1.NextResponse.json({ error: "actor_not_found" }, { status: 403 });
    const url = new URL(request.url);
    const requestedUserId = url.searchParams.get("userId") || undefined;
    const metric = url.searchParams.get("metric") || undefined;
    const take = Math.min(100, Math.max(1, Number(url.searchParams.get("take") || 20)));
    const userId = auth.role === "ADMIN" && requestedUserId ? requestedUserId : actorId;
    const where = {
        userId,
        ...(metric && metricValues.has(metric) ? { metric } : {}),
    };
    const items = await prisma_1.prisma.attendantActivity.findMany({
        where,
        orderBy: { entryDate: "desc" },
        take,
    });
    return server_1.NextResponse.json(items);
}
async function POST(request) {
    const auth = await (0, api_1.requireRole)(["ATTENDANT", "SUPERVISOR", "ADMIN"]);
    if (!auth.ok)
        return auth.res;
    const actorId = await (0, api_1.getActorId)();
    if (!actorId)
        return server_1.NextResponse.json({ error: "actor_not_found" }, { status: 403 });
    const body = (await request.json().catch(() => ({})));
    const metric = body.metric?.toUpperCase();
    if (!metric || !metricValues.has(metric)) {
        return server_1.NextResponse.json({ error: "invalid_metric" }, { status: 400 });
    }
    const user = await prisma_1.prisma.user.findUnique({
        where: { id: actorId },
        select: { attendantCategory: true, categoryAssignments: { select: { category: true } } },
    });
    if (!user)
        return server_1.NextResponse.json({ error: "user_not_found" }, { status: 404 });
    const categoryPool = user.categoryAssignments.map((c) => c.category);
    if (!categoryPool.includes(user.attendantCategory))
        categoryPool.unshift(user.attendantCategory);
    const requestedCategory = body.category?.toUpperCase() || undefined;
    const effectiveCategory = requestedCategory && categoryPool.includes(requestedCategory)
        ? requestedCategory
        : categoryPool[0] ?? user.attendantCategory;
    const numericValue = typeof body.numericValue === "number" && Number.isFinite(body.numericValue) ? Number(body.numericValue.toFixed(2)) : undefined;
    const intValue = typeof body.intValue === "number" && Number.isInteger(body.intValue) ? body.intValue : undefined;
    if (numericValue === undefined && intValue === undefined) {
        return server_1.NextResponse.json({ error: "missing_value" }, { status: 400 });
    }
    let entryDate;
    if (body.entryDate) {
        const parsed = new Date(body.entryDate);
        if (!Number.isFinite(parsed.valueOf())) {
            return server_1.NextResponse.json({ error: "invalid_date" }, { status: 400 });
        }
        entryDate = parsed;
    }
    const record = await prisma_1.prisma.attendantActivity.create({
        data: {
            userId: actorId,
            category: effectiveCategory,
            metric,
            numericValue: numericValue ?? null,
            intValue: intValue ?? null,
            notes: body.notes?.slice(0, 500) ?? null,
            entryDate: entryDate ?? new Date(),
        },
    });
    return server_1.NextResponse.json({ ok: true, activity: record }, { status: 201 });
}
