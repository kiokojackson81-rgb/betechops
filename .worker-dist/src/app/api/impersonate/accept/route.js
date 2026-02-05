"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const server_1 = require("next/server");
const jwt = __importStar(require("jsonwebtoken"));
const auth_1 = require("@/lib/auth");
const prisma_1 = require("@/lib/prisma");
async function GET(req) {
    const url = new URL(req.url);
    const token = url.searchParams.get("token") || "";
    if (!token)
        return server_1.NextResponse.json({ error: "token required" }, { status: 400 });
    const session = await (0, auth_1.auth)();
    const email = session?.user?.email?.toLowerCase();
    if (!email)
        return server_1.NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    // verify admin identity from db
    const admin = await prisma_1.prisma.user.findUnique({ where: { email }, select: { id: true, role: true } });
    if (!admin || admin.role !== "ADMIN")
        return server_1.NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const secret = process.env.NEXTAUTH_SECRET || process.env.SECRET;
    if (!secret)
        return server_1.NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
    try {
        const payload = jwt.verify(token, secret);
        // payload.a is admin id, payload.t is target id
        if (!payload || payload.a !== admin.id)
            return server_1.NextResponse.json({ error: "Invalid token" }, { status: 403 });
        // set short-lived httpOnly cookie and redirect to attendant dashboard
        const res = server_1.NextResponse.redirect(new URL("/attendant", req.url));
        // cookie expires in 5 minutes
        res.cookies.set({ name: "impersonation", value: token, httpOnly: true, path: "/", secure: process.env.NODE_ENV === "production", maxAge: 60 * 5, sameSite: "lax" });
        return res;
    }
    catch (err) {
        return server_1.NextResponse.json({ error: "Invalid or expired token" }, { status: 403 });
    }
}
