import { NextRequest, NextResponse } from 'next/server';
import { sendReceiptChannels } from '@/workers/receiptSender';
import { auth } from '@/lib/auth';
import { randomUUID } from 'crypto';
import { waitForReceiptById } from '@/lib/receiptReadAfterWrite';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ParamsContext = { params: { id: string } } | { params: Promise<{ id: string }> };

function formatHost(req: NextRequest) {
  // Prefer forwarded host header when present (Vercel / proxies)
  return (
    req.headers.get('x-forwarded-host') || req.headers.get('host') || req.headers.get('x-vercel-forwarded-host') || 'unknown'
  );
}

export async function POST(req: NextRequest, context: ParamsContext) {
  const requestId = randomUUID();
  const startedAt = Date.now();

  // Resolve receipt id from context
  let receiptId = '';
  try {
    const paramsObj = 'params' in context && typeof (context as any).params?.then === 'function'
      ? await (context as { params: Promise<{ id: string }> }).params
      : (context as { params: { id: string } }).params;
    receiptId = String(paramsObj.id || '');
  } catch (e) {
    console.error(`[receiptSend][rid=${requestId}] failed to resolve params`, e);
    return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
  }

  // Parse incoming channels from body OR querystring (support PrintControls link)
  let channels: string[] = [];
  try {
    const body = await req.json().catch(() => ({}));
    if (Array.isArray(body?.channels)) channels = body.channels;
  } catch {
    // ignore parse error
  }
  // fallback to query param ?channels=whatsapp or ?channels=email
  try {
    if (!channels.length) {
      const url = new URL(req.url);
      const q = url.searchParams.get('channels');
      if (q) channels = q.split(',').map((s) => s.trim()).filter(Boolean);
    }
  } catch {
    // ignore
  }

  // Determine host/origin and attempt auth (log user if present)
  const host = formatHost(req);
  let session: any = null;
  try {
    session = await auth();
  } catch (maybeRes) {
    // auth() may throw a NextResponse redirect; convert to JSON 401
    console.error(`[receiptSend][rid=${requestId}] auth redirect or error`, maybeRes);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!session) {
    console.warn(`[receiptSend][rid=${requestId}] unauthenticated request`);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.info(`[receiptSend][rid=${requestId}] HIT /api/receipts/${receiptId}/send host=${host} channels=${JSON.stringify(channels)} user=${session?.user?.id ?? session?.user?.email ?? 'unknown'}`);

  try {
    // Log: load receipt from DB
    console.info(`[receiptSend][rid=${requestId}] DB:loading ${receiptId}`);
    const receipt = await waitForReceiptById({
      receiptId,
      loggerPrefix: `[receiptSend][rid=${requestId}]`,
      select: { id: true },
    });
    if (!receipt) {
      console.error(`[receiptSend][rid=${requestId}] DB:missing receipt ${receiptId}`);
      return NextResponse.json({ error: 'Receipt not found' }, { status: 404 });
    }
    console.info(`[receiptSend][rid=${requestId}] DB:loaded ok`);

    // Call worker to perform send pipeline (PDF generation, upload, chatrace, email, whatsapp)
    console.info(`[receiptSend][rid=${requestId}] ACTION:sendReceiptChannels start`);
    const result = await sendReceiptChannels(receiptId, channels, { requestId });
    console.info(`[receiptSend][rid=${requestId}] ACTION:sendReceiptChannels end`, { result });

    // After worker returned, inspect receipt metadata for pdf/chatrace info
    try {
      const fresh = await waitForReceiptById<{
        data?: unknown;
      }>({
        receiptId,
        loggerPrefix: `[receiptSend][rid=${requestId}] post-send`,
        select: { data: true },
      });
      const chatrace = fresh?.data && typeof fresh.data === 'object' ? (fresh.data as any).chatrace : undefined;
      const pdfUrl = chatrace?.pdfUrl ?? (fresh?.data && typeof fresh.data === 'object' ? (fresh.data as any).pdfUrl : undefined);
      const pdfLen = typeof pdfUrl === 'string' ? pdfUrl.length : 0;
      console.info(`[receiptSend][rid=${requestId}] PDF:url ${pdfLen}`);
      console.info(`[receiptSend][rid=${requestId}] CHATRACE:ok success=${Boolean(result?.channelStatus?.chatrace === 'sent')}`);
    } catch (inspectErr) {
      console.warn(`[receiptSend][rid=${requestId}] post-inspect failed`, inspectErr);
    }

    const durationMs = Date.now() - startedAt;
    console.info(`[receiptSend][rid=${requestId}] END durationMs=${durationMs}`);
    return NextResponse.json({ ok: true, result, durationMs });
  } catch (err) {
    console.error(`[receiptSend][rid=${requestId}] ERROR`, err);
    const msg = err instanceof Error ? err.message : 'Failed';
    const durationMs = Date.now() - startedAt;
    console.info(`[receiptSend][rid=${requestId}] END durationMs=${durationMs}`);
    return NextResponse.json({ error: msg, durationMs }, { status: 500 });
  }
}
