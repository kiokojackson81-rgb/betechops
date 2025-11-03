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
            var _a, _b, _c, _d;
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
                        create: { email, name: (_a = user.name) !== null && _a !== void 0 ? _a : "Admin", image: (_b = user.image) !== null && _b !== void 0 ? _b : "", role: "ADMIN", isActive: true },
                    });
                    return true;
                }
                // Default: ATTENDANT
                await prisma_1.prisma.user.upsert({
                    where: { email },
                    update: { role: "ATTENDANT", isActive: true },
                    create: { email, name: (_c = user.name) !== null && _c !== void 0 ? _c : email.split("@")[0], image: (_d = user.image) !== null && _d !== void 0 ? _d : "", role: "ATTENDANT", isActive: true },
                });
                return true;
            }
            catch (_e) {
                // If DB not ready, still allow sign-in but roles will be resolved later via fallback
                return true;
            }
        },
        // jwt: attach DB role to token (lookup by sub (id) or email)
        async jwt({ token, user }) {
            // ensure email is set on token when user logs in
            const t0 = token;
            if (user === null || user === void 0 ? void 0 : user.email)
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
                t0.role = (dbUser === null || dbUser === void 0 ? void 0 : dbUser.role) || "ATTENDANT";
            }
            catch (_a) {
                t0.role = "ATTENDANT";
            }
            return token;
        },
        // session: expose role from token
        async session({ session, token }) {
            var _a;
            const s = session;
            const t = token;
            if (!s.user)
                s.user = {};
            s.user.role = (_a = t.role) !== null && _a !== void 0 ? _a : "ATTENDANT";
            return s;
        },
    },
    secret: process.env.NEXTAUTH_SECRET || process.env.SECRET || "",
};
exports.default = next_1.default;
