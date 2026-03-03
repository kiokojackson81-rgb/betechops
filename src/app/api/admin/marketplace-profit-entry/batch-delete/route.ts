import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoleOrBenjamin } from "@/lib/api";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const auth = await requireRoleOrBenjamin(["ADMIN", "SUPERVISOR"]);
  if (!auth.ok) return auth.res;

  const body = (await req.json().catch(() => null)) as
    | {
        ids?: unknown;
      }
    | null;

  if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });

  const ids = Array.isArray(body.ids) ? body.ids.map((id) => String(id ?? "").trim()).filter(Boolean) : [];
  const uniqueIds = Array.from(new Set(ids)).slice(0, 200);
  if (uniqueIds.length === 0) return NextResponse.json({ error: "ids is required" }, { status: 400 });

  try {
    if ((auth as any).isBenjamin) {
      const actorId = (auth.session?.user as { id?: string } | undefined)?.id ?? null;
      if (!actorId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      const mine = await (prisma as any).marketplaceProfitEntry.findMany({
        where: { id: { in: uniqueIds }, enteredByAdminId: actorId },
        select: { id: true },
      });
      const mineIds = mine.map((r: any) => String(r.id));
      if (mineIds.length === 0) return NextResponse.json({ ok: true, deletedCount: 0 });
      const result = await (prisma as any).marketplaceProfitEntry.deleteMany({
        where: { id: { in: mineIds } },
      });
      return NextResponse.json({ ok: true, deletedCount: Number(result?.count ?? 0) });
    }

    const result = await (prisma as any).marketplaceProfitEntry.deleteMany({
      where: { id: { in: uniqueIds } },
    });
    return NextResponse.json({ ok: true, deletedCount: Number(result?.count ?? 0) });
  } catch (err: any) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2021") {
      return NextResponse.json(
        { error: "Profit capture is not available yet (database migration pending)." },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: err instanceof Error ? err.message : "Bulk delete failed" }, { status: 500 });
  }
}
