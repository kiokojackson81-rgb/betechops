"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const api_1 = require("@/lib/api");
const prisma_1 = require("@/lib/prisma");
const client_s3_1 = require("@aws-sdk/client-s3");
const REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';
const BUCKET = process.env.S3_BUCKET || process.env.AWS_S3_BUCKET;
const s3 = BUCKET ? new client_s3_1.S3Client({ region: REGION }) : null;
async function POST(req, context) {
    const { id } = await context.params;
    const authz = await (0, api_1.requireRole)(["ADMIN", "SUPERVISOR", "ATTENDANT"]);
    if (!authz.ok)
        return authz.res;
    const body = (await req.json().catch(() => ({})));
    const { type, uri, sha256, takenAt, geo } = body;
    if (!type || !uri || !takenAt)
        return (0, api_1.noStoreJson)({ error: "type, uri, takenAt required" }, { status: 400 });
    const ret = await prisma_1.prisma.returnCase.findUnique({ where: { id } });
    if (!ret)
        return (0, api_1.noStoreJson)({ error: "Return not found" }, { status: 404 });
    // Ensure the URI belongs to our configured bucket (if provided) and object exists
    if (s3 && BUCKET) {
        try {
            if (!uri.startsWith('s3://'))
                return (0, api_1.noStoreJson)({ error: 'uri must be s3://<key>' }, { status: 400 });
            const key = uri.replace(/^s3:\/\//, '');
            // restrict to configured bucket prefix if desired (we prepend returns/<shopId> when signing)
            const head = await s3.send(new client_s3_1.HeadObjectCommand({ Bucket: BUCKET, Key: key }));
            if (!head)
                return (0, api_1.noStoreJson)({ error: 'object not found' }, { status: 400 });
        }
        catch (err) {
            console.error('evidence head check failed', err);
            return (0, api_1.noStoreJson)({ error: 'uploaded object not found or inaccessible' }, { status: 400 });
        }
    }
    const actorId = (await (0, api_1.getActorId)()) || '';
    const ev = await prisma_1.prisma.returnEvidence.create({ data: { returnCaseId: id, type, uri, sha256: sha256 || "", takenBy: actorId || '', takenAt: new Date(takenAt), geo: geo || undefined } });
    await prisma_1.prisma.actionLog.create({ data: { actorId: actorId || '', entity: "ReturnCase", entityId: id, action: "EVIDENCE_ADD", before: undefined, after: ev } });
    return (0, api_1.noStoreJson)({ ok: true, id, evidenceId: ev.id });
}
