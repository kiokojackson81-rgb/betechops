import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, getActorId } from "@/lib/api";
import { auth } from "@/lib/auth";

export async function POST(req: Request) {
  const authz = await requireRole("ADMIN");
  if (!authz.ok) return authz.res;

  let body: any;
  try {
    body = await req.json();
  } catch (err) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const entryId = body?.entryId;
  if (!entryId) return NextResponse.json({ error: "entryId is required" }, { status: 400 });

  try {
    const before = await prisma.supportDailyEntry.findUnique({ where: { id: entryId }, include: { receipts: { include: { items: true } } } });
    if (!before) return NextResponse.json({ error: "Entry not found" }, { status: 404 });

    // delete items, receipts, then entry
    await prisma.supportReceiptItem.deleteMany({ where: { receipt: { is: { dailyEntryId: entryId } } } });
    await prisma.supportReceipt.deleteMany({ where: { dailyEntryId: entryId } });
    await prisma.supportDailyEntry.delete({ where: { id: entryId } });

    // audit
    try {
      const actorId = await getActorId();
      const session = await auth();
      const actorEmail = (session?.user as any)?.email || "";
      const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "";
      await prisma.actionLog.create({
        data: {
          actorId: actorId || "",
          entity: "SupportDailyEntry",
          entityId: entryId,
          action: "DELETE_ENTRY",
          before: before as any,
          after: { actorEmail, ip } as any,
        },
      });
    } catch (e) {
      console.warn("failed to write actionLog for support delete", e);
    }

    return NextResponse.json({ deleted: true }, { status: 200 });
  } catch (err: unknown) {
    console.error("delete support entry failed", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Delete failed" }, { status: 500 });
  }
}
