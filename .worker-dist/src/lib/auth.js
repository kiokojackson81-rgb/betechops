"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ADMIN_EMAILS = void 0;
exports.auth = auth;
exports.getSession = getSession;
const next_1 = require("next-auth/next");
const nextAuth_1 = require("@/lib/nextAuth");
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
