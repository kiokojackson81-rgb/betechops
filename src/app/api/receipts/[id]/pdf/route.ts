import { prisma } from '@/lib/prisma';
import { buildReceiptSnapshot } from '@/app/receipts/buildSnapshot';
import renderReceiptHtml from '@/lib/receipts/renderReceiptHtml';
import { launchChromiumBrowser } from '@/lib/pdf/chromium';
import type { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ParamsContext = { params: { id: string } } | { params: Promise<{ id: string }> };

async function resolveParams(context: ParamsContext): Promise<{ id: string }> {
  const params = (context as any).params;
  if (params && typeof params.then === 'function') {
    return params as Promise<{ id: string }>;
  }
  return Promise.resolve((context as { params: { id: string } }).params);
}

export async function GET(_req: NextRequest, context: ParamsContext) {
  const req = _req;
  const { id: receiptId } = await resolveParams(context);
  if (!receiptId) {
    return new Response(JSON.stringify({ error: 'Missing receipt id' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const search = req.nextUrl.searchParams;
    const asDownload = search.get('download') === '1';
    // Render fresh by default so inline PDF viewing and downloaded PDFs match
    // the current print-preview layout. Cached stored PDFs are only used when
    // explicitly requested for diagnostics.
    const allowCached = search.get('cached') === '1';

    const files = !allowCached
      ? []
      : await prisma.receiptFile.findMany({
          where: { receiptId, contentType: 'application/pdf', url: { not: '' } },
          orderBy: { uploadedAt: 'desc' },
          take: 10,
        });

    const isFullCandidate = (file: { key: string | null; url: string }) => {
      const hay = `${String(file.key ?? '')} ${String(file.url ?? '')}`.toLowerCase();
      const looksCustomer = hay.includes('customer');
      const looksFull = hay.includes('print') || hay.includes('full');
      return looksFull && !looksCustomer;
    };

    const file = files.find(isFullCandidate) ?? files[0] ?? null;

    if (file?.url) {
      const upstream = await fetch(file.url, { redirect: 'follow' });
      console.info('[api/receipts/[id]/pdf] upstream fetch', {
        receiptId,
        upstreamStatus: upstream.status,
        upstreamContentType: upstream.headers.get('content-type'),
        selectedKey: file.key ?? null,
      });

      if (upstream.ok && upstream.body) {
        const headers = new Headers();
        headers.set('Content-Type', 'application/pdf');
        headers.set('Cache-Control', 'no-store');
        headers.set('Content-Disposition', `${asDownload ? 'attachment' : 'inline'}; filename="receipt-${receiptId}.pdf"`);
        const len = upstream.headers.get('content-length');
        if (len) headers.set('Content-Length', len);
        return new Response(upstream.body, { status: 200, headers });
      }
    }

    // Fallback: generate a fresh "print-like" PDF from the current receipt snapshot.
    const receipt = await prisma.receipt.findUnique({
      where: { id: receiptId },
      include: {
        order: {
          include: {
            items: { include: { product: { select: { id: true, name: true } } } },
            attendant: { select: { id: true, name: true } },
            layawayPlan: { include: { payments: true } },
          },
        },
        issuedBy: { select: { id: true, name: true, email: true } },
      },
    });

    if (!receipt) {
      return new Response(JSON.stringify({ error: 'Receipt not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const snapshot = buildReceiptSnapshot(receipt);
    const html = await renderReceiptHtml(snapshot, { hideStamp: false });

    const browser = await launchChromiumBrowser();
    try {
      const page = await browser.newPage();
      await page.emulateMediaType('print');
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdf = await page.pdf({
        preferCSSPageSize: true,
        printBackground: true,
        margin: {
          top: '0',
          right: '0',
          bottom: '0',
          left: '0',
        },
      });
      const headers = new Headers();
      headers.set('Content-Type', 'application/pdf');
      headers.set('Cache-Control', 'no-store');
      headers.set('Content-Disposition', `${asDownload ? 'attachment' : 'inline'}; filename="receipt-${receiptId}.pdf"`);
      return new Response(pdf, { status: 200, headers });
    } finally {
      await browser.close().catch(() => undefined);
    }
  } catch (error) {
    console.error('[api/receipts/[id]/pdf] error', error);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
