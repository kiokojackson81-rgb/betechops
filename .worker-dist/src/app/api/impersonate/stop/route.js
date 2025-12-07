"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const server_1 = require("next/server");
async function GET() {
    const res = server_1.NextResponse.redirect(new URL("/admin", "http://localhost"));
    res.cookies.set({ name: "impersonation", value: "", httpOnly: true, path: "/", maxAge: 0, sameSite: "lax" });
    return res;
}
