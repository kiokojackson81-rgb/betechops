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
const auth_1 = require("@/lib/auth");
const prisma_1 = require("@/lib/prisma");
const jwt = __importStar(require("jsonwebtoken"));
async function GET(req) {
    const session = await (0, auth_1.auth)();
    const email = session?.user?.email?.toLowerCase();
    if (!email)
        return server_1.NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    // If impersonateId is provided in the query and the current session is an ADMIN,
    // return the requested attendant's profile instead of the current user.
    try {
        const url = new URL(req.url);
        const impersonateId = url.searchParams.get("impersonateId");
        const role = session?.user?.role;
        if (impersonateId && role === "ADMIN") {
            const user = await prisma_1.prisma.user.findUnique({
                where: { id: impersonateId },
                select: {
                    id: true,
                    name: true,
                    email: true,
                    role: true,
                    attendantCategory: true,
                    isActive: true,
                    categoryAssignments: { select: { category: true } },
                },
            });
            if (user) {
                const { categoryAssignments, ...rest } = user;
                return server_1.NextResponse.json({ user: { ...rest, categories: categoryAssignments.map((c) => c.category) } });
            }
        }
    }
    catch (e) {
        // ignore and fallthrough to normal behaviour
    }
    // check for impersonation cookie
    try {
        const cookieHeader = (req.headers && req.headers?.get)
            ? req.headers.get("cookie")
            : "";
        const parseCookie = (name, header) => {
            if (!header)
                return undefined;
            const pairs = header.split(";").map((s) => s.trim());
            for (const p of pairs) {
                const idx = p.indexOf("=");
                if (idx === -1)
                    continue;
                const k = p.slice(0, idx);
                const v = p.slice(idx + 1);
                if (k === name)
                    return decodeURIComponent(v);
            }
            return undefined;
        };
        const imp = parseCookie("impersonation", cookieHeader);
        if (imp) {
            const secret = process.env.NEXTAUTH_SECRET || process.env.SECRET;
            if (secret) {
                try {
                    const payload = jwt.verify(imp, secret);
                    // verify that the cookie was issued by the same admin who is currently signed in
                    // find current admin id from email
                    const admin = await prisma_1.prisma.user.findUnique({ where: { email }, select: { id: true, role: true } });
                    if (admin && admin.role === "ADMIN" && payload?.a === admin.id) {
                        const targetId = payload?.t;
                        if (targetId) {
                            const user = await prisma_1.prisma.user.findUnique({
                                where: { id: targetId },
                                select: {
                                    id: true,
                                    name: true,
                                    email: true,
                                    role: true,
                                    attendantCategory: true,
                                    isActive: true,
                                    categoryAssignments: { select: { category: true } },
                                },
                            });
                            if (user) {
                                const { categoryAssignments, ...rest } = user;
                                return server_1.NextResponse.json({ user: { ...rest, categories: categoryAssignments.map((c) => c.category) } });
                            }
                        }
                    }
                }
                catch (e) {
                    // ignore invalid/expired token and fallback to normal session
                }
            }
        }
    }
    catch (e) {
        // ignore cookie read errors and fallback to normal session
    }
    const user = await prisma_1.prisma.user.findUnique({
        where: { email },
        select: {
            id: true,
            name: true,
            email: true,
            role: true,
            attendantCategory: true,
            isActive: true,
            categoryAssignments: { select: { category: true } },
        },
    });
    if (!user)
        return server_1.NextResponse.json({ error: "Not found" }, { status: 404 });
    const { categoryAssignments, ...rest } = user;
    return server_1.NextResponse.json({ user: { ...rest, categories: categoryAssignments.map((c) => c.category) } });
}
