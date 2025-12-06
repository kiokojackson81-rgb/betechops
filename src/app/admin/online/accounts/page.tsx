import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Platform } from "@prisma/client";
import { redirect } from "next/navigation";
import { AccountAdminPanel } from "./AccountAdminPanel";

export const dynamic = "force-dynamic";

type AccountRow = {
  id: string;
  displayName: string;
  platform: Platform;
  countryCode: string;
  currency: string;
  jumiaShopSid: string | null;
  kilimallShopCode: string | null;
  isActive: boolean;
  assignments: Array<{
    attendantId: string;
    attendantName: string | null;
    attendantEmail: string | null;
    role: string;
    endsAt: Date | null;
  }>;
};

type MarketplaceAccountWithAssignments = {
  id: string;
  displayName: string;
  platform: Platform;
  countryCode: string;
  currency: string;
  jumiaShopSid: string | null;
  kilimallShopCode: string | null;
  isActive: boolean;
  assignments: Array<{
    attendantId: string;
    role: string;
    endsAt: Date | null;
    attendant?: { id: string; name: string | null; email: string | null } | null;
  }>;
};

export default async function AdminOnlineAccountsPage() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (role !== "ADMIN" && role !== "SUPERVISOR") {
    return redirect("/not-authorized");
  }

  const now = new Date();
  let rows: AccountRow[] | null = null;
  try {
    const accounts = (await prisma.marketplaceAccount.findMany({
      orderBy: [{ createdAt: "desc" }],
      include: {
        assignments: {
          include: {
            attendant: {
              select: { id: true, name: true, email: true },
            },
          },
          where: {
            OR: [{ endsAt: null }, { endsAt: { gt: now } }],
          },
          orderBy: { createdAt: "desc" },
        },
      },
    })) as MarketplaceAccountWithAssignments[];

    rows = accounts.map((account) => ({
      id: account.id,
      displayName: account.displayName,
      platform: account.platform,
      countryCode: account.countryCode,
      currency: account.currency,
      jumiaShopSid: account.jumiaShopSid,
      kilimallShopCode: account.kilimallShopCode,
      isActive: account.isActive,
      assignments: account.assignments.map((assignment) => ({
        attendantId: assignment.attendant?.id ?? assignment.attendantId,
        attendantName: assignment.attendant?.name ?? null,
        attendantEmail: assignment.attendant?.email ?? null,
        role: assignment.role,
        endsAt: assignment.endsAt,
      })),
    }));
  } catch (err) {
    console.error("Admin online accounts failed to load data:", err);
  }

  if (!rows) {
    return (
      <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-rose-100">
        <h2 className="text-lg font-semibold">Unable to load marketplace accounts</h2>
        <p className="mt-2 text-sm">
          The new online ops tables may not exist on this environment yet. Apply the latest Prisma migrations or check
          your database connection, then refresh this page.
        </p>
      </div>
    );
  }

  let attendants: Array<{
    id: string;
    name: string | null;
    email: string | null;
    role: string;
    attendantCategory: string | null;
  }> = [];
  try {
    attendants = await prisma.user.findMany({
      where: {
        role: { in: ["ATTENDANT", "SUPERVISOR"] },
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        attendantCategory: true,
      },
      orderBy: [{ name: "asc" }, { email: "asc" }],
      take: 200,
    });
  } catch (err) {
    console.error("Admin online accounts failed to load attendant directory:", err);
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <p className="text-xs uppercase tracking-wide text-slate-400">Accounts</p>
        <h2 className="text-xl font-semibold text-white">Marketplace account directory</h2>
        <p className="text-sm text-slate-400">
          View every configured Jumia / Kilimall account plus the attendants currently assigned via the API.
        </p>
      </header>

      <AccountAdminPanel
        accounts={rows.map((row) => ({ id: row.id, displayName: row.displayName, platform: row.platform }))}
        attendants={attendants}
      />

      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-slate-900/30">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
              <th className="px-4 py-3">Account</th>
              <th className="px-4 py-3">Platform</th>
              <th className="px-4 py-3">Identifiers</th>
              <th className="px-4 py-3">Assignments</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-white/5">
                <td className="px-4 py-4">
                  <div className="font-semibold text-white">{row.displayName}</div>
                  <div className="text-xs text-slate-400">
                    {row.countryCode} • {row.currency} • {row.isActive ? "Active" : "Disabled"}
                  </div>
                </td>
                <td className="px-4 py-4 capitalize text-slate-200">{row.platform.toLowerCase()}</td>
                <td className="px-4 py-4 text-xs text-slate-300">
                  {row.jumiaShopSid && (
                    <div>
                      <span className="text-slate-400">Shop SID:</span> {row.jumiaShopSid}
                    </div>
                  )}
                  {row.kilimallShopCode && (
                    <div>
                      <span className="text-slate-400">Kilimall code:</span> {row.kilimallShopCode}
                    </div>
                  )}
                  {!row.jumiaShopSid && !row.kilimallShopCode && <div className="text-slate-500">—</div>}
                </td>
                <td className="px-4 py-4">
                  {row.assignments.length === 0 && (
                    <div className="text-xs text-slate-500">No live assignments</div>
                  )}
                  <ul className="space-y-2">
                    {row.assignments.map((assignment) => (
                      <li key={`${row.id}-${assignment.attendantId}`} className="text-xs text-slate-200">
                        <div className="font-semibold text-white">
                          {assignment.attendantName || assignment.attendantEmail || assignment.attendantId}
                        </div>
                        <div className="text-slate-400">
                          {assignment.role}
                          {assignment.endsAt ? ` • ends ${assignment.endsAt.toLocaleDateString()}` : ""}
                        </div>
                      </li>
                    ))}
                  </ul>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-center text-sm text-slate-400" colSpan={4}>
                  No marketplace accounts have been created yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-100">
        To create or update accounts programmatically, continue using the{" "}
        <code className="text-amber-200">/api/admin/online/accounts</code> endpoint. A full-featured UI editor is on
        the roadmap, but this view gives admins immediate visibility into the data flowing through the new pipelines.
      </div>
    </div>
  );
}
