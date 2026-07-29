import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/api";
import { getPricingWeekSummary } from "@/lib/pricingWeekWhatsapp";
import { reopenOperatingCapital } from "@/lib/operatingCapital";
import { prisma } from "@/lib/prisma";
import { WeeklySaleStatus } from "@prisma/client";
import { canonicalNairobiWeekStartUtc, parseDateOnlyUtc } from "@/lib/weekWindow";
import { resolveShopIdsForMarketplaceAccount } from "@/lib/marketplaceAccountShopResolve";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function normalize(value: unknown) {
  return String(value ?? "").trim();
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(["ADMIN"]);
  if (!auth.ok) return auth.res;

  const actorId = (auth.session?.user as { id?: string } | undefined)?.id;
  if (!actorId) return NextResponse.json({ error: "Missing actor id" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { weekStart?: string; periodKey?: string; accountId?: string | null } | null;
  if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });

  const weekStartRaw = normalize(body.weekStart);
  const periodKey = normalize(body.periodKey);
  const accountId = normalize(body.accountId) || null;
  if (!weekStartRaw || !periodKey) return NextResponse.json({ error: "weekStart and periodKey are required" }, { status: 400 });

  const completionSummary = await getPricingWeekSummary(weekStartRaw, accountId ? { accountIds: [accountId] } : undefined);
  const parsed = parseDateOnlyUtc(weekStartRaw);
  if (!parsed) return NextResponse.json({ error: "Invalid weekStart" }, { status: 400 });
  const weekStart = canonicalNairobiWeekStartUtc(parsed);
  const shopIdsForWeeklySales = accountId ? await resolveShopIdsForMarketplaceAccount(accountId) : [];
  const weeklyNet = await prisma.weeklySale.aggregate({
    _sum: { amount: true },
    where: {
      weekStart,
      status: { not: WeeklySaleStatus.REJECTED } as any,
      ...(accountId ? { shopId: { in: shopIdsForWeeklySales.length ? shopIdsForWeeklySales : ["__none__"] } } : {}),
    },
  });
  const profitAgg = await (prisma as any).marketplaceProfitEntry.aggregate({
    _sum: { netPayout: true, profit: true },
    where: { weekStart, periodKey, ...(accountId ? { accountId } : {}) },
  });

  const currentNetPayout = Number(weeklyNet._sum.amount ?? 0) || Number(profitAgg?._sum?.netPayout ?? 0);
  const profit = Number(profitAgg?._sum?.profit ?? 0);

  try {
    const summary = await reopenOperatingCapital({
      weekStartRaw,
      periodKey,
      completionSummary,
      profit,
      currentNetPayout,
      actorId,
      accountId,
    });
    return NextResponse.json({ ok: true, summary }, { headers: { "Cache-Control": "no-store" } });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || String(err) }, { status: 400 });
  }
}
