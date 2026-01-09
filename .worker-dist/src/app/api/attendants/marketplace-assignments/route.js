"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.GET = GET;
const server_1 = require("next/server");
const auth_1 = require("@/lib/auth");
const onlineOps_1 = require("@/lib/onlineOps");
exports.dynamic = "force-dynamic";
async function GET(req) {
    const guard = await (0, auth_1.requireAttendant)(req, ["ATTENDANT", "SUPERVISOR", "ADMIN"]);
    if (!guard.ok)
        return guard.res;
    try {
        const assignments = await (0, onlineOps_1.getMarketplaceAssignmentsForUser)(guard.user.id);
        const payload = assignments.assignments.map((assignment) => ({
            accountId: assignment.account.id,
            accountName: assignment.account.displayName,
            platform: assignment.account.platform,
            role: assignment.role,
            startsAt: assignment.startsAt?.toISOString() ?? null,
            endsAt: assignment.endsAt?.toISOString() ?? null,
        }));
        return server_1.NextResponse.json(payload);
    }
    catch (err) {
        console.error("[attendants/marketplace-assignments] failed to load assignments:", err);
        return server_1.NextResponse.json([], { status: 500 });
    }
}
