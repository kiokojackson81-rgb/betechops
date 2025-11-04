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
    const { searchParams } = props;
    const session = await (0, auth_1.auth)();
    const role = session?.user?.role;
    const intended = Array.isArray(searchParams?.intended)
        ? searchParams?.intended[0]
        : searchParams?.intended;
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
