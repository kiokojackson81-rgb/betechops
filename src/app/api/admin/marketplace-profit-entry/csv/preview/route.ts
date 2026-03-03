import { NextRequest, NextResponse } from "next/server";
import { Platform } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRoleOrBenjamin } from "@/lib/api";
import { mondayToSundayNairobiWindow, normalizeWeekStartFromParam } from "@/lib/weekWindow";
import { aggregateMarketplaceStatementRows, parseMarketplaceStatementCsv } from "@/lib/marketplaceStatementCsv";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const auth = await requireRoleOrBenjamin(["ADMIN", "SUPERVISOR"]);
  if (!auth.ok) return auth.res;

  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Invalid form data" }, { status: 400 });

  const accountId = String(form.get("accountId") ?? "").trim();
  const weekStartRaw = String(form.get("weekStart") ?? "").trim();
  const file = form.get("file");

  if (!accountId) return NextResponse.json({ error: "accountId is required" }, { status: 400 });
  if (!file || typeof file !== "object" || !("arrayBuffer" in (file as any))) {
    return NextResponse.json({ error: "CSV file is required" }, { status: 400 });
  }

  const weekStartParsed = weekStartRaw ? normalizeWeekStartFromParam(weekStartRaw) : null;
  if (!weekStartParsed) return NextResponse.json({ error: "weekStart is required" }, { status: 400 });
  const { weekStart, weekEnd } = mondayToSundayNairobiWindow(weekStartParsed);

  const account = await prisma.marketplaceAccount.findUnique({
    where: { id: accountId },
    select: { id: true, platform: true, displayName: true, isActive: true },
  });
  if (!account) return NextResponse.json({ error: "Shop account not found" }, { status: 404 });
  if (!account.isActive) return NextResponse.json({ error: "Shop account is inactive" }, { status: 400 });

  const csvText = await (file as File).text();
  const parsed = parseMarketplaceStatementCsv(csvText);
  const aggregated = aggregateMarketplaceStatementRows({
    rows: parsed.rows,
    weekStartUtc: weekStart,
    weekEndUtc: weekEnd,
  });

  const itemTxns = aggregated.aggregates.map((a) => a.itemCreditTxn).filter(Boolean);
  const existing = itemTxns.length
    ? await (prisma as any).marketplaceProfitEntry.findMany({
        where: { accountId: account.id, itemCreditTxn: { in: itemTxns } },
        select: { itemCreditTxn: true },
        take: 500,
      })
    : [];
  const existingTxns = existing.map((r: any) => String(r.itemCreditTxn));

  const totals = aggregated.aggregates.reduce(
    (acc, row) => {
      acc.netPayout += row.netPayout;
      acc.grossSale += row.grossSale;
      acc.lossCandidates += row.netPayout < 0 ? 1 : 0;
      return acc;
    },
    { netPayout: 0, grossSale: 0, lossCandidates: 0 },
  );

  return NextResponse.json({
    account: { id: account.id, displayName: account.displayName, platform: account.platform as Platform },
    week: { weekStart: weekStart.toISOString(), weekEnd: weekEnd.toISOString() },
    parsed: { rows: parsed.rows.length, errors: parsed.errors },
    aggregated: { rows: aggregated.aggregates.length, skipped: aggregated.skipped, errors: aggregated.errors },
    existingTxns,
    totals,
    items: aggregated.aggregates,
  });
}

