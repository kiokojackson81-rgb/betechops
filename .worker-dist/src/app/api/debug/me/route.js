"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const server_1 = require("next/server");
const auth_1 = require("@/lib/auth");
async function GET() {
    var _a, _b, _c, _d;
    const s = await (0, auth_1.auth)();
    const sess = s;
    return server_1.NextResponse.json({ email: (_b = (_a = sess === null || sess === void 0 ? void 0 : sess.user) === null || _a === void 0 ? void 0 : _a.email) !== null && _b !== void 0 ? _b : null, role: (_d = (_c = sess === null || sess === void 0 ? void 0 : sess.user) === null || _c === void 0 ? void 0 : _c.role) !== null && _d !== void 0 ? _d : null });
}
