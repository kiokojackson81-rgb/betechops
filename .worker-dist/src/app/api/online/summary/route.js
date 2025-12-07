"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.GET = GET;
const server_1 = require("next/server");
const auth_1 = require("@/lib/auth");
const onlineOps_1 = require("@/lib/onlineOps");
exports.dynamic = "force-dynamic";
async function GET(req) {
    const auth = await (0, auth_1.requireAttendant)(req, ["JUMIA_KILIMALL_OPS", "BETECH_OPS", "SUPERVISOR", "ADMIN"]);
    if (!auth.ok)
        return auth.res;
    const stats = await (0, onlineOps_1.getOnlineQuickStats)(auth.user.id);
    return server_1.NextResponse.json({ stats });
}
