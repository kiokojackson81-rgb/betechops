import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> | { id: string } }) {
  const auth = await requireRole(["ADMIN", "SUPERVISOR"]);
  if (!auth.ok) return auth.res;

  const { id } = await Promise.resolve(ctx.params);
  const entryId = String(id ?? "").trim();
  if (!entryId) return NextResponse.json({ error: "id is required" }, { status: 400 });

  try {
    await (prisma as any).marketplaceProfitEntry.delete({ where: { id: entryId } });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2021") {
      return NextResponse.json(
        { error: "Profit capture is not available yet (database migration pending)." },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: err instanceof Error ? err.message : "Delete failed" }, { status: 500 });
  }
}

