import { NextResponse } from "next/server";

import { requireRole } from "@/lib/api";
import { getBranding } from "@/lib/branding";
import { buildPayrollRow } from "@/lib/adminPayroll";
import { launchChromiumBrowser } from "@/lib/pdf/chromium";
import { applyCanonicalPayrollOverrides } from "@/lib/payrollCanonical";
import { prisma } from "@/lib/prisma";
import { renderPayrollPrintHtml } from "@/lib/payrollPrint";
import { getTradingPeriodFor, parseTradingPeriodKey } from "@/lib/tradingPeriod";
import { sanitizeFilename } from "@/lib/payrollPayslip";
import { payrollEligibleUserWhere } from "@/lib/payrollEligibility";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireRole("ADMIN");
  if (!auth.ok) return auth.res;

  const url = new URL(req.url);
  const periodKey = (url.searchParams.get("periodKey") || "").trim();
  const period = parseTradingPeriodKey(periodKey) ?? getTradingPeriodFor(new Date());

  const [attendants, branding] = await Promise.all([
    prisma.user.findMany({
      where: payrollEligibleUserWhere(),
      orderBy: [{ attendantCategory: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        email: true,
        attendantCategory: true,
        isActive: true,
      },
    }),
    getBranding(),
  ]);

  const rows = await Promise.all(
    attendants.map(async (attendant) => applyCanonicalPayrollOverrides(await buildPayrollRow(attendant, period), period)),
  );
  const html = renderPayrollPrintHtml({ period, rows, branding });

  const browser = await launchChromiumBrowser();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdfBuffer = await page.pdf({
      format: "A4",
      landscape: true,
      printBackground: true,
    });
    const safeName = sanitizeFilename(`Payroll summary ${period.key}.pdf`);
    return new Response(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${safeName}"`,
        "Cache-Control": "no-store",
      },
    });
  } finally {
    await browser.close();
  }
}
