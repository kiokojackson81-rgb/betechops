import { prisma } from "@/lib/prisma";
import { getBranding } from "@/lib/branding";
import { launchChromiumBrowser } from "@/lib/pdf/chromium";
import { requireAttendant } from "@/lib/auth";
import { parseTradingPeriodKey, getTradingPeriodFor } from "@/lib/tradingPeriod";
import { buildPayrollRow } from "@/lib/adminPayroll";
import { applyCanonicalPayrollOverrides } from "@/lib/payrollCanonical";
import { buildPayslipPayload, renderPayslipDocumentHtml, sanitizeFilename } from "@/lib/payrollPayslip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireAttendant(req, [
    "ADMIN",
    "SUPERVISOR",
    "TECHNICAL_TEAM",
    "DIRECT_SALES_OPS",
    "MARKETING_OPS",
    "JUMIA_KILIMALL_OPS",
    "SUPPORT_OPS",
    "GENERAL_OPS",
    "BETECH_OPS",
  ]);
  if (!auth.ok) return auth.res;

  const url = new URL(req.url);
  const periodKey = (url.searchParams.get("periodKey") || "").trim();
  const period = parseTradingPeriodKey(periodKey) ?? getTradingPeriodFor(new Date());

  const attendant = await prisma.user.findUnique({
    where: { id: auth.user.id },
    select: { id: true, name: true, email: true, attendantCategory: true, isActive: true },
  });

  if (!attendant) {
    return new Response(JSON.stringify({ error: "Attendant not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const [row, branding] = await Promise.all([
    applyCanonicalPayrollOverrides(
      await buildPayrollRow(
        {
          id: attendant.id,
          name: attendant.name,
          email: attendant.email,
          attendantCategory: attendant.attendantCategory,
          isActive: attendant.isActive,
        },
        period,
      ),
      period,
    ),
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
