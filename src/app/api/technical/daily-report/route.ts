import { NextResponse } from "next/server";
import { auth, requireAttendant } from "@/lib/auth";

export const dynamic = "force-dynamic";

type TechnicalReportPayload = {
  fieldVisitsCompleted: number;
  customerCallsMade: number;
  routesConfirmed: boolean;
  visitNotesUploaded: boolean;
  installationsWorkedOn: number;
  projectsUpdated: number;
  handoversCompleted: number;
  testingCompleted: boolean;
  serviceCallsHandled: number;
  faultsDiagnosed: number;
  returnVisitsBooked: number;
  quotationsSupported: number;
  materialsRequested: number;
  toolsChecked: boolean;
  ppeConfirmed: boolean;
  incidentsReported: number;
  keyWorkCompleted: string;
  blockers: string;
  materialsNeeded: string;
  customerIssues: string;
  nextSteps: string;
  weeklySummary: string;
};

const DEFAULT_REPORT: TechnicalReportPayload = {
  fieldVisitsCompleted: 0,
  customerCallsMade: 0,
  routesConfirmed: false,
  visitNotesUploaded: false,
  installationsWorkedOn: 0,
  projectsUpdated: 0,
  handoversCompleted: 0,
  testingCompleted: false,
  serviceCallsHandled: 0,
  faultsDiagnosed: 0,
  returnVisitsBooked: 0,
  quotationsSupported: 0,
  materialsRequested: 0,
  toolsChecked: false,
  ppeConfirmed: false,
  incidentsReported: 0,
  keyWorkCompleted: "",
  blockers: "",
  materialsNeeded: "",
  customerIssues: "",
  nextSteps: "",
  weeklySummary: "",
};

function getDayBounds(dateValue: string | null) {
  const base = dateValue ? new Date(`${dateValue}T00:00:00`) : new Date();
  if (Number.isNaN(base.getTime())) {
    throw new Error("invalid_date");
  }
  const start = new Date(base);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

function toNumber(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function normalizeTechnicalReport(input: unknown): TechnicalReportPayload {
  const source = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  return {
    fieldVisitsCompleted: toNumber(source.fieldVisitsCompleted),
    customerCallsMade: toNumber(source.customerCallsMade),
    routesConfirmed: Boolean(source.routesConfirmed),
    visitNotesUploaded: Boolean(source.visitNotesUploaded),
    installationsWorkedOn: toNumber(source.installationsWorkedOn),
    projectsUpdated: toNumber(source.projectsUpdated),
    handoversCompleted: toNumber(source.handoversCompleted),
    testingCompleted: Boolean(source.testingCompleted),
    serviceCallsHandled: toNumber(source.serviceCallsHandled),
    faultsDiagnosed: toNumber(source.faultsDiagnosed),
    returnVisitsBooked: toNumber(source.returnVisitsBooked),
    quotationsSupported: toNumber(source.quotationsSupported),
    materialsRequested: toNumber(source.materialsRequested),
    toolsChecked: Boolean(source.toolsChecked),
    ppeConfirmed: Boolean(source.ppeConfirmed),
    incidentsReported: toNumber(source.incidentsReported),
    keyWorkCompleted: String(source.keyWorkCompleted || "").trim(),
    blockers: String(source.blockers || "").trim(),
    materialsNeeded: String(source.materialsNeeded || "").trim(),
    customerIssues: String(source.customerIssues || "").trim(),
    nextSteps: String(source.nextSteps || "").trim(),
    weeklySummary: String(source.weeklySummary || "").trim(),
  };
}

function buildActivityCount(report: TechnicalReportPayload) {
  return (
    report.fieldVisitsCompleted +
    report.installationsWorkedOn +
    report.projectsUpdated +
    report.serviceCallsHandled +
    report.quotationsSupported
  );
}

export async function GET(request: Request) {
  const guard = await requireAttendant(request, ["ADMIN", "SUPERVISOR", "TECHNICAL_TEAM"]);
  if (!guard.ok) return guard.res;

  try {
    const url = new URL(request.url);
    const { start, end } = getDayBounds(url.searchParams.get("date"));
    const report = await (await import("@/lib/prisma")).prisma.dailyReport.findFirst({
      where: {
        userId: guard.user.id,
        date: { gte: start, lt: end },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        date: true,
        day: true,
        submittedBy: true,
        updatedAt: true,
        tasks: true,
      },
    });

    const technicalReport = normalizeTechnicalReport(
      report && report.tasks && typeof report.tasks === "object"
        ? (report.tasks as Record<string, unknown>).technicalReport
        : null,
    );

    return NextResponse.json({
      ok: true,
      report: report
        ? {
            id: report.id,
            date: report.date.toISOString(),
            day: report.day,
            submittedBy: report.submittedBy,
            updatedAt: report.updatedAt.toISOString(),
            technicalReport,
          }
        : null,
      defaultReport: DEFAULT_REPORT,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "failed_to_load_technical_report" },
      { status: 400 },
    );
  }
}

export async function POST(request: Request) {
  const guard = await requireAttendant(request, ["ADMIN", "SUPERVISOR", "TECHNICAL_TEAM"]);
  if (!guard.ok) return guard.res;

  try {
    const body = (await request.json().catch(() => ({}))) as {
      date?: string | null;
      day?: string | null;
      technicalReport?: unknown;
    };

    const { start, end } = getDayBounds(body.date ?? null);
    const session = await auth().catch(() => null);
    const technicalReport = normalizeTechnicalReport(body.technicalReport);
    const activityCount = buildActivityCount(technicalReport);
    const submittedBy =
      ((session?.user as { name?: string | null; email?: string | null } | undefined)?.name ||
        (session?.user as { email?: string | null } | undefined)?.email ||
        null) ?? null;

    const prisma = (await import("@/lib/prisma")).prisma;
    const existing = await prisma.dailyReport.findFirst({
      where: {
        userId: guard.user.id,
        date: { gte: start, lt: end },
      },
      select: { id: true },
    });

    const payload = {
      date: start,
      day: String(body.day || start.toLocaleDateString("en-KE", { weekday: "long" })),
      productsCount: activityCount,
      totalSales: 0,
      tasks: {
        technicalReport,
        reportType: "TECHNICAL_DAILY_REPORT",
        metrics: {
          activityCount,
          fieldVisitsCompleted: technicalReport.fieldVisitsCompleted,
          installationsWorkedOn: technicalReport.installationsWorkedOn,
          projectsUpdated: technicalReport.projectsUpdated,
          serviceCallsHandled: technicalReport.serviceCallsHandled,
          quotationsSupported: technicalReport.quotationsSupported,
        },
      },
      submittedBy,
      userId: guard.user.id,
      newProducts: 0,
      productsEdited: 0,
      copiesUploaded: 0,
      walkInServed: 0,
      purchasesMade: 0,
      liveSessionsCount: 0,
      commissionEarned: 0,
      concerns: technicalReport.weeklySummary || technicalReport.blockers || null,
    };

    const report = existing
      ? await prisma.dailyReport.update({
          where: { id: existing.id },
          data: payload,
        })
      : await prisma.dailyReport.create({
          data: payload,
        });

    return NextResponse.json({
      ok: true,
      report: {
        id: report.id,
        date: report.date.toISOString(),
        day: report.day,
        updatedAt: report.updatedAt.toISOString(),
        technicalReport,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "failed_to_save_technical_report" },
      { status: 400 },
    );
  }
}
