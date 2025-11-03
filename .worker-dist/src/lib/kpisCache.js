"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readKpisCache = readKpisCache;
exports.writeKpisCache = writeKpisCache;
exports.isKpisCacheWarm = isKpisCacheWarm;
const redis_1 = require("@/lib/redis");
const prisma_1 = require("@/lib/prisma");
const KEY = 'kpis:cross-shops';
// Cache TTL for KPIs: vendor APIs apply strict rate limits, so avoid hammering.
// Pending orders still refresh via the local DB fallback; products can be a bit stale.
// Choose ~10 minutes to balance freshness and rate limits.
const TTL_SECONDS = 600;
let mem = null;
async function readKpisCache() {
    try {
        if (mem && Date.now() - mem.updatedAt < TTL_SECONDS * 1000)
            return mem;
        // Prefer DB persistent cache so serverless instances share values
        try {
            if (process.env.NODE_ENV !== 'test') {
                const row = await prisma_1.prisma.config.findUnique({ where: { key: KEY } });
                if (row === null || row === void 0 ? void 0 : row.json) {
                    const parsed = row.json;
                    if ((parsed === null || parsed === void 0 ? void 0 : parsed.updatedAt) && Date.now() - Number(parsed.updatedAt) < TTL_SECONDS * 1000) {
                        mem = parsed;
                        return parsed;
                    }
                }
            }
        }
        catch (_a) { }
        // Fallback to Redis (if available)
        const r = await (0, redis_1.getRedis)();
        if (r) {
            const raw = await r.get(KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                mem = parsed;
                return parsed;
            }
        }
        return mem;
    }
    catch (_b) {
        return mem;
    }
}
async function writeKpisCache(value) {
    mem = value;
    try {
        // Persist in DB for cross-instance availability (skip in unit tests)
        if (process.env.NODE_ENV !== 'test') {
            await prisma_1.prisma.config.upsert({
                where: { key: KEY },
                update: { json: value },
                create: { key: KEY, json: value },
            });
        }
    }
    catch (_a) { }
    try {
        const r = await (0, redis_1.getRedis)();
        if (!r)
            return;
        // best-effort: ioredis set signature supports EX seconds when passed as object or args
        // we use the most permissive unknown[] typing in our helper, so call as variadic
        await r.set(KEY, JSON.stringify(value), 'EX', TTL_SECONDS);
    }
    catch (_b) {
        // ignore failures; memory fallback remains
    }
}
function isKpisCacheWarm() {
    return Boolean(mem && Date.now() - mem.updatedAt < TTL_SECONDS * 1000) || (0, redis_1.isRedisAvailable)();
}
