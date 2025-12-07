"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ADMIN_EMAILS = void 0;
exports.auth = auth;
exports.getSession = getSession;
exports.requireAttendant = requireAttendant;
const server_1 = require("next/server");
const next_1 = require("next-auth/next");
const categoryCompat_1 = require("@/lib/attendants/categoryCompat");
const nextAuth_1 = require("@/lib/nextAuth");
const prisma_1 = require("@/lib/prisma");
// `NextAuthOptions` type may vary between next-auth versions; use a local alias
// to avoid accidental type imports that don't exist in some versions.
// ADMIN_EMAILS: comma-separated list of emails that should be treated as ADMIN
exports.ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "kiokojackson81@gmail.com")
    .split(",")
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
/**
 * Small helper to return the server session in server components/pages.
 */
async function auth() {
    // next-auth types can vary between versions; cast to any in this narrow spot
    // to avoid build-time type incompatibilities while preserving runtime behavior.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return await (0, next_1.getServerSession)(nextAuth_1.authOptions);
}
// Simple auth helper for audit logging (placeholder until we wire real audit/session data)
function getSession() {
    return {
        id: "default-attendant",
        role: "attendant",
    };
}
const ROLE_LABELS = new Set(["ADMIN", "SUPERVISOR", "ATTENDANT"]);
async function requireAttendant(req, allowed = []) {
    const session = await auth();
    if (!session) {
        return { ok: false, res: server_1.NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
    }
    const sessionRole = session.user?.role ?? null;
    const sessionEmail = session.user?.email?.toLowerCase() ?? null;
    const sessionUserId = session.user?.id ?? null;
    let impersonateId = null;
    try {
        const url = new URL(req.url);
        impersonateId = url.searchParams.get("impersonateId");
    }
    catch {
        // ignore malformed URLs and proceed without impersonation
    }
    let targetUser = null;
    let impersonated = false;
    async function fetchUserByIdOrEmail(opts) {
        // Use a raw SQL query that casts the enum to text to avoid Prisma trying
        // to parse enum labels that don't match the Prisma schema. Return null if
        // no user found.
        try {
            if (opts.id) {
                const rows = await prisma_1.prisma.$queryRaw `
          SELECT id, role, "attendantCategory"::text AS "attendantCategory", "isActive"
          FROM "User"
          WHERE id = ${opts.id}
          LIMIT 1
        `;
                return rows[0] ?? null;
            }
            if (opts.email) {
                const rows = await prisma_1.prisma.$queryRaw `
          SELECT id, role, "attendantCategory"::text AS "attendantCategory", "isActive"
          FROM "User"
          WHERE lower(email) = lower(${opts.email})
          LIMIT 1
        `;
                return rows[0] ?? null;
            }
            return null;
        }
        catch (err) {
            console.error("fetchUserByIdOrEmail failed:", err);
            return null;
        }
    }
    if (impersonateId && sessionRole === "ADMIN") {
        targetUser = await fetchUserByIdOrEmail({ id: impersonateId });
        impersonated = Boolean(targetUser);
    }
    if (!targetUser) {
        if (sessionUserId) {
            targetUser = await fetchUserByIdOrEmail({ id: sessionUserId });
        }
        if (!targetUser && sessionEmail) {
            targetUser = await fetchUserByIdOrEmail({ email: sessionEmail });
        }
    }
    if (!targetUser) {
        return { ok: false, res: server_1.NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
    }
    const normalizedCategory = (0, categoryCompat_1.normalizeCategory)(targetUser.attendantCategory);
    if (normalizedCategory) {
        targetUser.attendantCategory = normalizedCategory;
    }
    const allowedNormalized = allowed.map((entry) => (entry ? entry.toString().trim() : entry)).filter(Boolean);
    const allowedRoles = allowedNormalized.filter((entry) => ROLE_LABELS.has(entry.toUpperCase()));
    const allowedCategories = allowedNormalized.filter((entry) => !ROLE_LABELS.has(entry.toUpperCase()));
    const roleAllowed = allowedRoles.length === 0 ? true : allowedRoles.includes(sessionRole ?? "") || allowedRoles.includes(targetUser.role);
    const categoryAllowed = allowedCategories.length === 0
        ? true
        : (0, categoryCompat_1.isCategoryAllowed)(normalizedCategory ?? targetUser.attendantCategory, allowedCategories);
    if (!roleAllowed && !categoryAllowed) {
        return { ok: false, res: server_1.NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
    }
    return {
        ok: true,
        user: targetUser,
        role: sessionRole,
        session,
        impersonated,
    };
}
