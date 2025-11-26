import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, getActorId } from "@/lib/api";

export const dynamic = "force-dynamic";

// GET /api/daily-report?from=YYYY-MM-DD&to=YYYY-MM-DD
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const fromStr = searchParams.get("from");
    const toStr = searchParams.get("to");
    const where: any = {};
    if (fromStr) {
      where.date = { gte: new Date(fromStr) };
    }
    if (toStr) {
      where.date = where.date
        ? { ...where.date, lte: new Date(toStr) }
        : { lte: new Date(toStr) };
    }

    const reports = await prisma.dailyReport.findMany({
      where,
      include: { user: { select: { id: true, name: true } } },
      orderBy: { date: "desc" },
    });

    const summary = reports.reduce(
      (acc, r) => {
        acc.totalProducts += r.productsCount;
        acc.totalSales += typeof r.totalSales === "number" ? r.totalSales : Number(r.totalSales);
        return acc;
      },
      { totalProducts: 0, totalSales: 0 },
    );

    return NextResponse.json({ reports, summary });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e ?? "Server error");
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST /api/daily-report
export async function POST(req: Request) {
  const auth = await requireRole("ATTENDANT");
  if (!auth.ok) return auth.res;
  const actorId = await getActorId();
  try {
    const { date, productsCount, totalSales } = await req.json();
    const report = await prisma.dailyReport.create({
      data: {
        date: date ? new Date(date) : new Date(),
        productsCount: Number(productsCount) || 0,
        totalSales: Number(totalSales) || 0,
        userId: actorId || undefined,
      },
    });
    return NextResponse.json({ report }, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e ?? "Server error");
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
