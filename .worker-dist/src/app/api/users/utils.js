"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.categoryValues = void 0;
exports.sanitizeCategories = sanitizeCategories;
exports.syncUserCategories = syncUserCategories;
exports.shapeUser = shapeUser;
const client_1 = require("@prisma/client");
exports.categoryValues = new Set(Object.values(client_1.AttendantCategory));
function sanitizeCategories(input, fallback) {
    const raw = Array.isArray(input)
        ? input
        : typeof input === "string"
            ? input.split(",")
            : [];
    const normalized = raw
        .map((value) => (typeof value === "string" ? value : String(value)).trim().toUpperCase())
        .filter((value) => exports.categoryValues.has(value))
        .map((value) => value);
    const set = new Set(normalized);
    if (!set.size)
        set.add(fallback);
    return Array.from(set);
}
async function syncUserCategories(tx, userId, categories) {
    await tx.attendantCategoryAssignment.deleteMany({
        where: { userId, category: { notIn: categories } },
    });
    await Promise.all(categories.map((category) => tx.attendantCategoryAssignment.upsert({
        where: { userId_category: { userId, category } },
        update: {},
        create: { userId, category },
    })));
}
function shapeUser(user) {
    const { categoryAssignments, ...rest } = user;
    return { ...rest, categories: categoryAssignments.map((item) => item.category) };
}
