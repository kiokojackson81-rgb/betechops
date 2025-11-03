"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const server_1 = require("next/server");
const prisma_1 = require("@/lib/prisma");
const auth_1 = require("@/lib/auth");
const client_1 = require("@prisma/client");
async function POST(req) {
    var _a, _b, _c;
    const session = await (0, auth_1.auth)();
    const role = (_a = session === null || session === void 0 ? void 0 : session.user) === null || _a === void 0 ? void 0 : _a.role;
    const email = ((_c = (_b = session === null || session === void 0 ? void 0 : session.user) === null || _b === void 0 ? void 0 : _b.email) === null || _c === void 0 ? void 0 : _c.toLowerCase()) || "";
    if (!session || !role)
        return server_1.NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    try {
        const form = await req.formData();
        const orderId = String(form.get("orderId") || "");
        const notes = String(form.get("notes") || "");
        const photo = form.get("photo");
        if (!orderId)
            return server_1.NextResponse.json({ error: "orderId required" }, { status: 400 });
        const order = await prisma_1.prisma.order.findUnique({ where: { id: orderId }, select: { id: true, shopId: true } }).catch(() => null);
        if (!order)
            return server_1.NextResponse.json({ error: "Order not found" }, { status: 404 });
        // Enforce scope for non-admins: order.shopId must be in managed shops
        if (role !== client_1.Role.ADMIN && email) {
            const me = await prisma_1.prisma.user.findUnique({
                where: { email },
                select: { managedShops: { select: { id: true } } },
            });
            const allowed = new Set(((me === null || me === void 0 ? void 0 : me.managedShops) || []).map(s => s.id));
            if (!order.shopId || !allowed.has(order.shopId)) {
                return server_1.NextResponse.json({ error: "Forbidden" }, { status: 403 });
            }
        }
        // Try to persist to a ReturnCase model
        try {
            const me = email ? await prisma_1.prisma.user.findUnique({ where: { email }, select: { id: true } }) : null;
            const ret = await prisma_1.prisma.returnCase.create({ data: { orderId, shopId: order.shopId, reasonCode: "unknown", status: "requested", createdBy: (me === null || me === void 0 ? void 0 : me.id) || "" } });
            return server_1.NextResponse.json({ ok: true, id: ret.id });
        }
        catch (_d) {
            // If the model doesn't exist yet, accept and log
            console.log("Return submitted (accepted):", { orderId, notes, photo: photo ? { name: photo.name, size: photo.size } : null });
            return server_1.NextResponse.json({ ok: true, accepted: true }, { status: 202 });
        }
    }
    catch (err) {
        console.error(err);
        return server_1.NextResponse.json({ error: "Failed to submit return" }, { status: 500 });
    }
}
