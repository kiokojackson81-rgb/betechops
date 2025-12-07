"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = PostLogin;
const jsx_runtime_1 = require("react/jsx-runtime");
const auth_1 = require("@/lib/auth");
const navigation_1 = require("next/navigation");
const ClientRedirect_1 = __importDefault(require("./ClientRedirect"));
const getLandingPage_1 = __importDefault(require("@/lib/getLandingPage"));
const prisma_1 = require("@/lib/prisma");
async function PostLogin(props) {
    const { searchParams } = props;
    const session = await (0, auth_1.auth)();
    const role = session?.user?.role;
    const intended = Array.isArray(searchParams?.intended)
        ? searchParams?.intended[0]
        : searchParams?.intended;
    // If we have a server-side session and role, validate and redirect.
    if (session && role) {
        // If a `callbackUrl` param is present (encoded previously by
        // middleware), prefer server-side redirect to that exact path.
        const cbRaw = Array.isArray(searchParams?.callbackUrl)
            ? (searchParams?.callbackUrl)[0]
            : searchParams?.callbackUrl;
        if (cbRaw) {
            try {
                const decoded = decodeURIComponent(cbRaw);
                // Only allow same-origin paths.
                if (decoded && decoded.startsWith("/")) {
                    return (0, navigation_1.redirect)(decoded);
                }
            }
            catch (e) {
                // ignore malformed callbackUrl and continue with normal flow
            }
        }
        if (intended === "admin" && role === "ADMIN")
            return (0, navigation_1.redirect)("/admin");
        if (intended === "attendant" && role !== "ADMIN")
            return (0, navigation_1.redirect)("/attendant");
        // If not explicit, compute canonical landing using the attendant category
        if (role === "ADMIN")
            return (0, navigation_1.redirect)("/admin");
        // Prefer the DB value when possible so stale or missing session fields don't
        // cause a default redirect to `/attendant`. We still fall back to the
        // session value if DB lookup fails or no email is available.
        let category = session.user?.attendantCategory ?? null;
        if (session.user?.email && role !== "ADMIN") {
            try {
                const u = await prisma_1.prisma.user.findUnique({
                    where: { email: session.user.email },
                    select: { attendantCategory: true },
                });
                // Use DB value when present, otherwise keep whatever the session had.
                category = u?.attendantCategory ?? category;
            }
            catch (e) {
                // ignore DB errors and continue with the session value
            }
        }
        const landing = (0, getLandingPage_1.default)(category, role);
        return (0, navigation_1.redirect)(landing);
    }
    // If server session not available yet, render client redirect. The client
    // component will read `intended` from the URL search params (callbackUrl).
    return (0, jsx_runtime_1.jsx)(ClientRedirect_1.default, {});
}
