"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const crypto_1 = require("crypto");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_1 = require("@/lib/prisma");
// POST /oauth/token
// Accepts application/x-www-form-urlencoded body with:
// - grant_type=refresh_token
// - client_id
// - refresh_token
// Behavior:
// - If OAUTH_JWT_SECRET is set, issues a signed JWT access token (HS256).
// - Otherwise returns an opaque random access_token.
// - If an ApiCredential exists with clientId matching the provided client_id,
//   the credential's refreshToken will be updated (rotation).
async function POST(req) {
    const contentType = (req.headers.get('content-type') || '').toLowerCase();
    if (!contentType.includes('application/x-www-form-urlencoded')) {
        return new Response(JSON.stringify({ error: 'invalid_request', error_description: 'Content-Type must be application/x-www-form-urlencoded' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    const text = await req.text();
    const params = new URLSearchParams(text);
    const grant_type = params.get('grant_type');
    const client_id = params.get('client_id');
    const refresh_token = params.get('refresh_token');
    if (!grant_type || !client_id || !refresh_token) {
        return new Response(JSON.stringify({ error: 'invalid_request', error_description: 'Missing required parameters' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    if (grant_type !== 'refresh_token') {
        return new Response(JSON.stringify({ error: 'unsupported_grant_type', error_description: 'Only grant_type=refresh_token is supported' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    // Optional validation against environment variables. If the env var is not set
    // we allow any value (useful for local/dev).
    const expectedClient = process.env.OAUTH_CLIENT_ID;
    if (expectedClient && client_id !== expectedClient) {
        return new Response(JSON.stringify({ error: 'invalid_client', error_description: 'client_id is invalid' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    // Persist/rotate refresh token into ApiCredential if a matching record exists.
    try {
        const cred = await prisma_1.prisma.apiCredential.findFirst({ where: { clientId: client_id } });
        if (cred) {
            // Update refreshToken if different (rotation) and record updatedAt automatically
            if (cred.refreshToken !== refresh_token) {
                await prisma_1.prisma.apiCredential.update({ where: { id: cred.id }, data: { refreshToken: refresh_token } });
            }
        }
    }
    catch (err) {
        // don't fail the token issuance if DB is unavailable; log server-side
        // (avoid leaking errors in response)
        console.error('OAuth token route: failed to persist refresh token', err);
    }
    const jwtSecret = process.env.OAUTH_JWT_SECRET;
    const expiresIn = parseInt(process.env.OAUTH_EXPIRES_IN || '3600', 10);
    if (jwtSecret) {
        // Issue a JWT access token. Minimal claims: sub=client_id, iss optional
        const payload = { sub: client_id };
        const signOpts = { algorithm: 'HS256', expiresIn };
        const token = jsonwebtoken_1.default.sign(payload, jwtSecret, signOpts);
        const body = {
            access_token: token,
            token_type: 'Bearer',
            expires_in: expiresIn,
        };
        return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    // Fallback: opaque token
    const token = (0, crypto_1.randomBytes)(28).toString('base64url');
    const body = {
        access_token: token,
        token_type: 'Bearer',
        expires_in: expiresIn,
    };
    return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
}
