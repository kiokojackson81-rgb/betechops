"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const server_1 = require("next/server");
const client_s3_1 = require("@aws-sdk/client-s3");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
const api_1 = require("@/lib/api");
const REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';
const BUCKET = process.env.S3_BUCKET || process.env.AWS_S3_BUCKET;
const s3 = new client_s3_1.S3Client({ region: REGION });
async function POST(req) {
    const auth = await (0, api_1.requireRole)(["ADMIN", "SUPERVISOR", "ATTENDANT"]);
    if (!auth.ok)
        return auth.res;
    const body = (await req.json().catch(() => ({})));
    const { filename, contentType, shopId } = body;
    if (!filename)
        return server_1.NextResponse.json({ error: 'filename_required' }, { status: 400 });
    // authorize shop-scoped access
    if (!BUCKET)
        return server_1.NextResponse.json({ error: 'S3 bucket not configured' }, { status: 500 });
    if (!contentType || !shopId)
        return server_1.NextResponse.json({ error: 'contentType and shopId required' }, { status: 400 });
    const key = `returns/${shopId}/${Date.now()}-${Math.random().toString(36).slice(2)}-${filename}`;
    const cmd = new client_s3_1.PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: contentType });
    try {
        const url = await (0, s3_request_presigner_1.getSignedUrl)(s3, cmd, { expiresIn: 60 * 10 });
        return server_1.NextResponse.json({ url, key });
    }
    catch (err) {
        console.error('sign error', err);
        return server_1.NextResponse.json({ error: 'failed to sign' }, { status: 500 });
    }
}
