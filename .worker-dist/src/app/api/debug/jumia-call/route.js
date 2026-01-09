"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const server_1 = require("next/server");
const jumia_1 = require("@/lib/jumia");
// Simple debug route to call a small Jumia endpoint using the configured refresh flow.
// Returns sanitized preview of response (no tokens or secrets).
async function GET() {
    try {
        const j = await (0, jumia_1.jumiaFetch)('/catalog/products?size=5');
        // sanitize: remove any fields that look like tokens
        const preview = JSON.stringify(j, (_k, v) => {
            if (typeof v === 'string' && /token|secret|refresh/i.test(_k))
                return '****';
            return v;
        });
        return server_1.NextResponse.json({ ok: true, preview: JSON.parse(preview) });
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return server_1.NextResponse.json({ ok: false, error: msg }, { status: 502 });
    }
}
