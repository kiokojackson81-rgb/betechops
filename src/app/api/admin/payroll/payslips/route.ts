import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api";
import { getBranding } from "@/lib/branding";
import { launchChromiumBrowser } from "@/lib/pdf/chromium";
import { parseTradingPeriodKey, getTradingPeriodFor } from "@/lib/tradingPeriod";
import { buildPayrollRow } from "@/lib/adminPayroll";
import { buildPayslipPayload, renderPayslipDocumentHtml, sanitizeFilename } from "@/lib/payrollPayslip";

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
      where: { role: { in: ["ATTENDANT", "SUPERVISOR"] } },
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

  if (!attendants.length) {
    return NextResponse.json({ error: "No attendants found" }, { status: 404 });
  }

  const slips = await Promise.all(
    attendants.map(async (attendant) => {
      const row = await buildPayrollRow(attendant, period);
      return buildPayslipPayload({
        attendant,
        row,
        period,
        branding,
      });
    }),
  );

  const html = renderPayslipDocumentHtml({
    documentTitle: `Payroll payslips ${period.label}`,
    slips,
  });

  const browser = await launchChromiumBrowser();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdfBuffer = await page.pdf({ format: "A4", printBackground: true });
    const safeName = sanitizeFilename(`Payroll payslips ${period.key}.pdf`);
    return new Response(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeName}"`,
        "Cache-Control": "no-store",
        "X-Receipt-Renderer": "pdf",
      },
    });
  } finally {
    await browser.close();
  }
}
