import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MarketplaceReturnStatus } from "@prisma/client";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const statusLabels: Record<MarketplaceReturnStatus, string> = {
  WAITING_AT_HUB: "Waiting at hub",
  PICKED: "Picked",
  CHARGED_TO_ATTENDANT: "Charged to attendant",
};

export default async function AdminOnlineReturnsPage(props: any) {
  const searchParams = props?.searchParams as Record<string, string | string[] | undefined> | undefined;
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (role !== "ADMIN" && role !== "SUPERVISOR") {
    return redirect("/not-authorized");
  }

  const rawStatus = searchParams?.status;
  const statusParam = Array.isArray(rawStatus) ? rawStatus[0] : rawStatus;
  const normalizedStatus = statusParam?.toUpperCase() as MarketplaceReturnStatus | undefined;
  const prismaStatusFilter =
    normalizedStatus && Object.keys(statusLabels).includes(normalizedStatus) ? normalizedStatus : undefined;
  const selectedStatus = prismaStatusFilter;

  const [counts, returns] = await Promise.all([
    prisma.marketplaceReturn.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    prisma.marketplaceReturn.findMany({
      where: prismaStatusFilter ? { status: prismaStatusFilter } : undefined,
      include: {
        account: { select: { displayName: true, platform: true } },
        attendant: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  ]);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <p className="text-xs uppercase tracking-wide text-slate-400">Returns</p>
        <h2 className="text-xl font-semibold text-white">Marketplace returns & deductions</h2>
        <p className="text-sm text-slate-400">
          Track cases that still need action before nightly deductions kick in. Use the filters to focus on a specific
          status.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        {Object.entries(statusLabels).map(([statusKey, label]) => {
          const status = statusKey as MarketplaceReturnStatus;
          const count = counts.find((entry) => entry.status === status)?._count._all ?? 0;
          const isActive = selectedStatus === status;
          const href = isActive ? "/admin/online/returns" : `/admin/online/returns?status=${status}`;
          return (
            <a
              key={status}
              href={href}
              className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition ${
                isActive
                  ? "border-emerald-400 bg-emerald-500/10 text-emerald-100"
                  : "border-white/15 text-slate-200 hover:border-emerald-400/60 hover:text-emerald-200"
              }`}
            >
              {label} ({count})
            </a>
          );
        })}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-slate-900/30">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
              <th className="px-4 py-3">Return</th>
              <th className="px-4 py-3">Account</th>
              <th className="px-4 py-3">Attendant</th>
              <th className="px-4 py-3 text-right">Expected amount</th>
              <th className="px-4 py-3">Due date</th>
            </tr>
          </thead>
          <tbody>
            {returns.map((entry) => (
              <tr key={entry.id} className="border-t border-white/5">
                <td className="px-4 py-4">
                  <div className="font-semibold text-white">{statusLabels[entry.status]}</div>
                  <div className="text-xs text-slate-400">Order item #{entry.orderItemId}</div>
                </td>
                <td className="px-4 py-4">
                  <div className="font-semibold text-white">{entry.account.displayName}</div>
                  <div className="text-xs text-slate-400 capitalize">{entry.platform.toLowerCase()}</div>
                </td>
                <td className="px-4 py-4">
                  {entry.attendant ? (
                    <>
                      <div className="font-semibold text-white">
                        {entry.attendant.name ?? entry.attendant.email ?? "Unassigned"}
                      </div>
                      <div className="text-xs text-slate-400">{entry.attendant.email}</div>
                    </>
                  ) : (
                    <span className="text-xs text-slate-500">Unassigned</span>
                  )}
                </td>
                <td className="px-4 py-4 text-right font-semibold text-emerald-200">
                  KES {Number(entry.expectedAmount).toLocaleString()}
                </td>
                <td className="px-4 py-4 text-sm text-slate-200">
                  <div>{entry.dueAt.toLocaleDateString()}</div>
                  <div className="text-xs text-slate-400">
                    Created {entry.createdAt.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </div>
                </td>
              </tr>
            ))}
            {returns.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-center text-sm text-slate-400" colSpan={5}>
                  No return cases found for the selected filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border border-white/10 bg-slate-900/40 px-4 py-3 text-sm text-slate-200">
        Returns are sourced from the nightly Jumia sync job. Once supervisors approve a case and confirm pickup, use the
        attendant tooling to update the underlying order state so the deductions are reconciled automatically.
      </div>
    </div>
  );
}
