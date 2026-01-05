import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { syncOnlineMarketplaceData } from "@/lib/jobs/onlineSync";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const session = await auth();
  const role = (session as { user?: { role?: string } } | null)?.user?.role;
  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

function parsePeriodKey(periodKey?: string) {
  if (!periodKey) return null;
  const parts = periodKey.split("_");
  if (parts.length !== 2) return null;
  const start = new Date(parts[0]);
  const end = new Date(parts[1]);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

async function handleSync(request: Request) {
  const forbidden = await requireAdmin();
  if (forbidden) return forbidden;

  const url = new URL(request.url);
  const periodKey = url.searchParams.get("periodKey") ?? undefined;
  const lookbackQuery = url.searchParams.get("lookbackDays");
  const lookbackDays = lookbackQuery ? Number(lookbackQuery) : undefined;

  const opts: {
    lookbackDays?: number;
    periodStart?: Date;
    periodEnd?: Date;
  } = {};

  if (periodKey) {
    const period = parsePeriodKey(periodKey);
    if (period) {
      opts.periodStart = period.start;
      opts.periodEnd = period.end;
    }
  }

  if (!opts.periodStart && !opts.periodEnd && Number.isFinite(lookbackDays ?? NaN) && lookbackDays! > 0) {
    opts.lookbackDays = lookbackDays;
  }

  if (!opts.periodStart && !opts.periodEnd && !opts.lookbackDays) {
    opts.lookbackDays = Number(process.env.JUMIA_MARKETPLACE_SYNC_LOOKBACK_DAYS ?? 30);
  }

  try {
    await syncOnlineMarketplaceData(opts);
    return NextResponse.json({ ok: true, params: opts });
  } catch (error) {
    console.error("[api/jumia/sync-online-orders] failed", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "sync_failed" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  return handleSync(request);
}

export async function GET(request: Request) {
  return handleSync(request);
}
