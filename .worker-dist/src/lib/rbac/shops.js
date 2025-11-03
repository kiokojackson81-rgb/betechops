"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireShopAccess = requireShopAccess;
const prisma_1 = require("@/lib/prisma");
const api_1 = require("@/lib/api");
const auth_1 = require("@/lib/auth");
async function requireShopAccess(opts) {
    var _a;
    // Admins bypass shop checks
    const adminCheck = await (0, api_1.requireRole)(['ADMIN']);
    if (adminCheck.ok)
        return { ok: true, actor: adminCheck.session };
    // get session directly for non-admin flows
    const session = await (0, auth_1.auth)();
    const email = String(((_a = session === null || session === void 0 ? void 0 : session.user) === null || _a === void 0 ? void 0 : _a.email) || '').toLowerCase();
    if (!email)
        return { ok: false, res: { error: 'Unauthorized' } };
    const user = await prisma_1.prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (!user)
        return { ok: false, res: { error: 'Unauthorized' } };
    const assignment = (await prisma_1.prisma.userShop.findUnique({ where: { userId_shopId: { userId: user.id, shopId: opts.shopId } } }).catch(() => null));
    if (!assignment)
        return { ok: false, res: { error: 'Forbidden' } };
    // role hierarchy: SUPERVISOR > ATTENDANT
    const map = { ATTENDANT: 1, SUPERVISOR: 2 };
    const have = map[assignment.roleAtShop || ''] || 0;
    const need = opts.minRole ? map[opts.minRole] : 1;
    if (have < need)
        return { ok: false, res: { error: 'Forbidden' } };
    return { ok: true, actorId: user.id };
}
