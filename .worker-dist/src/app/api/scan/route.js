"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const server_1 = require("next/server");
async function POST(req) {
    try {
        const body = await req.json();
        const { code } = body !== null && body !== void 0 ? body : {};
        if (!code)
            return server_1.NextResponse.json({ action: 'INVALID', reason: 'no-code' }, { status: 400 });
        // Very small stub logic for demo purposes
        if (typeof code === 'string' && code.startsWith('ORD-')) {
            return server_1.NextResponse.json({ action: 'FIND_ORDER', orderId: code.replace('ORD-', '') });
        }
        if (typeof code === 'string' && code.startsWith('PKG-')) {
            return server_1.NextResponse.json({ action: 'CONFIRM_PACKAGE', packageId: code.replace('PKG-', '') });
        }
        return server_1.NextResponse.json({ action: 'UNKNOWN', code });
    }
    catch (err) {
        return new server_1.NextResponse(String(err), { status: 500 });
    }
}
