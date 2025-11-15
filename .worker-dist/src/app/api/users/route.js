"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
exports.POST = POST;
const server_1 = require("next/server");
const prisma_1 = require("@/lib/prisma");
const api_1 = require("@/lib/api");
const client_1 = require("@prisma/client");
const utils_1 = require("./utils");
async function GET(request) {
    const auth = await (0, api_1.requireRole)("ADMIN");
    if (!auth.ok)
        return auth.res;
    const url = new URL(request.url);
    const rawRoles = (url.searchParams.get("roles") || "ATTENDANT").split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
    const validRoles = rawRoles
        .map((role) => (role === "ADMIN" || role === "SUPERVISOR" || role === "ATTENDANT" ? role : null))
        .filter((role) => Boolean(role));
    const roles = validRoles.length ? validRoles : ["ATTENDANT"];
    const categoryParam = url.searchParams.get("category")?.toUpperCase() || undefined;
    const categoryFilter = categoryParam && utils_1.categoryValues.has(categoryParam) ? categoryParam : undefined;
    const includeInactive = url.searchParams.get("includeInactive") === "true";
    const users = await prisma_1.prisma.user.findMany({
        where: {
            role: { in: roles },
            ...(includeInactive ? {} : { isActive: true }),
            ...(categoryFilter
                ? {
                    OR: [
                        { attendantCategory: categoryFilter },
                        { categoryAssignments: { some: { category: categoryFilter } } },
                    ],
                }
                : {}),
        },
        orderBy: [{ attendantCategory: "asc" }, { name: "asc" }],
        select: {
            id: true,
            name: true,
            email: true,
            role: true,
            attendantCategory: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
            categoryAssignments: { select: { category: true } },
        },
    });
    return server_1.NextResponse.json(users.map(utils_1.shapeUser));
}
async function POST(request) {
    const auth = await (0, api_1.requireRole)("ADMIN");
    if (!auth.ok)
        return auth.res;
    const body = (await request.json().catch(() => ({})));
    const { email, name, role } = body;
    if (!email)
        return server_1.NextResponse.json({ error: "email required" }, { status: 400 });
    const normalizedEmail = email.toLowerCase().trim();
    const primaryCandidate = body.category?.toUpperCase();
    const fallbackPrimary = primaryCandidate && utils_1.categoryValues.has(primaryCandidate) ? primaryCandidate : client_1.AttendantCategory.GENERAL;
    const desiredCategories = (0, utils_1.sanitizeCategories)(body.categories ?? (primaryCandidate ? [primaryCandidate] : []), fallbackPrimary);
    const primaryCategory = desiredCategories[0] ?? client_1.AttendantCategory.GENERAL;
    const user = await prisma_1.prisma.$transaction(async (tx) => {
        const saved = await tx.user.upsert({
            where: { email: normalizedEmail },
            update: {
                name: name ?? undefined,
                role: role ?? undefined,
                isActive: true,
                attendantCategory: primaryCategory,
            },
            create: {
                email: normalizedEmail,
                name: name ?? normalizedEmail.split("@")[0],
                role: role ?? "ATTENDANT",
                attendantCategory: primaryCategory,
                isActive: true,
            },
        });
        await (0, utils_1.syncUserCategories)(tx, saved.id, desiredCategories);
        return tx.user.findUniqueOrThrow({
            where: { id: saved.id },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                attendantCategory: true,
                isActive: true,
                createdAt: true,
                updatedAt: true,
                categoryAssignments: { select: { category: true } },
            },
        });
    });
    return server_1.NextResponse.json({ ok: true, user: (0, utils_1.shapeUser)(user) }, { status: 201 });
}
