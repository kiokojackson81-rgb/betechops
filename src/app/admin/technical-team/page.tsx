import Link from "next/link";
import { prisma } from "@/lib/prisma";
import AttendantsClient from "@/app/admin/attendants/AttendantsClient";
import { getCategoryLabel } from "@/lib/getLandingPage";

export const dynamic = "force-dynamic";

export default async function AdminTechnicalTeamPage() {
  const attendantsRaw = await prisma.user.findMany({
    where: {
      role: { in: ["ATTENDANT", "SUPERVISOR"] },
      attendantCategory: "TECHNICAL_TEAM",
      agentProfile: { is: null },
    },
    orderBy: [{ name: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      attendantCategory: true,
      isActive: true,
      createdAt: true,
      technicalProfile: true,
    },
  });

  const prepared = attendantsRaw.map((item) => ({
    id: item.id,
    name: item.name,
    email: item.email || "-",
    attendantCategory: item.attendantCategory ?? null,
    categoryLabel: getCategoryLabel(item.attendantCategory),
    isActive: item.isActive,
    createdAt: item.createdAt.toISOString(),
  }));

  const activeCount = prepared.filter((item) => item.isActive).length;

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-white/10 bg-[#091223] p-6 text-slate-100">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.24em] text-emerald-300/80">Technical team admin</div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Technical Team Management</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-300">
              Create technical users in the same attendants workflow, then open their dashboard, payroll, quotations, and field operations from one admin desk.
            </p>
          </div>
          <div className="flex gap-3">
            <Link href="/technical/dashboard" className="rounded-full border border-white/10 px-4 py-2 text-sm text-white hover:bg-white/5">
              Open technical dashboard
            </Link>
            <Link href="/admin/quotation-center/site-visits" className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-black">
              Open site visits
            </Link>
          </div>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-sm text-slate-400">Technical employees</div>
            <div className="mt-2 text-3xl font-semibold text-white">{prepared.length}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-sm text-slate-400">Active accounts</div>
            <div className="mt-2 text-3xl font-semibold text-white">{activeCount}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-sm text-slate-400">Category route</div>
            <div className="mt-2 text-lg font-semibold text-white">/technical/dashboard</div>
          </div>
        </div>
      </section>

      <AttendantsClient attendants={prepared} />
    </div>
  );
}
