import type { NextRequest } from "next/server";
import { noStoreJson, requireRole, getActorId } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { S3Client, HeadObjectCommand } from '@aws-sdk/client-s3';

const REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';
const BUCKET = process.env.S3_BUCKET || process.env.AWS_S3_BUCKET;
const s3 = BUCKET ? new S3Client({ region: REGION }) : null;

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const authz = await requireRole(["ADMIN", "SUPERVISOR", "ATTENDANT"]);
  if (!authz.ok) return authz.res;
  const body = (await req.json().catch(() => ({}))) as { type?: string; uri?: string; sha256?: string; takenAt?: string; geo?: unknown };
  const { type, uri, sha256, takenAt, geo } = body;
  if (!type || !uri || !takenAt) return noStoreJson({ error: "type, uri, takenAt required" }, { status: 400 });
  const ret = await prisma.returnCase.findUnique({ where: { id } });
  if (!ret) return noStoreJson({ error: "Return not found" }, { status: 404 });
  // Ensure the URI belongs to our configured bucket (if provided) and object exists
  if (s3 && BUCKET) {
    try {
      if (!uri.startsWith('s3://')) return noStoreJson({ error: 'uri must be s3://<key>' }, { status: 400 });
      const key = uri.replace(/^s3:\/\//, '');
      // restrict to configured bucket prefix if desired (we prepend returns/<shopId> when signing)
      const head = await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
      if (!head) return noStoreJson({ error: 'object not found' }, { status: 400 });
    } catch (err: unknown) {
      console.error('evidence head check failed', err);
      return noStoreJson({ error: 'uploaded object not found or inaccessible' }, { status: 400 });
    }
  }

  const actorId = (await getActorId()) || '';
  const ev = await prisma.returnEvidence.create({ data: { returnCaseId: id, type, uri, sha256: sha256 || "", takenBy: actorId || '', takenAt: new Date(takenAt), geo: geo || undefined } });
  await prisma.actionLog.create({ data: { actorId: actorId || '', entity: "ReturnCase", entityId: id, action: "EVIDENCE_ADD", before: undefined, after: ev } });
  return noStoreJson({ ok: true, id, evidenceId: ev.id });
}
