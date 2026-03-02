import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const auth = await requireRole(["ADMIN", "SUPERVISOR"]);
  if (!auth.ok) return auth.res;

  const body = (await req.json().catch(() => null)) as
    | {
        accountId?: string;
        txns?: unknown;
      }
    | null;

  if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });

  const accountId = String(body.accountId ?? "").trim();
  if (!accountId) return NextResponse.json({ error: "accountId is required" }, { status: 400 });

  const txns = Array.isArray(body.txns) ? body.txns.map((t) => String(t ?? "").trim()).filter(Boolean) : [];
  if (txns.length === 0) return NextResponse.json({ existingTxns: [] });

  try {
    const existing = await (prisma as any).marketplaceProfitEntry.findMany({
      where: { accountId, itemCreditTxn: { in: txns } },
      select: { itemCreditTxn: true },
      take: 25,
    });
    return NextResponse.json({ existingTxns: existing.map((e: any) => String(e.itemCreditTxn)) });
  } catch (err: any) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2021") {
      return NextResponse.json(
        { error: "Profit capture is not available yet (database migration pending)." },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: err instanceof Error ? err.message : "Check failed" }, { status: 500 });
  }
}

