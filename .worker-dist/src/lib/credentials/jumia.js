"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadJumiaCredentials = loadJumiaCredentials;
const prisma_1 = require("@/lib/prisma");
const DEFAULT_SCOPE = "JUMIA_VENDOR";
async function loadJumiaCredentials(scope = DEFAULT_SCOPE) {
    const envClientId = process.env.JUMIA_CLIENT_ID?.trim();
    const envRefreshToken = process.env.JUMIA_REFRESH_TOKEN?.trim();
    if (envClientId && envRefreshToken) {
        return {
            source: "env",
            clientId: envClientId,
            clientSecret: process.env.JUMIA_CLIENT_SECRET?.trim() ?? null,
            refreshToken: envRefreshToken,
            baseUrl: process.env.JUMIA_VENDOR_API_BASE?.trim() ?? null,
            authScheme: process.env.JUMIA_AUTH_SCHEME?.trim() ?? null,
        };
    }
    const credential = await prisma_1.prisma.apiCredential.findFirst({
        where: { scope },
        orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    });
    if (credential?.clientId && credential.refreshToken) {
        return {
            source: "db",
            credentialId: credential.id,
            clientId: credential.clientId,
            clientSecret: credential.apiSecret,
            refreshToken: credential.refreshToken,
            baseUrl: credential.apiBase,
            authScheme: credential.issuer,
        };
    }
    throw new Error("Jumia API credentials are not configured. Provide JUMIA_CLIENT_ID/JUMIA_REFRESH_TOKEN env vars or create an ApiCredential row with scope 'JUMIA_VENDOR'.");
}
