"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserShops = getUserShops;
exports.upsertAssignments = upsertAssignments;
exports.can = can;
const prisma_1 = require("./prisma");
async function getUserShops(userId) {
    return prisma_1.prisma.shopAssignment.findMany({ where: { userId }, include: { shop: true } });
}
async function upsertAssignments(userId, entries) {
    return prisma_1.prisma.$transaction(async (tx) => {
        await tx.shopAssignment.deleteMany({ where: { userId } });
        const data = entries.map((e) => ({ ...e, userId }));
        if (data.length === 0)
            return [];
        return tx.shopAssignment.createMany({ data, skipDuplicates: true });
    });
}
function can(user, action) {
    const map = {
        VIEW_QUEUES: ['ATTENDANT', 'SUPERVISOR', 'ADMIN'],
        PACK: ['ATTENDANT', 'SUPERVISOR', 'ADMIN'],
        RTS: ['ATTENDANT', 'SUPERVISOR', 'ADMIN'],
        CANCEL: ['SUPERVISOR', 'ADMIN'],
        ASSIGN: ['SUPERVISOR', 'ADMIN'],
    };
    return map[action]?.includes(user.role) ?? false;
}
const assignments = { getUserShops, upsertAssignments, can };
exports.default = assignments;
