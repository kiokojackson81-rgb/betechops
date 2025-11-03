"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const server_1 = require("next/server");
const prisma_1 = require("@/lib/prisma");
const shops_1 = require("@/lib/rbac/shops");
async function POST(request, { params }) {
    var _a;
    // find return case
    const { id } = await params;
    const rc = await prisma_1.prisma.returnCase.findUnique({ where: { id } });
    if (!rc)
        return server_1.NextResponse.json({ error: 'not found' }, { status: 404 });
    const access = await (0, shops_1.requireShopAccess)({ shopId: rc.shopId, minRole: 'ATTENDANT' });
    if (!access.ok)
        return server_1.NextResponse.json({ error: 'forbidden' }, { status: 403 });
    const body = (await request.json().catch(() => ({})));
    const { evidence = [] } = body;
    // mark picked
    const updated = await prisma_1.prisma.returnCase.update({ where: { id }, data: { pickedAt: new Date(), status: 'picked_up' } });
    // store evidence rows if provided
    if (Array.isArray(evidence) && evidence.length) {
        const now = new Date();
        const actorId = (_a = access.actorId) !== null && _a !== void 0 ? _a : '';
        const rows = evidence.map((url) => ({ returnCaseId: id, type: 'photo', uri: url, sha256: '', takenBy: actorId, takenAt: now, geo: undefined }));
        await prisma_1.prisma.returnEvidence.createMany({ data: rows });
    }
    return server_1.NextResponse.json({ ok: true, updated });
}
