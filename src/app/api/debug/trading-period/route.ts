import { NextResponse } from "next/server";
import { getTradingPeriodFor } from "@/lib/tradingPeriod";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const now = new Date();
    let dbNow: string | null = null;
    try {
      const res: any = await prisma.$queryRaw`SELECT NOW() as now`;
      if (Array.isArray(res) && res.length) {
        const val = res[0]?.now ?? res[0];
        dbNow = typeof val === "string" ? val : val?.toISOString?.() ?? String(val ?? "");
      }
    } catch (e) {
      dbNow = null;
    }

    const period = getTradingPeriodFor(now);

    const res = NextResponse.json({
      serverTime: now.toISOString(),
      tradingPeriod: { key: period.key, label: period.label, start: period.start.toISOString(), end: period.end.toISOString() },
      dbNow,
    });
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch (e: any) {
    const res = NextResponse.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
    res.headers.set("Cache-Control", "no-store");
    return res;
  }
}
