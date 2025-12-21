import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api";

export async function GET(req: Request) {
  const authz = await requireRole("ADMIN");
  if (!authz.ok) return authz.res;

  try {
    const url = new URL(req.url);
    const wipeId = url.searchParams.get("wipeId");
    if (!wipeId) return NextResponse.json({ error: "wipeId required" }, { status: 400 });

    const logs = await prisma.actionLog.findMany({ where: { action: "RESTORE_RECEIPTS" }, orderBy: { createdAt: 'desc' }, take: 200 });

    const matching = logs.filter((l) => ((l.after as any) || {}).originalWipeId === wipeId).map((l) => ({ id: l.id, createdAt: l.createdAt, actorId: l.actorId, entityId: l.entityId, after: l.after }));

    return NextResponse.json({ ok: true, restores: matching }, { status: 200 });
  } catch (err: unknown) {
    console.error(err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "failed" }, { status: 500 });
  }
}
