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
  const pageStr = url.searchParams.get("page");
  const pageSizeStr = url.searchParams.get("pageSize");

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
    const page = Math.max(1, Number(pageStr || 1));
    const pageSize = Math.max(1, Math.min(1000, Number(pageSizeStr || 25)));
    const skip = (page - 1) * pageSize;

    const [totalCount, reports, agg] = await Promise.all([
      prisma.dailyReport.count({ where }),
      prisma.dailyReport.findMany({
        where,
        include: { user: { select: { id: true, name: true } }, sales: true },
        orderBy: { date: "desc" },
        skip,
        take: pageSize,
      }),
      prisma.dailyReport.aggregate({
        where,
        _sum: { productsCount: true, totalSales: true },
      }),
    ]);

    const summary = {
      totalProducts: agg._sum.productsCount ?? 0,
      totalSales: agg._sum.totalSales ? Number(agg._sum.totalSales) : 0,
    };

    return NextResponse.json({ reports, summary, totalCount });
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
    const { date, day, productsCount, totalSales, tasks, submittedBy } = await req.json();
    if (!day) {
      return NextResponse.json({ error: "day is required" }, { status: 400 });
    }
    // merge submittedBy into tasks if provided so exports can include the submitter
    const tasksWithSubmit = { ...(tasks || {}), ...(submittedBy ? { submittedBy } : {}) };

    const report = await prisma.dailyReport.create({
      data: {
        date: date ? new Date(date) : new Date(),
        day: String(day),
        productsCount: Number(productsCount) || 0,
        totalSales: Number(totalSales) || 0,
        tasks: tasksWithSubmit,
        userId: actorId || undefined,
      },
    });
    // persist granular sales rows if provided in tasks.sales
    try {
      const sales: any[] = (tasks?.sales && Array.isArray(tasks.sales)) ? tasks.sales : [];
      if (sales.length > 0) {
        const createMany = sales.map((s) => ({
          dailyReportId: report.id,
          productName: s.productName || "",
          price: Number(s.price || 0),
        }));
        await prisma.dailySale.createMany({ data: createMany });
      }
    } catch (err) {
      // non-fatal: log and continue
      console.error('failed to persist daily sales rows', err);
    }
    return NextResponse.json({ report }, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e ?? "Server error");
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
