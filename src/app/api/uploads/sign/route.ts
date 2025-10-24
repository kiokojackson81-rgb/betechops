import { NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { requireRole } from "@/lib/api";

const REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';
const BUCKET = process.env.S3_BUCKET || process.env.AWS_S3_BUCKET;

const s3 = new S3Client({ region: REGION });

export async function POST(req: Request) {
  const auth = await requireRole(["ADMIN", "SUPERVISOR", "ATTENDANT"]);
  if (!auth.ok) return auth.res;

  const body = (await req.json().catch(() => ({}))) as { filename?: string; contentType?: string; shopId?: string };
  const { filename, contentType, shopId } = body;
  if (!filename) return NextResponse.json({ error: 'filename_required' }, { status: 400 });

  // authorize shop-scoped access
  if (!BUCKET) return NextResponse.json({ error: 'S3 bucket not configured' }, { status: 500 });
  if (!contentType || !shopId) return NextResponse.json({ error: 'contentType and shopId required' }, { status: 400 });

  const key = `returns/${shopId}/${Date.now()}-${Math.random().toString(36).slice(2)}-${filename}`;
  const cmd = new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: contentType });

  try {
    const url = await getSignedUrl(s3, cmd, { expiresIn: 60 * 10 });
    return NextResponse.json({ url, key });
  } catch (err: unknown) {
    console.error('sign error', err);
    return NextResponse.json({ error: 'failed to sign' }, { status: 500 });
  }
}
