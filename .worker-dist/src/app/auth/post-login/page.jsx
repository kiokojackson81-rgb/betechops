"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = PostLogin;
const auth_1 = require("@/lib/auth");
const navigation_1 = require("next/navigation");
const ClientRedirect_1 = __importDefault(require("./ClientRedirect"));
async function PostLogin(props) {
    var _a;
    const { searchParams } = props;
    const session = await (0, auth_1.auth)();
    const role = (_a = session === null || session === void 0 ? void 0 : session.user) === null || _a === void 0 ? void 0 : _a.role;
    const intended = Array.isArray(searchParams === null || searchParams === void 0 ? void 0 : searchParams.intended)
        ? searchParams === null || searchParams === void 0 ? void 0 : searchParams.intended[0]
        : searchParams === null || searchParams === void 0 ? void 0 : searchParams.intended;
    // If we have a server-side session and role, validate and redirect.
    if (session && role) {
        if (intended === "admin" && role === "ADMIN")
            return (0, navigation_1.redirect)("/admin");
        if (intended === "attendant" && role !== "ADMIN")
            return (0, navigation_1.redirect)("/attendant");
        // Fall back to role-based routing
        if (role === "ADMIN")
            return (0, navigation_1.redirect)("/admin");
        return (0, navigation_1.redirect)("/attendant");
    }
    // If server session not available yet, render client redirect. The client
    // component will read `intended` from the URL search params (callbackUrl).
    return <ClientRedirect_1.default />;
}
