import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    await auth(); // require auth but not strict role here; will reject if no session
  } catch (e) {}

  const url = new URL(req.url);
  const q = url.searchParams.get("q") || undefined;
  const docType = url.searchParams.get("docType") || undefined;
  const start = url.searchParams.get("start");
  const end = url.searchParams.get("end");
  const includeItems = url.searchParams.get("includeItems") === "true";
  const page = Math.max(1, Number(url.searchParams.get("page") || "1"));
  const size = Math.min(200, Math.max(1, Number(url.searchParams.get("size") || "50")));

  const where: any = {};
  if (docType) where.docType = docType.toUpperCase();
  if (start || end) where.generatedAt = {};
  if (start) where.generatedAt.gte = new Date(start);
  if (end) where.generatedAt.lte = new Date(end);

  if (q) {
    where.OR = [
      { order: { customerName: { contains: q, mode: 'insensitive' } } },
      { order: { customerPhone: { contains: q, mode: 'insensitive' } } },
      { order: { customerEmail: { contains: q, mode: 'insensitive' } } },
      { order: { orderNumber: { contains: q, mode: 'insensitive' } } },
      { issuedBy: { name: { contains: q, mode: 'insensitive' } } },
    ];
  }

  const receipts = await prisma.receipt.findMany({
    where,
    orderBy: { generatedAt: 'desc' },
    skip: (page - 1) * size,
    take: size,
    include: {
      order: includeItems ? { include: { items: true } } : { select: { orderNumber: true, customerName: true } },
      issuedBy: { select: { id: true, name: true } },
    },
  });

  const mapped = receipts.map((r) => ({
    id: r.id,
    orderRef: r.order?.orderNumber,
    docType: r.docType,
    createdAt: r.generatedAt,
    customerName: r.order?.customerName,
    total: (r.totals as any)?.total ?? null,
    attendantName: r.issuedBy?.name ?? null,
    status: r.order?.status ?? null,
    items: includeItems ? (r.order?.items ?? []) : undefined,
  }));

  return NextResponse.json({ receipts: mapped });
}
