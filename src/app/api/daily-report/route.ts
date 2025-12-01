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
  const userQ  = url.searchParams.get("user");
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
  if (userQ) {
    // allow filtering by submittedBy free-text or attendant name/email
    where.OR = [
      { submittedBy: { contains: userQ, mode: "insensitive" } },
      { user: { is: { name: { contains: userQ, mode: "insensitive" } } } },
      { user: { is: { email: { contains: userQ, mode: "insensitive" } } } },
    ];
  }

  try {
    const page = Math.max(1, Number(pageStr || 1));
    const pageSize = Math.max(1, Math.min(1000, Number(pageSizeStr || 25)));
    const skip = (page - 1) * pageSize;

    const [totalCount, reports, agg] = await Promise.all([
      prisma.dailyReport.count({ where }),
      prisma.dailyReport.findMany({
        where,
        include: { user: { select: { id: true, name: true, email: true } }, sales: true },
        orderBy: { date: "desc" },
        skip,
        take: pageSize,
      }),
      prisma.dailyReport.aggregate({
        where,
        _sum: {
          productsCount: true,
          totalSales: true,
          newProducts: true,
          productsEdited: true,
          copiesUploaded: true,
          walkInServed: true,
          purchasesMade: true,
          liveSessionsCount: true,
          commissionEarned: true,
        },
      }),
    ]);

    const summary = {
      totalProducts: agg._sum.productsCount ?? 0,
      totalSales: agg._sum.totalSales ? Number(agg._sum.totalSales) : 0,
      totalNewProducts: agg._sum.newProducts ?? 0,
      totalProductsEdited: agg._sum.productsEdited ?? 0,
      totalCopiesUploaded: agg._sum.copiesUploaded ?? 0,
      totalWalkInsServed: agg._sum.walkInServed ?? 0,
      totalPurchasesMade: agg._sum.purchasesMade ?? 0,
      totalLiveSessions: agg._sum.liveSessionsCount ?? 0,
      totalCommissionEarned: agg._sum.commissionEarned ? Number(agg._sum.commissionEarned) : 0,
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
    const {
      date,
      day,
      productsCount,
      totalSales,
      tasks,
      submittedBy,
      // new fields
      newProducts,
      productsEdited,
      copiesUploaded,
      walkInServed,
      purchasesMade,
      liveSessionsCount,
      commissionEarned,
      confirmedCompetitiveness,
      marketEngagement,
      concerns,
    } = await req.json();
    if (!day) {
      return NextResponse.json({ error: "day is required" }, { status: 400 });
    }
    // merge submittedBy into tasks for backward compatibility
    // Also embed the new metrics inside the tasks JSON so reports are preserved
    // even when the database schema migration has not yet been applied.
    const metricsPayload = {
      newProducts: typeof newProducts !== "undefined" ? Number(newProducts || 0) : undefined,
      productsEdited: typeof productsEdited !== "undefined" ? Number(productsEdited || 0) : undefined,
      copiesUploaded: typeof copiesUploaded !== "undefined" ? Number(copiesUploaded || 0) : undefined,
      walkInServed: typeof walkInServed !== "undefined" ? Number(walkInServed || 0) : undefined,
      purchasesMade: typeof purchasesMade !== "undefined" ? Number(purchasesMade || 0) : undefined,
      liveSessionsCount: typeof liveSessionsCount !== "undefined" ? Number(liveSessionsCount || 0) : undefined,
      commissionEarned: typeof commissionEarned !== "undefined" ? Number(commissionEarned || 0) : undefined,
      confirmedCompetitiveness: typeof confirmedCompetitiveness !== "undefined" ? Boolean(confirmedCompetitiveness) : undefined,
      marketEngagement: marketEngagement ? marketEngagement : undefined,
      concerns: concerns ?? undefined,
    } as any;

    const tasksWithSubmit = {
      ...(tasks || {}),
      ...(submittedBy ? { submittedBy } : {}),
      metrics: { ...(tasks?.metrics || {}), ...metricsPayload },
    };

    const report = await prisma.dailyReport.create({
      data: {
        date: date ? new Date(date) : new Date(),
        day: String(day),
        productsCount: Number(productsCount) || 0,
        totalSales: Number(totalSales) || 0,
        // store metrics inside tasks JSON for backwards compatibility
        tasks: tasksWithSubmit,
        submittedBy: submittedBy || null,
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
          paymentMethod: s.paymentMethod || undefined,
          receiptNumber: s.receiptNumber || undefined,
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
