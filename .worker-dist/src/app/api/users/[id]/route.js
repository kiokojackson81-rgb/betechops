"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PATCH = PATCH;
const server_1 = require("next/server");
const prisma_1 = require("@/lib/prisma");
const api_1 = require("@/lib/api");
const utils_1 = require("../utils");
async function PATCH(request) {
    const auth = await (0, api_1.requireRole)("ADMIN");
    if (!auth.ok)
        return auth.res;
    const pathname = new URL(request.url).pathname;
    const id = pathname.substring(pathname.lastIndexOf("/") + 1);
    if (!id)
        return server_1.NextResponse.json({ error: "missing_id" }, { status: 400 });
    const body = (await request.json().catch(() => ({})));
    const hasPrimitiveUpdate = typeof body.isActive === "boolean" || Boolean(body.role) || Boolean(body.name) || Boolean(body.attendantCategory);
    const includesCategoryUpdate = Array.isArray(body.categories);
    if (!hasPrimitiveUpdate && !includesCategoryUpdate) {
        return server_1.NextResponse.json({ error: "no_updates" }, { status: 400 });
    }
    const attendantCategoryUpdate = body.attendantCategory
        ? (utils_1.categoryValues.has(body.attendantCategory.toUpperCase())
            ? body.attendantCategory.toUpperCase()
            : null)
        : null;
    if (body.attendantCategory && !attendantCategoryUpdate) {
        return server_1.NextResponse.json({ error: "invalid_category" }, { status: 400 });
    }
    try {
        const updated = await prisma_1.prisma.$transaction(async (tx) => {
            const existing = await tx.user.findUnique({
                where: { id },
                select: {
                    id: true,
                    attendantCategory: true,
                },
            });
            if (!existing) {
                throw new Error("not_found");
            }
            const fallbackPrimary = attendantCategoryUpdate ?? existing.attendantCategory;
            const desiredAssignments = includesCategoryUpdate
                ? (0, utils_1.sanitizeCategories)(body.categories ?? [], fallbackPrimary)
                : null;
            const data = {};
            if (typeof body.isActive === "boolean")
                data.isActive = body.isActive;
            if (body.role)
                data.role = body.role;
            if (body.name)
                data.name = body.name;
            if (desiredAssignments && desiredAssignments.length) {
                data.attendantCategory = desiredAssignments[0];
            }
            else if (attendantCategoryUpdate) {
                data.attendantCategory = attendantCategoryUpdate;
            }
            const saved = await tx.user.update({
                where: { id },
                data,
                select: {
                    id: true,
                },
            });
            if (desiredAssignments) {
                await (0, utils_1.syncUserCategories)(tx, saved.id, desiredAssignments);
            }
            else if (attendantCategoryUpdate) {
                await tx.attendantCategoryAssignment.upsert({
                    where: { userId_category: { userId: saved.id, category: attendantCategoryUpdate } },
                    update: {},
                    create: { userId: saved.id, category: attendantCategoryUpdate },
                });
            }
            return tx.user.findUniqueOrThrow({
                where: { id: saved.id },
                select: {
                    id: true,
                    name: true,
                    email: true,
                    role: true,
                    attendantCategory: true,
                    isActive: true,
                    updatedAt: true,
                    categoryAssignments: { select: { category: true } },
                },
            });
        });
        return server_1.NextResponse.json({ ok: true, user: (0, utils_1.shapeUser)(updated) });
    }
    catch (err) {
        if (err instanceof Error && err.message === "not_found") {
            return server_1.NextResponse.json({ error: "not_found" }, { status: 404 });
        }
        return server_1.NextResponse.json({ error: "update_failed", detail: err instanceof Error ? err.message : String(err) }, { status: 500 });
    }
}
