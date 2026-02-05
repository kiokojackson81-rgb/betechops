"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const server_1 = require("next/server");
const prisma_1 = require("@/lib/prisma");
// Public, non-secret diagnostic: enumerate shops and indicate whether per-shop
// credentials exist in DB (JSON on Shop, ApiCredential rows, or ShopApiConfig).
// Does NOT return secrets; only booleans and minimal strings like scope and apiBase host.
// GET /api/debug/shops-auth
async function GET() {
    try {
        const shops = await prisma_1.prisma.shop.findMany({
            orderBy: { name: 'asc' },
            include: { apiCredentials: true, apiConfig: true },
        });
        const rows = shops.map((s) => {
            const hasJson = !!s.credentialsEncrypted;
            const creds = Array.isArray(s.apiCredentials) ? s.apiCredentials : [];
            const hasApiCred = creds.length > 0;
            const cfg = s.apiConfig || null;
            const hasApiConfig = !!cfg;
            // summarize credentials without secrets
            const apiCredSummary = creds.map((c) => ({
                id: c.id,
                scope: c.scope,
                apiBase: c.apiBase || undefined,
                hasClientId: Boolean(c.clientId),
                hasRefreshToken: Boolean(c.refreshToken),
                createdAt: c.createdAt,
            }));
            return {
                id: s.id,
                name: s.name,
                platform: s.platform,
                hasCredentialsJson: hasJson,
                hasApiCredentialRow: hasApiCred,
                hasApiConfig,
                apiCredentials: apiCredSummary,
                apiConfig: cfg ? { id: cfg.id, apiKeySet: Boolean(cfg.apiKey), apiSecretSet: Boolean(cfg.apiSecret), createdAt: cfg.createdAt } : null,
            };
        });
        return server_1.NextResponse.json({ ok: true, shops: rows, count: rows.length, timestamp: new Date().toISOString() });
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return server_1.NextResponse.json({ ok: false, error: msg }, { status: 500 });
    }
}
