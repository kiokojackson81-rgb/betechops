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
        const data = entries.map((e) => (Object.assign(Object.assign({}, e), { userId })));
        if (data.length === 0)
            return [];
        return tx.shopAssignment.createMany({ data, skipDuplicates: true });
    });
}
function can(user, action) {
    var _a, _b;
    const map = {
        VIEW_QUEUES: ['ATTENDANT', 'SUPERVISOR', 'ADMIN'],
        PACK: ['ATTENDANT', 'SUPERVISOR', 'ADMIN'],
        RTS: ['ATTENDANT', 'SUPERVISOR', 'ADMIN'],
        CANCEL: ['SUPERVISOR', 'ADMIN'],
        ASSIGN: ['SUPERVISOR', 'ADMIN'],
    };
    return (_b = (_a = map[action]) === null || _a === void 0 ? void 0 : _a.includes(user.role)) !== null && _b !== void 0 ? _b : false;
}
const assignments = { getUserShops, upsertAssignments, can };
exports.default = assignments;
