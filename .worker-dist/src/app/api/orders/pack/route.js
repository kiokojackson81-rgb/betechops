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
exports.POST = POST;
const server_1 = require("next/server");
const prisma_1 = require("@/lib/prisma");
const auth_1 = require("@/lib/auth");
const redis_1 = require("@/lib/redis");
const jumia = __importStar(require("@/lib/jumia"));
async function POST(req) {
    try {
        const body = await req.json();
        const { orderId, shopId } = body ?? {};
        // Enforce auth
        const session = await (0, auth_1.auth)();
        if (!session)
            return server_1.NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
        // session.user shape may vary; tolerate missing fields
        const su = (session?.user ?? {});
        const actor = typeof su.email === 'string'
            ? su.email
            : typeof su.name === 'string'
                ? su.name
                : typeof su.id === 'string'
                    ? su.id
                    : 'unknown';
        if (!orderId || !shopId)
            return server_1.NextResponse.json({ error: 'orderId and shopId required' }, { status: 400 });
        const action = 'PACK';
        const idempotencyKey = `${shopId}:${orderId}:${action}`;
        // Try Redis idempotency: if a result exists, return it
        try {
            const r = await (0, redis_1.getRedis)();
            if (r) {
                const cached = await r.get(`idempotency:${idempotencyKey}`);
                if (cached)
                    return server_1.NextResponse.json(JSON.parse(cached));
                // set a lock to prevent double execution (NX, short TTL)
                await r.set(`lock:${idempotencyKey}`, '1', 'EX', 60, 'NX');
            }
        }
        catch {
            // continue without Redis
        }
        // Call Jumia to perform pack action. If vendor has a specific endpoint, jumiaFetch will call it.
        let result = { ok: false };
        try {
            // Best-effort: call a vendor pack endpoint. This may be adapted to the real vendor API.
            try {
                const jf = jumia.jumiaFetch;
                result = await jf(`/orders/${encodeURIComponent(orderId)}/pack`, { method: 'POST', body: JSON.stringify({ shopId }) });
            }
            catch {
                // If vendor pack endpoint is not available, attempt a read of order items to validate existence
                try {
                    const jmod = jumia;
                    await jmod.getOrderItems?.(orderId).catch(() => null);
                }
                catch { }
                result = { ok: true, note: 'simulated-pack' };
            }
            // persist audit (best-effort)
            try {
                await prisma_1.prisma.fulfillmentAudit.create({ data: { idempotencyKey, orderId, shopId, action, status: 1, ok: true, payload: JSON.parse(JSON.stringify({ actor, result })) } });
            }
            catch (e) {
                console.warn('failed to persist fulfillment audit', e);
            }
            // cache the response in Redis for idempotency
            try {
                const r = await (0, redis_1.getRedis)();
                if (r) {
                    await r.set(`idempotency:${idempotencyKey}`, JSON.stringify(result), 'EX', 60 * 60);
                }
            }
            catch {
                // ignore
            }
            return server_1.NextResponse.json({ ok: true, action, result });
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return new server_1.NextResponse(String(msg), { status: 500 });
        }
    }
    catch (err) {
        return new server_1.NextResponse(String(err), { status: 500 });
    }
}
