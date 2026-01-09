"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const server_1 = require("next/server");
const auth_1 = require("@/lib/auth");
const getLandingPage_1 = __importDefault(require("@/lib/getLandingPage"));
async function GET(req) {
    const session = await (0, auth_1.auth)();
    const url = new URL(req.url);
    if (!session) {
        const original = url.pathname + url.search + url.hash;
        const loginUrl = new URL('/attendant/login', url);
        loginUrl.searchParams.set('callbackUrl', original);
        return server_1.NextResponse.redirect(loginUrl);
    }
    const role = session.user?.role ?? '';
    const category = session.user?.attendantCategory ?? null;
    const rawCallback = url.searchParams.get('callbackUrl') ?? url.searchParams.get('callback');
    let target = (0, getLandingPage_1.default)(category, role);
    if (rawCallback) {
        let decoded = rawCallback;
        try {
            for (let i = 0; i < 3; i++) {
                if (decoded.includes('%')) {
                    const next = decodeURIComponent(decoded);
                    if (next === decoded)
                        break;
                    decoded = next;
                }
                else {
                    break;
                }
            }
        }
        catch {
            decoded = rawCallback;
        }
        try {
            if (decoded.startsWith('/')) {
                target = decoded;
            }
            else {
                const cbUrl = new URL(decoded, url);
                if (cbUrl.origin === url.origin) {
                    target = cbUrl.pathname + cbUrl.search + cbUrl.hash;
                }
            }
        }
        catch {
            // keep default target
        }
    }
    const res = server_1.NextResponse.redirect(new URL(target, url));
    res.cookies.set('postlogin_done', '1', {
        maxAge: 60,
        httpOnly: false,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
    });
    return res;
}
