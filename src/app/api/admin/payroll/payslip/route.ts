import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api";
import { getBranding } from "@/lib/branding";
import { launchChromiumBrowser } from "@/lib/pdf/chromium";
import { parseTradingPeriodKey, getTradingPeriodFor } from "@/lib/tradingPeriod";
import { calculatePayrollForAttendant } from "@/lib/adminPayroll";
import { buildPayslipPayload, renderPayslipDocumentHtml, sanitizeFilename } from "@/lib/payrollPayslip";
import { startPayrollTiming } from "@/lib/payrollTiming";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const timing = startPayrollTiming("/api/admin/payroll/payslip");
  const auth = await requireRole("ADMIN");
  if (!auth.ok) return auth.res;

  const url = new URL(req.url);
  const attendantId = (url.searchParams.get("attendantId") || "").trim();
  const periodKey = (url.searchParams.get("periodKey") || "").trim();
  if (!attendantId) {
    return NextResponse.json({ error: "Missing attendantId" }, { status: 400 });
  }

  const period = parseTradingPeriodKey(periodKey) ?? getTradingPeriodFor(new Date());
  const attendant = await prisma.user.findUnique({
    where: { id: attendantId },
    select: { id: true, name: true, email: true, attendantCategory: true, isActive: true },
  });

  if (!attendant) {
    return NextResponse.json({ error: "Attendant not found" }, { status: 404 });
  }

  const [row, branding] = await Promise.all([
    calculatePayrollForAttendant(attendant, period),
    getBranding(),
  ]);

  const html = renderPayslipDocumentHtml({
    documentTitle: `${attendant.name || attendant.email || attendant.id} payslip ${period.label}`,
    slips: [
      buildPayslipPayload({
        attendant,
        row,
        period,
        branding,
      }),
    ],
  });

  const browser = await launchChromiumBrowser();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdfBuffer = await page.pdf({ format: "A4", printBackground: true });
    const safeName = sanitizeFilename(`${attendant.name || attendant.email || attendant.id} payslip ${period.key}.pdf`);
    return timing.finish(new Response(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeName}"`,
        "Cache-Control": "no-store",
        "X-Receipt-Renderer": "pdf",
      },
    }));
  } finally {
    await browser.close();
  }
}
