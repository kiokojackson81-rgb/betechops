import { NextResponse } from "next/server";

import { requireRole } from "@/lib/api";
import {
  buildOpenfloatReviewRows,
  buildOpenfloatWorkbook,
  workbookToBuffer,
} from "@/lib/payrollOpenfloat";
import { getTradingPeriodFor, parseTradingPeriodKey } from "@/lib/tradingPeriod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireRole("ADMIN");
  if (!auth.ok) return auth.res;

  const url = new URL(req.url);
  const periodKey = (url.searchParams.get("periodKey") || "").trim();
  const period = parseTradingPeriodKey(periodKey) ?? getTradingPeriodFor(new Date());
  const rows = await buildOpenfloatReviewRows(period);
  const invalidRows = rows.filter((row) => !row.isValid);

  if (invalidRows.length > 0) {
    return NextResponse.json(
      {
        error: "payout_profile_incomplete",
        detail: `${invalidRows.length} payout row(s) still have missing or invalid details`,
      },
      { status: 400 },
    );
  }

  const workbook = buildOpenfloatWorkbook(rows);
  const buffer = workbookToBuffer(workbook);
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="openfloat-payroll-${period.key}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
