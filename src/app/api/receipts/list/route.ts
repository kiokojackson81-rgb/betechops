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
  const attendantId = url.searchParams.get("attendantId") || undefined;
  const includeItems = url.searchParams.get("includeItems") === "true";
  const page = Math.max(1, Number(url.searchParams.get("page") || "1"));
  const size = Math.min(200, Math.max(1, Number(url.searchParams.get("size") || "50")));

  const today = new Date();
  const startDefault = new Date(today);
  startDefault.setHours(0, 0, 0, 0);
  const endDefault = new Date(today);
  endDefault.setHours(23, 59, 59, 999);

  const where: any = {};
  if (docType) where.docType = docType.toUpperCase();
  where.generatedAt = {
    gte: start ? new Date(start) : startDefault,
    lte: end ? new Date(end) : endDefault,
  };

  if (q) {
    where.OR = [
      { order: { customerName: { contains: q, mode: 'insensitive' } } },
      { order: { customerPhone: { contains: q, mode: 'insensitive' } } },
      { order: { customerEmail: { contains: q, mode: 'insensitive' } } },
      { order: { orderNumber: { contains: q, mode: 'insensitive' } } },
      { order: { attendant: { name: { contains: q, mode: 'insensitive' } } } },
      { issuedBy: { name: { contains: q, mode: 'insensitive' } } },
    ];
  }
  if (attendantId) {
    where.order = { ...(where.order || {}), attendantId };
  }

  const receipts = await prisma.receipt.findMany({
    where,
    orderBy: { generatedAt: 'desc' },
    skip: (page - 1) * size,
    take: size,
    include: {
      order: includeItems
        ? { include: { items: true, attendant: { select: { id: true, name: true } } } }
        : { select: { orderNumber: true, customerName: true, attendant: { select: { id: true, name: true } }, status: true, paymentStatus: true, totalAmount: true } },
      issuedBy: { select: { id: true, name: true } },
    },
  });

  const mapped = receipts.map((r) => ({
    id: r.id,
    orderRef: r.order?.orderNumber,
    docType: r.docType,
    createdAt: r.generatedAt,
    customerName: r.order?.customerName,
    total: (r.totals as any)?.total ?? (r.order as any)?.totalAmount ?? null,
    attendantName: (r.order as any)?.attendant?.name ?? r.issuedBy?.name ?? null,
    status: r.order?.status ?? r.order?.paymentStatus ?? null,
    items: includeItems ? (r.order?.items ?? []) : undefined,
  }));

  return NextResponse.json({ receipts: mapped, paging: { page, size } });
}
