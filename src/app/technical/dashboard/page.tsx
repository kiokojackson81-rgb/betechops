import Link from "next/link";
import { redirect } from "next/navigation";
import {
  BriefcaseBusiness,
  CalendarDays,
  ClipboardCheck,
  FileText,
  MapPinned,
  Receipt,
  ShieldCheck,
  Wallet,
  Wrench,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTradingPeriodFor } from "@/lib/tradingPeriod";
import { buildPayrollRow } from "@/lib/adminPayroll";
import { ensureQuoteRequestsSchema, listAllQuoteRequests } from "@/lib/quoteRequests";
import { ensureSiteVisitsSchema, listAdminSiteVisits } from "@/lib/siteVisits";
import { readReceiptProjectFlow } from "@/lib/receiptProjects";
import getLandingPage from "@/lib/getLandingPage";
import { buildTechnicalPermissionHints, isTechnicalTeamCategory } from "@/lib/technicalTeam";
import { getTechnicalProjectCommissionSummary } from "@/lib/technicalCompensation";

export const dynamic = "force-dynamic";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatShortDate(value: Date | string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (!Number.isFinite(date.valueOf())) return "-";
  return date.toLocaleString("en-KE", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

function isSameDay(left: Date | string | null | undefined, right: Date) {
  if (!left) return false;
  const date = new Date(left);
  return (
    date.getFullYear() === right.getFullYear() &&
    date.getMonth() === right.getMonth() &&
    date.getDate() === right.getDate()
  );
}

async function resolveViewer(impersonateId?: string | null) {
  const session = await auth().catch(() => null);
  const sessionUser = session?.user as
    | {
        id?: string | null;
        role?: string | null;
        attendantCategory?: string | null;
        email?: string | null;
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
          phone: true,
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
            phone: true,
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
      phone: true,
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
    sessionUser,
    viewer,
    impersonating: Boolean(canImpersonate),
    previewingAsTechnical: Boolean(isAdmin && !canImpersonate && adminPreviewUser),
    previewingEmptyState: Boolean(isAdmin && !canImpersonate && !adminPreviewUser),
  };
}

export default async function TechnicalDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ impersonateId?: string }>;
}) {
  const params = (await searchParams) || {};
  const { viewer, impersonating, previewingAsTechnical, previewingEmptyState } = await resolveViewer(
    params.impersonateId?.trim() || null,
  );
  const today = new Date();
  const period = getTradingPeriodFor(today);

  await Promise.all([ensureQuoteRequestsSchema(), ensureSiteVisitsSchema()]);

  const [payrollRow, quotes, siteVisits, periodReceipts, projectReceipts, dailyReportCount, projectCommission] = await Promise.all([
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
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        receiptNumber: true,
        createdAt: true,
        issuedById: true,
        order: {
          select: {
            customerName: true,
            customerPhone: true,
            totalAmount: true,
            paymentStatus: true,
            items: { select: { quantity: true } },
          },
        },
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
        receiptNumber: true,
        createdAt: true,
        issuedById: true,
        data: true,
        order: {
          select: {
            customerName: true,
            customerPhone: true,
            totalAmount: true,
          },
        },
      },
    }),
    prisma.dailyReport.count({
      where: {
        userId: viewer.id,
        date: { gte: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0) },
      },
    }),
    getTechnicalProjectCommissionSummary(viewer.id, period),
  ]);

  const assignedQuotes = quotes.filter((quote) => quote.assignedAttendant?.id === viewer.id);
  const assignedVisits = siteVisits.filter(
    (visit) => visit.assignedStaffId === viewer.id || visit.assignedTechnicianId === viewer.id,
  );
  const todayVisits = assignedVisits.filter((visit) => isSameDay(visit.scheduledAt, today));
  const scheduledVisits = assignedVisits.filter((visit) => visit.status === "SCHEDULED");
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
      return (
        flow &&
        (flow.handlerStaffId === viewer.id || (!flow.handlerStaffId && receipt.issuedById === viewer.id))
      );
    });

  const activeInstallations = myProjectReceipts.filter(
    (receipt) =>
      receipt.projectFlow?.stage === "PROJECT_IN_PROGRESS" ||
      receipt.projectFlow?.stage === "PROJECT_INSTALLED",
  );
  const pendingProjects = myProjectReceipts.filter(
    (receipt) =>
      receipt.projectFlow?.stage === "RECEIPT_CREATED" ||
      receipt.projectFlow?.stage === "PROJECT_SCHEDULED",
  );
  const completedProjectsPeriod = myProjectReceipts.filter(
    (receipt) =>
      receipt.projectFlow?.stage === "COMPLETED_POSTED" &&
      receipt.createdAt >= period.start &&
      receipt.createdAt <= period.end,
  );
  const todayProjects = myProjectReceipts.filter(
    (receipt) =>
      receipt.projectFlow?.stage === "PROJECT_IN_PROGRESS" ||
      receipt.projectFlow?.stage === "PROJECT_INSTALLED" ||
      isSameDay(receipt.projectFlow?.scheduledDate, today),
  );

  const totalItems = periodReceipts.reduce(
    (sum, receipt) => sum + receipt.order.items.reduce((itemTotal, item) => itemTotal + Number(item.quantity || 0), 0),
    0,
  );

  const reportsRequired = Math.max(0, todayVisits.length + todayProjects.length - dailyReportCount);
  const quickStats = [
    {
      label: "Tasks today",
      value: todayVisits.length + todayProjects.length,
      hint: "Assigned field work and active projects today",
      icon: ClipboardCheck,
      href: "/technical/site-visits",
    },
    {
      label: "Scheduled visits",
      value: scheduledVisits.length,
      hint: "Visits currently on the diary",
      icon: CalendarDays,
      href: "/technical/site-visits",
    },
    {
      label: "Projects pending",
      value: pendingProjects.length,
      hint: "Assigned projects waiting work to begin",
      icon: BriefcaseBusiness,
      href: "/technical/projects",
    },
    {
      label: "Installations in progress",
      value: activeInstallations.length,
      hint: "Project receipts still being executed",
      icon: Wrench,
      href: "/technical/projects",
    },
    {
      label: "Service calls pending",
      value: serviceCalls.length,
      hint: "Fault diagnosis visits waiting closure",
      icon: ShieldCheck,
      href: "/technical/site-visits",
    },
    {
      label: "Reports to submit",
      value: reportsRequired,
      hint: dailyReportCount > 0 ? "Daily report already filed today" : "Daily report still pending",
      icon: FileText,
      href: "/technical/daily-report",
    },
    {
      label: "Projects completed",
      value: completedProjectsPeriod.length,
      hint: "Completed and posted project receipts",
      icon: BriefcaseBusiness,
      href: "/technical/projects",
    },
  ];

  const recentActivities = [
    ...todayVisits.slice(0, 3).map((visit) => ({
      id: visit.id,
      title: visit.visitReason?.replace(/_/g, " ") || "Site visit",
      customer: visit.customerName,
      subtitle: [visit.town, visit.county].filter(Boolean).join(", ") || "Location pending",
      status: visit.status.replace(/_/g, " "),
      time: formatShortDate(visit.scheduledAt),
      href: "/technical/site-visits",
      actionLabel: "Open visit",
      icon: MapPinned,
    })),
    ...todayProjects.slice(0, 3).map((receipt) => ({
      id: receipt.id,
      title: "Installation project",
      customer: receipt.order.customerName,
      subtitle: receipt.receiptNumber || "Project receipt",
      status: receipt.projectFlow?.stage.replace(/_/g, " ") || "Project",
      time: formatShortDate(receipt.projectFlow?.scheduledDate || receipt.createdAt),
      href: "/technical/projects",
      actionLabel: "Open project",
      icon: BriefcaseBusiness,
    })),
  ].slice(0, 6);

  const permissionHints = buildTechnicalPermissionHints(
    viewer.technicalProfile?.teamRole || viewer.technicalProfile?.positionTitle,
  );

  const actionLinks = [
    { href: "/technical/sales", label: "Open sales monitor" },
    { href: "/technical/quotations", label: "Create quotation" },
    { href: "/receipts", label: "Create receipt", newTab: true },
    { href: "/technical/site-visits", label: "Schedule site visit" },
    { href: "/technical/projects", label: "Open projects" },
    { href: "/technical/daily-report", label: "Submit daily report" },
    { href: "/technical/earnings", label: "Open earnings" },
    { href: "/technical/wellness", label: "Wellness / safety" },
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-white/10 bg-gradient-to-br from-white/8 via-white/4 to-transparent p-6 shadow-2xl shadow-black/20">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.26em] text-emerald-300/80">Technical operations</div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">
              Good morning, {viewer.name || viewer.email || "Technical team"}.
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-300">
              Here is your technical operations summary for today. Quotations, site visits, project receipts, payroll, and wellness remain connected to the same Ops account.
            </p>
            <p className="mt-3 max-w-3xl text-sm text-amber-100/85">
              Project receipts stay operational while pending or in progress, but they only count into sales and completed project earnings after they are marked completed and posted to POS.
            </p>
            {impersonating ? (
              <div className="mt-3 inline-flex rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-amber-100">
                Admin impersonation view
              </div>
            ) : null}
            {previewingAsTechnical ? (
              <div className="mt-3 inline-flex rounded-full border border-sky-400/30 bg-sky-400/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-sky-100">
                Admin preview using technical staff view
              </div>
            ) : null}
            {previewingEmptyState ? (
              <div className="mt-3 inline-flex rounded-full border border-slate-400/30 bg-slate-400/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-100">
                Admin preview mode with no technical staff yet
              </div>
            ) : null}
          </div>
          <div className="grid gap-3 rounded-3xl border border-white/10 bg-[#091223] p-4 text-sm text-slate-300 sm:grid-cols-2">
            <div>
              <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Period</div>
              <div className="mt-1 font-medium text-white">{period.label}</div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Role</div>
              <div className="mt-1 font-medium text-white">
                {viewer.technicalProfile?.teamRole || viewer.technicalProfile?.positionTitle || "Technical Team"}
              </div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Employee no.</div>
              <div className="mt-1 font-medium text-white">{viewer.technicalProfile?.employeeNumber || "-"}</div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">EPRA</div>
              <div className="mt-1 font-medium text-white">
                {viewer.technicalProfile?.epraLicenseNumber || "Pending profile update"}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        {quickStats.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              href={item.href}
              className="min-w-0 rounded-[24px] border border-white/10 bg-white/5 p-5 transition hover:border-emerald-400/30 hover:bg-white/[0.08]"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="text-sm text-slate-300">{item.label}</span>
                <Icon className="h-5 w-5 shrink-0 text-emerald-300" />
              </div>
              <div className="mt-4 break-words text-3xl font-semibold leading-none tracking-tight text-white sm:text-4xl">
                {item.value}
              </div>
              <div className="mt-2 text-sm text-slate-400">{item.hint}</div>
            </Link>
          );
        })}
      </section>

      <section className="rounded-[28px] border border-amber-400/20 bg-amber-500/10 p-5 text-sm text-amber-100/80">
        <div className="text-xs uppercase tracking-[0.22em] text-amber-200">Project workflow guardrail</div>
        <div className="mt-2 font-semibold text-white">Dashboard counts now separate project operations from project sales recognition.</div>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
            <div className="font-semibold text-white">Project pending</div>
            <div className="mt-1">Project appears as pending work only.</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
            <div className="font-semibold text-white">In progress</div>
            <div className="mt-1">Project stays visible for operations and pending project commission only.</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
            <div className="font-semibold text-white">Completed and posted</div>
            <div className="mt-1">Only at this point does it count in finalized project totals and payroll completion earnings.</div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.8fr)_360px]">
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="min-w-0 rounded-[24px] border border-white/10 bg-white/5 p-5">
              <div className="text-sm text-slate-400">Receipts</div>
              <div className="mt-2 break-words text-2xl font-semibold leading-tight text-white sm:text-3xl">{periodReceipts.length}</div>
              <div className="mt-1 text-sm text-slate-500">Rows in this period</div>
            </div>
            <div className="min-w-0 rounded-[24px] border border-white/10 bg-white/5 p-5">
              <div className="text-sm text-slate-400">Sales (KES)</div>
              <div className="mt-2 break-words text-2xl font-semibold leading-tight text-white sm:text-3xl">
                {formatCurrency(payrollRow.totalSales).replace("Ksh", "KES")}
              </div>
              <div className="mt-1 text-sm text-slate-500">Receipts and attributed work</div>
            </div>
            <div className="min-w-0 rounded-[24px] border border-white/10 bg-white/5 p-5">
              <div className="text-sm text-slate-400">Commission</div>
              <div className="mt-2 break-words text-2xl font-semibold leading-tight text-white sm:text-3xl">
                {formatCurrency(payrollRow.commission).replace("Ksh", "KES")}
              </div>
              <div className="mt-1 text-sm text-slate-500">10% of priced POS profit plus completed projects</div>
            </div>
            <div className="min-w-0 rounded-[24px] border border-white/10 bg-white/5 p-5">
              <div className="text-sm text-slate-400">Items sold</div>
              <div className="mt-2 break-words text-2xl font-semibold leading-tight text-white sm:text-3xl">{totalItems}</div>
              <div className="mt-1 text-sm text-slate-500">Linked receipt items</div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="min-w-0 rounded-[24px] border border-amber-400/20 bg-amber-500/10 p-5">
              <div className="text-sm text-amber-100/80">Pending project commission</div>
              <div className="mt-2 break-words text-2xl font-semibold leading-tight text-amber-100 sm:text-3xl">
                {formatCurrency(projectCommission.pendingAmount).replace("Ksh", "KES")}
              </div>
              <div className="mt-1 text-sm text-amber-100/70">
                {projectCommission.pendingCount} assigned project{projectCommission.pendingCount === 1 ? "" : "s"} currently in progress at KES 2,000 each, waiting for final completion and POS posting.
              </div>
            </div>
            <div className="min-w-0 rounded-[24px] border border-emerald-400/20 bg-emerald-500/10 p-5">
              <div className="text-sm text-emerald-100/80">Completed project commission</div>
              <div className="mt-2 break-words text-2xl font-semibold leading-tight text-emerald-100 sm:text-3xl">
                {formatCurrency(projectCommission.completedAmount).replace("Ksh", "KES")}
              </div>
              <div className="mt-1 text-sm text-emerald-100/70">
                {projectCommission.completedCount} completed project{projectCommission.completedCount === 1 ? "" : "s"} already completed and posted into this payroll period.
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-[#091223] p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-lg font-semibold text-white">Today&apos;s activities</div>
                <div className="text-sm text-slate-400">Field visits and active projects assigned to this technical profile.</div>
              </div>
              <Link href="/technical/site-visits" className="rounded-full border border-white/10 px-4 py-2 text-sm text-slate-200 hover:bg-white/5">
                View calendar
              </Link>
            </div>
            <div className="space-y-3">
              {recentActivities.length ? (
                recentActivities.map((activity) => {
                  const Icon = activity.icon;
                  return (
                    <div key={activity.id} className="flex flex-col gap-4 rounded-[22px] border border-white/10 bg-white/[0.03] p-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-300">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm text-slate-400">{activity.time}</div>
                          <div className="mt-1 text-base font-semibold text-white">{activity.title}</div>
                          <div className="text-sm text-slate-300">{activity.customer}</div>
                          <div className="text-sm text-slate-500">{activity.subtitle}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-emerald-100">
                          {activity.status}
                        </span>
                        <Link href={activity.href} className="rounded-full border border-white/10 px-4 py-2 text-sm text-white hover:bg-white/5">
                          {activity.actionLabel}
                        </Link>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-[22px] border border-dashed border-white/10 p-6 text-sm text-slate-400">
                  No technical activities are assigned today yet.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-[28px] border border-white/10 bg-white/5 p-5">
            <div className="text-lg font-semibold text-white">Earnings this period</div>
            <div className="mt-1 text-sm text-slate-400">{period.label}</div>
            <div className="mt-5 text-sm uppercase tracking-[0.2em] text-slate-500">Net pay</div>
            <div className="mt-2 break-words text-3xl font-semibold leading-tight tracking-tight text-emerald-300 sm:text-4xl">
              {formatCurrency(payrollRow.netPay)}
            </div>
            <div className="mt-5 space-y-2 text-sm text-slate-300">
              <div className="flex items-center justify-between"><span>Base salary</span><span>{formatCurrency(payrollRow.baseSalary)}</span></div>
              <div className="flex items-center justify-between"><span>Commission</span><span>{formatCurrency(payrollRow.commission)}</span></div>
              <div className="flex items-center justify-between"><span>Bonuses / additions</span><span>{formatCurrency(payrollRow.bonusTotal)}</span></div>
              <div className="flex items-center justify-between"><span>Deductions</span><span className="text-rose-300">-{formatCurrency(payrollRow.totalDeductions)}</span></div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <Link href="/technical/earnings" className="rounded-2xl bg-emerald-500 px-4 py-3 text-center text-sm font-semibold text-black">
                View payslip
              </Link>
              <Link href="/technical/earnings" className="rounded-2xl border border-white/10 px-4 py-3 text-center text-sm font-semibold text-white">
                Commission & deductions
              </Link>
            </div>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-white/5 p-5">
            <div className="mb-3 flex items-center gap-2 text-white">
              <Wallet className="h-4 w-4 text-emerald-300" />
              <span className="text-lg font-semibold">Quick actions</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {actionLinks.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  target={item.newTab ? "_blank" : undefined}
                  rel={item.newTab ? "noreferrer" : undefined}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200 transition hover:bg-white/[0.08]"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-white/5 p-5">
            <div className="mb-3 flex items-center gap-2 text-white">
              <Receipt className="h-4 w-4 text-emerald-300" />
              <span className="text-lg font-semibold">Role scope</span>
            </div>
            <div className="mb-2 text-sm text-slate-400">
              {viewer.technicalProfile?.teamRole || viewer.technicalProfile?.positionTitle || "Technical Team"}
            </div>
            <div className="space-y-2">
              {permissionHints.map((hint) => (
                <div key={hint} className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-slate-200">
                  {hint}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-white/5 p-5">
            <div className="text-lg font-semibold text-white">Pipeline snapshot</div>
            <div className="mt-4 space-y-2 text-sm text-slate-300">
              <div className="flex items-center justify-between"><span>Assigned quotations</span><span>{assignedQuotes.length}</span></div>
              <div className="flex items-center justify-between"><span>Site visits assigned</span><span>{assignedVisits.length}</span></div>
              <div className="flex items-center justify-between"><span>Project receipts linked</span><span>{myProjectReceipts.length}</span></div>
              <div className="flex items-center justify-between"><span>Open service calls</span><span>{serviceCalls.length}</span></div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
