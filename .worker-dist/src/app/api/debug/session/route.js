"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.GET = GET;
const server_1 = require("next/server");
const next_1 = require("next-auth/next");
const nextAuth_1 = require("@/lib/nextAuth");
exports.dynamic = "force-dynamic";
async function GET(req) {
    const session = await (0, next_1.getServerSession)(nextAuth_1.authOptions);
    const cookieHeader = req.headers.get("cookie") ?? null;
    if (!session) {
        return server_1.NextResponse.json({ error: "Unauthorized", hasCookie: !!cookieHeader }, { status: 401 });
    }
    // Only return minimal session info to avoid leaking sensitive fields.
    const safeUser = {
        id: session.user?.id,
        email: session.user?.email,
        name: session.user?.name,
        role: session.user?.role,
    };
    return server_1.NextResponse.json({ user: safeUser, hasCookie: !!cookieHeader });
}
