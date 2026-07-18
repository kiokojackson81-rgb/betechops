import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTradingPeriodFor } from "@/lib/tradingPeriod";
import { buildPayrollRow } from "@/lib/adminPayroll";
import { buildEarningsCardBreakdown } from "@/lib/earningsCardBreakdown";
import { ensureQuoteRequestsSchema, listAllQuoteRequests } from "@/lib/quoteRequests";
import { ensureSiteVisitsSchema, listAdminSiteVisits } from "@/lib/siteVisits";
import { readReceiptProjectFlow } from "@/lib/receiptProjects";
import getLandingPage from "@/lib/getLandingPage";
import { isTechnicalTeamCategory } from "@/lib/technicalTeam";
import TechnicalDailyReportClient from "./TechnicalDailyReportClient";

export const dynamic = "force-dynamic";

async function resolveViewer(impersonateId?: string | null) {
  const session = await auth().catch(() => null);
  const sessionUser = session?.user as
    | {
        id?: string | null;
        role?: string | null;
        attendantCategory?: string | null;
      }
    | undefined;

  if (!session || !sessionUser?.id) {
    redirect("/login");
  }

  const isAdmin = sessionUser.role === "ADMIN";
  const canImpersonate = isAdmin && impersonateId;

  const adminPreviewUser = !canImpersonate && isAdmin
    ? await prisma.user.findFirst({
        where: {
          attendantCategory: "TECHNICAL_TEAM",
          isActive: true,
        },
        orderBy: [{ name: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          attendantCategory: true,
          technicalProfile: true,
        },
      })
    : null;

  const targetId = canImpersonate ? impersonateId! : adminPreviewUser?.id || sessionUser.id;
  const viewer = canImpersonate || adminPreviewUser
    ? adminPreviewUser && !canImpersonate
      ? adminPreviewUser
      : await prisma.user.findUnique({
          where: { id: targetId },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isActive: true,
            attendantCategory: true,
            technicalProfile: true,
          },
        })
    : await prisma.user.findUnique({
        where: { id: targetId },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          attendantCategory: true,
          technicalProfile: true,
        },
      });

  if (!viewer || !viewer.isActive) {
    redirect("/login");
  }

  if (sessionUser.role !== "ADMIN" && !isTechnicalTeamCategory(viewer.attendantCategory)) {
    redirect(getLandingPage(viewer.attendantCategory ?? null, viewer.role));
  }

  return {
    viewer,
    impersonateId: canImpersonate ? impersonateId! : adminPreviewUser?.id || null,
  };
}

export default async function TechnicalDailyReportPage({
  searchParams,
}: {
  searchParams?: Promise<{ impersonateId?: string }>;
}) {
  const params = (await searchParams) || {};
  const { viewer, impersonateId } = await resolveViewer(params.impersonateId?.trim() || null);
  const today = new Date();
  const period = getTradingPeriodFor(today);

  await Promise.all([ensureQuoteRequestsSchema(), ensureSiteVisitsSchema()]);

  const [payrollRow, quotes, siteVisits, periodReceipts, projectReceipts] = await Promise.all([
    buildPayrollRow(
      {
        id: viewer.id,
        name: viewer.name,
        email: viewer.email,
        attendantCategory: viewer.attendantCategory,
        isActive: viewer.isActive,
      },
      period,
    ),
    listAllQuoteRequests({ status: "ALL" }),
    listAdminSiteVisits({ status: "ALL", q: "" }),
    prisma.receipt.findMany({
      where: {
        createdAt: { gte: period.start, lte: period.end },
        OR: [{ issuedById: viewer.id }, { order: { attendantId: viewer.id } }],
      },
      select: {
        id: true,
        order: { select: { totalAmount: true } },
      },
    }),
    prisma.receipt.findMany({
      where: {
        OR: [
          { data: { path: ["customerType"], equals: "project" } },
          { data: { path: ["projectFlow", "isProject"], equals: true } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 120,
      select: {
        id: true,
        createdAt: true,
        issuedById: true,
        data: true,
      },
    }),
  ]);

  const assignedQuotes = quotes.filter((quote) => quote.assignedAttendant?.id === viewer.id);
  const assignedVisits = siteVisits.filter(
    (visit) => visit.assignedStaffId === viewer.id || visit.assignedTechnicianId === viewer.id,
  );
  const serviceCalls = assignedVisits.filter(
    (visit) => visit.visitReason === "FAULT_DIAGNOSIS" && visit.status !== "CLOSED",
  );

  const myProjectReceipts = projectReceipts
    .map((receipt) => ({
      ...receipt,
      projectFlow: readReceiptProjectFlow((receipt.data as Record<string, unknown> | null)?.projectFlow),
    }))
    .filter((receipt) => {
      const flow = receipt.projectFlow;
      return flow && (flow.handlerStaffId === viewer.id || (!flow.handlerStaffId && receipt.issuedById === viewer.id));
    });

  const activeProjects = myProjectReceipts.filter(
    (receipt) => receipt.projectFlow?.stage === "PROJECT_IN_PROGRESS",
  ).length;
  const completedProjects = myProjectReceipts.filter(
    (receipt) => receipt.projectFlow?.stage === "COMPLETED_POSTED",
  ).length;

  const quickStats = {
    assignedSiteVisits: assignedVisits.length,
    activeProjects,
    serviceCallsPending: serviceCalls.length,
    quotationsAssigned: assignedQuotes.length,
    completedProjects,
    periodReceipts: periodReceipts.length,
    periodSales: periodReceipts.reduce((sum, receipt) => sum + Number(receipt.order.totalAmount || 0), 0),
  };

  const breakdown = buildEarningsCardBreakdown({
    attendantCategory: payrollRow.attendantCategory,
    baseSalary: payrollRow.baseSalary,
    transportAllowance: payrollRow.transportAllowance,
    commissionTotal: payrollRow.commissionTotal,
    salesCommission: payrollRow.commissionDirect,
    grossCommission: payrollRow.commissionGross,
    bonusTotal: payrollRow.bonusTotal,
    commissionTopUpTotal: payrollRow.adjustmentBreakdown.commissionTopUp,
    chamaTotal: payrollRow.adjustmentBreakdown.chama,
    latenessTotal: payrollRow.adjustmentBreakdown.lateness,
    disciplineTotal: payrollRow.adjustmentBreakdown.discipline + payrollRow.adjustmentBreakdown.penalties,
    otherDeductionsTotal: payrollRow.adjustmentBreakdown.other,
    totalEarnings: payrollRow.totalEarnings,
    totalDeductions: payrollRow.totalDeductions,
    netPay: payrollRow.netPay,
    adjustmentEntries: payrollRow.adjustmentEntries,
  });

  const payslipParams = new URLSearchParams({ periodKey: period.key });
  if (impersonateId) {
    payslipParams.set("impersonateId", impersonateId);
  }

  return (
    <TechnicalDailyReportClient
      viewerName={viewer.name || viewer.email || "Technical team"}
      roleLabel={viewer.technicalProfile?.teamRole || viewer.technicalProfile?.positionTitle || "Technical Team"}
      periodLabel={period.label}
      payslipHref={`/api/attendant/payslip?${payslipParams.toString()}`}
      initialImpersonateId={impersonateId}
      quickStats={quickStats}
      earnings={{
        netPay: breakdown.netPay,
        lines: breakdown.lines,
      }}
    />
  );
}
