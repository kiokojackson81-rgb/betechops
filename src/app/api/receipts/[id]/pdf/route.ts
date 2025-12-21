import { prisma } from '@/lib/prisma';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const receiptId = params.id;
  try {
    const file = await prisma.receiptFile.findFirst({
      where: { receiptId, contentType: 'application/pdf', url: { not: '' } },
      orderBy: { createdAt: 'desc' },
    });

    if (!file || !file.url) {
      return new Response(JSON.stringify({ error: 'PDF not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    // Fetch the underlying blob URL server-side and stream it back.
    const upstream = await fetch(file.url);
    if (!upstream.ok) {
      return new Response(JSON.stringify({ error: 'Failed to fetch upstream PDF' }), { status: 502, headers: { 'Content-Type': 'application/json' } });
    }

    const headers = new Headers(upstream.headers);
    headers.set('Content-Type', 'application/pdf');
    headers.set('Cache-Control', 'no-store');

    const body = await upstream.arrayBuffer();
    return new Response(body, { status: 200, headers });
  } catch (e) {
    console.error('[api/receipts/[id]/pdf] error', e);
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateReceiptPdf } from "@/workers/receiptSender";
import { buildReceiptSnapshot } from "@/app/receipts/buildSnapshot";
import { getBranding } from '@/lib/branding';

export const dynamic = "force-dynamic";

type ParamsContext = { params: { id: string } } | { params: Promise<{ id: string }> };

function resolveParams(context: ParamsContext): Promise<{ id: string }> {
  const maybePromise = (context as any).params;
  if (maybePromise && typeof maybePromise.then === "function") {
    return maybePromise as Promise<{ id: string }>;
  }
  return Promise.resolve((context as { params: { id: string } }).params);
}

export async function GET(_req: NextRequest, context: ParamsContext) {
  const { id } = await resolveParams(context);
  const receipt = await prisma.receipt.findUnique({
    where: { id },
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
    return NextResponse.json({ error: "Receipt not found" }, { status: 404 });
  }

  const snapshot = buildReceiptSnapshot(receipt);
  // Explicitly fetch branding and attach to the snapshot so the server-side
  // PDF generation uses the same branding as live HTML rendering.
  try {
    const branding = await getBranding();
    (snapshot as any).branding = branding;
  } catch (e) {
    // Non-fatal: continue without explicit branding if the DB lookup fails
    console.warn('pdf: failed to load branding for snapshot', e);
  }

  const pdfBuffer = await generateReceiptPdf(snapshot, { hideStamp: false });
  if (!pdfBuffer) {
    return NextResponse.json({ error: "Failed to generate PDF" }, { status: 500 });
  }

  const fileName = `${receipt.order?.orderNumber ?? receipt.id}.pdf`;
  // Convert Node Buffer to a Uint8Array which is accepted by NextResponse
  const uint8 = new Uint8Array(pdfBuffer.buffer, pdfBuffer.byteOffset, pdfBuffer.byteLength);

  // Cast to BodyInit to satisfy NextResponse TypeScript typing on build
  const res = new NextResponse(uint8 as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${fileName}"`,
      "Cache-Control": "no-store",
      "X-Receipt-Renderer": "pdf",
      "X-Receipt-Commit": process.env.VERCEL_GIT_COMMIT_SHA || "unknown",
    },
  });

  // add letterhead debug header
  const letterhead = (snapshot as any)?.branding?.letterheadUrl || process.env.NEXT_PUBLIC_RECEIPT_LETTERHEAD_URL || 'none';
  res.headers.set('X-Receipt-Letterhead', String(letterhead).slice(0, 120));

  return res;
}
