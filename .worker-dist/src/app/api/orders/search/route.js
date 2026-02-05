"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const server_1 = require("next/server");
const assignments_1 = require("@/lib/assignments");
async function GET(request) {
    try {
        const userId = request.headers.get('x-user-id') || request.headers.get('x-cc-user') || 'anonymous';
        const shops = await (0, assignments_1.getUserShops)(userId);
        // Stub: return shops and an empty orders list. Real implementation will query provider.
        return server_1.NextResponse.json({ shops, orders: [] });
    }
    catch (err) {
        return new server_1.NextResponse(String(err), { status: 500 });
    }
}
