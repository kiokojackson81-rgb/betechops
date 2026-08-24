import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api";
import { getTradingPeriodFor, parseTradingPeriodKey } from "@/lib/tradingPeriod";
import {
  sendPayrollNotificationForAttendant,
  sendPayrollNotificationsForPeriod,
} from "@/services/payroll-notifications/payroll-notification.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = await requireRole("ADMIN");
  if (!auth.ok) return auth.res;

  const body = (await req.json().catch(() => ({}))) as {
    attendantId?: string;
    attendantIds?: string[];
    periodKey?: string;
  };

  const period = parseTradingPeriodKey(String(body.periodKey || "").trim()) ?? getTradingPeriodFor(new Date());

  try {
    if (body.attendantId) {
      const result = await sendPayrollNotificationForAttendant({
        attendantId: String(body.attendantId).trim(),
        period,
      });
      return NextResponse.json({ ok: true, mode: "single", result });
    }

    const results = await sendPayrollNotificationsForPeriod({
      period,
      attendantIds: Array.isArray(body.attendantIds) ? body.attendantIds.map((value) => String(value).trim()).filter(Boolean) : undefined,
    });

    return NextResponse.json({
      ok: true,
      mode: "bulk",
      count: results.length,
      results,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to send payroll notifications",
      },
      { status: 500 },
    );
  }
}
