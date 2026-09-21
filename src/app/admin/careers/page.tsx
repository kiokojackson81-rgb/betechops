import Link from "next/link";
import { redirect } from "next/navigation";
import { BriefcaseBusiness } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import CareerApplicationsClient, { type CareerApplicationRow } from "./CareerApplicationsClient";

export const dynamic = "force-dynamic";

const statuses = ["ALL", "SUBMITTED", "REVIEWING", "SHORTLISTED", "VIDEO_REQUESTED", "INTERVIEWED", "NOT_SELECTED", "HIRED"] as const;

export default async function AdminCareerApplicationsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role || "";
  if (!session) redirect("/admin/login");
  if (!["ADMIN", "SUPERVISOR"].includes(role)) redirect("/not-authorized");

  const { status: rawStatus } = await searchParams;
  const activeStatus = statuses.includes(rawStatus as (typeof statuses)[number]) ? rawStatus as (typeof statuses)[number] : "ALL";
  const [rows, counts] = await Promise.all([
    prisma.careerApplication.findMany({ where: activeStatus === "ALL" ? undefined : { status: activeStatus }, orderBy: { createdAt: "desc" }, take: 150 }),
    prisma.careerApplication.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  const countByStatus = new Map(counts.map((entry) => [entry.status, entry._count._all]));
  const totalApplications = counts.reduce((total, entry) => total + entry._count._all, 0);
  const serialized: CareerApplicationRow[] = rows.map((row) => ({ ...row, status: row.status as CareerApplicationRow["status"], createdAt: row.createdAt.toISOString(), applicantEmailSentAt: row.applicantEmailSentAt?.toISOString() || null, hrEmailSentAt: row.hrEmailSentAt?.toISOString() || null }));
  const buildHref = (status: string) => status === "ALL" ? "/admin/careers" : `/admin/careers?status=${encodeURIComponent(status)}`;

  return <div className="space-y-7"><section className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,.95),rgba(2,6,23,.98))] p-6 sm:p-8"><div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.28em] text-cyan-300"><BriefcaseBusiness className="h-4 w-4" /> Careers</div><h1 className="mt-3 text-4xl font-semibold tracking-tight text-white">Career application queue</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">Review graduate trainee applications, open CVs and content work, and move each candidate through the shortlist process.</p></div><Link href="/career" target="_blank" className="inline-flex rounded-xl border border-cyan-400/25 bg-cyan-400/10 px-4 py-2.5 text-sm font-bold text-cyan-100">Open public career page</Link></div><div className="mt-7 flex flex-wrap gap-2">{statuses.map((status) => <Link key={status} href={buildHref(status)} className={`rounded-xl border px-3.5 py-2 text-sm font-bold transition ${activeStatus === status ? "border-cyan-300 bg-cyan-300 text-slate-950" : "border-white/10 bg-white/[.04] text-slate-200 hover:bg-white/[.08]"}`}>{status === "ALL" ? "All applications" : status.replace(/_/g, " ")} <span className="ml-1 opacity-70">{status === "ALL" ? totalApplications : countByStatus.get(status) || 0}</span></Link>)}</div></section><CareerApplicationsClient rows={serialized} /></div>;
}
