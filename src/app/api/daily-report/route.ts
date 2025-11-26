import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, getActorId } from "@/lib/api";

// Force this route to be dynamically executed to bypass static caching
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const fromStr = url.searchParams.get("from");
  const toStr = url.searchParams.get("to");
  const day     = url.searchParams.get("day");

  const where: any = {};
  if (fromStr) {
    where.date = { gte: new Date(fromStr) };
  }
  if (toStr) {
    where.date = where.date
      ? { ...where.date, lte: new Date(toStr) }
      : { lte: new Date(toStr) };
  }
  if (day) {
    where.day = day;
  }

  try {
    const reports = await prisma.dailyReport.findMany({
      where,
      include: { user: { select: { id: true, name: true } } },
      orderBy: { date: "desc" },
    });

    const summary = reports.reduce(
      (acc, r) => {
        acc.totalProducts += r.productsCount;
        acc.totalSales   += typeof r.totalSales === "number" ? r.totalSales : Number(r.totalSales);
        return acc;
      },
      { totalProducts: 0, totalSales: 0 }
    );

    return NextResponse.json({ reports, summary });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e ?? "Server error");
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireRole("ATTENDANT");
  if (!auth.ok) return auth.res;
  const actorId = await getActorId();
  try {
    const { date, day, productsCount, totalSales, tasks } = await req.json();
    if (!day) {
      return NextResponse.json({ error: "day is required" }, { status: 400 });
    }
    const report = await prisma.dailyReport.create({
      data: {
        date: date ? new Date(date) : new Date(),
        day: String(day),
        productsCount: Number(productsCount) || 0,
        totalSales: Number(totalSales) || 0,
        tasks: tasks || {},
        userId: actorId || undefined,
      },
    });
    return NextResponse.json({ report }, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e ?? "Server error");
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
