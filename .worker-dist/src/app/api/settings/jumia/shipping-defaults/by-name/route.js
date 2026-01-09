"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.POST = POST;
const prisma_1 = require("@/lib/prisma");
const api_1 = require("@/lib/api");
exports.dynamic = "force-dynamic";
// POST /api/settings/jumia/shipping-defaults/by-name
// Body: { mappings: Array<{ providerId: string; label?: string; names: string[] }> }
// Resolves shop names (JUMIA only) to ids (exact match first, then contains) and persists defaults under key 'jumia:shipper-defaults'
async function POST(req) {
    const auth = await (0, api_1.requireRole)("ADMIN");
    if (!auth.ok)
        return auth.res;
    let body = {};
    try {
        body = (await req.json());
    }
    catch {
        return (0, api_1.noStoreJson)({ ok: false, error: "Invalid JSON body" }, { status: 400 });
    }
    const mappings = Array.isArray(body?.mappings) ? body.mappings : [];
    if (!mappings.length) {
        return (0, api_1.noStoreJson)({ ok: false, error: "mappings[] is required" }, { status: 400 });
    }
    // Load current defaults (if any)
    const row = await prisma_1.prisma.config.findUnique({ where: { key: "jumia:shipper-defaults" } }).catch(() => null);
    const defaults = (row?.json || {});
    const results = [];
    for (const map of mappings) {
        const names = Array.isArray(map.names) ? map.names : [];
        for (const nameRaw of names) {
            const name = String(nameRaw || "").trim();
            if (!name)
                continue;
            // Try exact (case-insensitive) first
            let shop = await prisma_1.prisma.shop.findFirst({ where: { platform: "JUMIA", name: { equals: name, mode: "insensitive" } }, select: { id: true, name: true } });
            if (!shop) {
                const matches = await prisma_1.prisma.shop.findMany({ where: { platform: "JUMIA", name: { contains: name, mode: "insensitive" } }, select: { id: true, name: true } });
                if (matches.length === 1)
                    shop = matches[0];
                else if (matches.length > 1) {
                    shop = matches.find((m) => m.name.toLowerCase() === name.toLowerCase()) || matches[0];
                }
            }
            if (!shop) {
                results.push({ name, providerId: map.providerId, label: map.label, status: "not-found" });
                continue;
            }
            defaults[shop.id] = { providerId: map.providerId, label: map.label };
            results.push({ name, shopId: shop.id, resolvedName: shop.name, providerId: map.providerId, label: map.label, status: "updated" });
        }
    }
    await prisma_1.prisma.config.upsert({ where: { key: "jumia:shipper-defaults" }, update: { json: defaults }, create: { key: "jumia:shipper-defaults", json: defaults } });
    return (0, api_1.noStoreJson)({ ok: true, saved: Object.keys(defaults).length, results });
}
