"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authOptions = void 0;
const next_1 = __importDefault(require("next-auth/next"));
const google_1 = __importDefault(require("next-auth/providers/google"));
const prisma_1 = require("@/lib/prisma");
const auth_1 = require("@/lib/auth");
exports.authOptions = {
    providers: [
        (0, google_1.default)({
            clientId: process.env.GOOGLE_CLIENT_ID || "",
            clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
        }),
    ],
    callbacks: {
        // signIn: upsert user and force ADMIN for any configured ADMIN_EMAILS
        async signIn({ user }) {
            const emails = auth_1.ADMIN_EMAILS;
            const email = (user.email || "").toLowerCase();
            if (!email)
                return false;
            try {
                if (emails.includes(email)) {
                    // Force ADMIN
                    await prisma_1.prisma.user.upsert({
                        where: { email },
                        update: { role: "ADMIN", isActive: true },
                        create: { email, name: user.name ?? "Admin", image: user.image ?? "", role: "ADMIN", attendantCategory: "GENERAL", isActive: true },
                    });
                    return true;
                }
                // Default: ATTENDANT
                await prisma_1.prisma.user.upsert({
                    where: { email },
                    update: { role: "ATTENDANT", isActive: true },
                    create: { email, name: user.name ?? email.split("@")[0], image: user.image ?? "", role: "ATTENDANT", attendantCategory: "GENERAL", isActive: true },
                });
                return true;
            }
            catch {
                // If DB not ready, still allow sign-in but roles will be resolved later via fallback
                return true;
            }
        },
        // jwt: attach DB role to token (lookup by sub (id) or email)
        async jwt({ token, user }) {
            // ensure email is set on token when user logs in
            const t0 = token;
            if (user?.email)
                t0.email = user.email;
            const email = (t0.email || "").toLowerCase();
            // If it's the owner email, force ADMIN in the token (no DB needed)
            if (email === "kiokojackson81@gmail.com") {
                t0.role = "ADMIN";
                return token;
            }
            // Otherwise, best-effort fetch from DB; fall back to ATTENDANT if it fails
            try {
                let dbUser = null;
                const t = token;
                if (t.sub) {
                    dbUser = await prisma_1.prisma.user.findUnique({ where: { id: t.sub }, select: { role: true } });
                }
                if (!dbUser && t.email) {
                    dbUser = await prisma_1.prisma.user.findUnique({ where: { email: t.email.toLowerCase() }, select: { role: true } });
                }
                t0.role = dbUser?.role || "ATTENDANT";
            }
            catch {
                t0.role = "ATTENDANT";
            }
            return token;
        },
        // session: expose role from token
        async session({ session, token }) {
            const s = session;
            const t = token;
            if (!s.user)
                s.user = {};
            s.user.role = t.role ?? "ATTENDANT";
            return s;
        },
    },
    secret: process.env.NEXTAUTH_SECRET || process.env.SECRET || "",
};
exports.default = next_1.default;
