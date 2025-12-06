import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, getActorId } from "@/lib/api";

export async function POST(req: Request) {
  const auth = await requireRole("ADMIN");
  if (!auth.ok) return auth.res;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const entryId = body?.entryId;
  if (!entryId || typeof entryId !== "string") {
    return NextResponse.json({ error: "entryId is required" }, { status: 400 });
  }

  try {
    const before = await prisma.dailyReport.findUnique({
      where: { id: entryId },
      include: { sales: true, user: { select: { id: true, name: true, email: true } } },
    });
    if (!before) return NextResponse.json({ error: "Entry not found" }, { status: 404 });

    const saleIds = before.sales.map((sale) => sale.id);
    if (saleIds.length) {
      await prisma.marketingSale.updateMany({
        where: { dailySaleId: { in: saleIds } },
        data: { dailySaleId: null },
      });
      await prisma.dailySale.deleteMany({ where: { id: { in: saleIds } } });
    }

    await prisma.dailyReport.delete({ where: { id: entryId } });

    try {
      const actorId = await getActorId();
      await prisma.actionLog.create({
        data: {
          actorId: actorId || "",
          entity: "DailyReport",
          entityId: entryId,
          action: "DELETE_ENTRY",
          before: before as any,
          after: { deletedAt: new Date().toISOString() } as any,
        },
      });
    } catch (logErr) {
      console.warn("Failed to write actionLog for daily report delete", logErr);
    }

    return NextResponse.json({ deleted: true });
  } catch (err: unknown) {
    console.error("Failed to delete daily report entry", err);
    const message = err instanceof Error ? err.message : "Delete failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
