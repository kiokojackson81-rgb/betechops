"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveTargetUserId = resolveTargetUserId;
exports.composeIdentityResponse = composeIdentityResponse;
const next_1 = require("next-auth/next");
const nextAuth_1 = require("@/lib/nextAuth");
const DEFAULT_IMPERSONATION_ROLES = ["ADMIN", "SUPERVISOR"];
async function resolveTargetUserId(req, options) {
    const url = new URL(req.url);
    const impersonateQuery = url.searchParams.get("impersonateId") || "";
    const impersonateId = impersonateQuery.trim() || null;
    const session = await (0, next_1.getServerSession)(nextAuth_1.authOptions);
    const actorId = session?.user?.id ?? null;
    const actorRole = (session?.user?.role) ?? null;
    const allowedRoles = options?.allowedImpersonationRoles ?? DEFAULT_IMPERSONATION_ROLES;
    const canImpersonate = Boolean(impersonateId && actorId && actorRole && allowedRoles.includes(actorRole));
    const resolvedUserId = canImpersonate ? impersonateId : actorId;
    return {
        actorId,
        actorRole,
        impersonateId,
        resolvedUserId,
    };
}
function composeIdentityResponse(meta, data) {
    const response = { meta, data };
    Object.assign(response, data);
    return response;
}
