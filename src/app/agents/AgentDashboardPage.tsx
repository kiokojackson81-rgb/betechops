import Link from "next/link";
import { redirect } from "next/navigation";
import { ClipboardList, Copy, CreditCard, Percent, UserCircle2, Wallet } from "lucide-react";
import { requireAgentSession } from "@/lib/agents/auth";
import { agentPath } from "@/lib/agents/host";
import { getAgentDashboardData } from "@/lib/agents/service";

const money = (value: number) =>
  new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(value || 0);

const metricStyles = [
  "from-emerald-500/20 via-emerald-400/10 to-transparent",
  "from-cyan-500/20 via-sky-400/10 to-transparent",
  "from-amber-500/20 via-orange-400/10 to-transparent",
  "from-fuchsia-500/20 via-violet-400/10 to-transparent",
  "from-lime-500/20 via-emerald-300/10 to-transparent",
  "from-slate-500/20 via-slate-300/10 to-transparent",
];

type AgentDashboardPageProps = {
  useRootPaths?: boolean;
};

export default async function AgentDashboardPage({ useRootPaths = false }: AgentDashboardPageProps) {
  const agentSession = await requireAgentSession();
  if (!agentSession) redirect(agentPath("/login", useRootPaths));

  const dashboard = await getAgentDashboardData(agentSession.userId);
  if (!dashboard) redirect(agentPath("/register", useRootPaths));
  const status = String(dashboard.profile.status || "").toLowerCase();

  if (status === "pending") {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.16),transparent_25%),linear-gradient(180deg,#020617_0%,#0f172a_55%,#020617_100%)] px-6 py-10 text-slate-100">
        <div className="mx-auto max-w-3xl rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,.95),rgba(2,6,23,.98))] p-10 text-center shadow-[0_24px_80px_rgba(0,0,0,.35)]">
          <div className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-300">Account under review</div>
          <h1 className="mt-4 text-4xl font-semibold text-white">Your agent account is pending approval</h1>
          <p className="mt-4 text-sm text-slate-400">
            We have your registration and KYC details. An admin needs to approve the account before the full dashboard is available.
          </p>
          <div className="mt-6 text-sm text-slate-500">Referral code: {dashboard.profile.referralCode}</div>
        </div>
      </div>
    );
  }

  if (status === "rejected" || status === "suspended") {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(244,63,94,0.16),transparent_25%),linear-gradient(180deg,#020617_0%,#0f172a_55%,#020617_100%)] px-6 py-10 text-slate-100">
        <div className="mx-auto max-w-3xl rounded-[32px] border border-rose-500/20 bg-[linear-gradient(180deg,rgba(15,23,42,.95),rgba(2,6,23,.98))] p-10 text-center shadow-[0_24px_80px_rgba(0,0,0,.35)]">
          <div className="text-xs font-semibold uppercase tracking-[0.28em] text-rose-300">Access blocked</div>
          <h1 className="mt-4 text-4xl font-semibold text-white">
            {status === "suspended" ? "Your account is suspended" : "Your application was rejected"}
          </h1>
          <p className="mt-4 text-sm text-slate-400">
            This dashboard is only available to approved agents. Contact BETECH support or an administrator if you need clarification.
          </p>
        </div>
      </div>
    );
  }

  const metrics = [
    { label: "Total submitted sales", value: String(dashboard.salesSummary.totalSubmittedSales), note: "All sales you have logged" },
    { label: "Pending sales", value: String(dashboard.salesSummary.pendingSales), note: "Review and payment stages" },
    { label: "Sales in progress", value: String(dashboard.salesSummary.processingSales), note: "Processing, dispatched, or delivered" },
    { label: "Completed sales", value: String(dashboard.salesSummary.completedSales), note: "Paid in full and delivered" },
    { label: "Potential commission", value: money(dashboard.salesSummary.potentialCommission), note: "Locked until completed" },
    { label: "Earned commission", value: money(dashboard.salesSummary.earnedCommission), note: "Unlocked but not yet paid" },
    { label: "Paid commission", value: money(dashboard.salesSummary.paidCommission), note: "Already settled" },
    { label: "Success rate", value: `${dashboard.metrics.successRate}%`, note: "Paid commission entries over total entries" },
  ];

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.16),transparent_25%),linear-gradient(180deg,#020617_0%,#0f172a_55%,#020617_100%)] px-6 py-10 text-slate-100">
      <div className="mx-auto max-w-7xl space-y-8">
        <section className="rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,.95),rgba(2,6,23,.98))] p-8 shadow-[0_24px_80px_rgba(0,0,0,.35)]">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="space-y-3">
              <div className="inline-flex rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-emerald-200">
                Agent dashboard
              </div>
              <h1 className="text-4xl font-semibold tracking-tight text-white">Welcome back, {dashboard.displayName}</h1>
              <p className="max-w-3xl text-sm text-slate-400">
                Monitor your affiliate performance, update profile details, and manage commission and payout activity from one place.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href={agentPath("/sales/new", useRootPaths)}
                className="rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:brightness-95"
              >
                Submit sale
              </Link>
              <Link
                href={agentPath("/sales", useRootPaths)}
                className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:border-white/20"
              >
                View sales
              </Link>
              <div className="rounded-[28px] border border-white/10 bg-white/[0.03] px-5 py-4">
                <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Account status</div>
                <div className="mt-2 text-2xl font-semibold text-white">{dashboard.profile.status}</div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {metrics.map((item, index) => (
            <div key={item.label} className="relative overflow-hidden rounded-[28px] border border-white/10 bg-slate-950/80 p-5">
              <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${metricStyles[index % metricStyles.length]}`} />
              <div className="relative">
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">{item.label}</div>
                <div className="mt-3 text-3xl font-semibold text-white">{item.value}</div>
                <div className="mt-2 text-sm text-slate-400">{item.note}</div>
              </div>
            </div>
          ))}
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-6">
            <div className="rounded-[28px] border border-amber-400/20 bg-amber-400/10 p-6">
              <div className="flex items-center gap-3">
                <ClipboardList className="h-5 w-5 text-amber-200" />
                <h2 className="text-xl font-semibold text-white">Sales and commission motivation</h2>
              </div>
              <div className="mt-4 grid gap-3 text-sm text-amber-50 md:grid-cols-2">
                <div>Potential commission: {money(dashboard.salesSummary.potentialCommission)}</div>
                <div>Earned commission: {money(dashboard.salesSummary.earnedCommission)}</div>
                <div>Paid commission: {money(dashboard.salesSummary.paidCommission)}</div>
                <div>Sales in progress: {dashboard.salesSummary.processingSales}</div>
              </div>
              <p className="mt-4 text-sm text-amber-50/85">
                Potential commission appears as soon as you submit a sale. It unlocks only after the customer pays in full and the order is delivered or collected.
              </p>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6">
              <div className="flex items-center gap-3">
                <UserCircle2 className="h-5 w-5 text-cyan-300" />
                <h2 className="text-xl font-semibold text-white">Personal Info</h2>
              </div>
              <div className="mt-5 grid gap-4 text-sm text-slate-300 md:grid-cols-2">
                <div>Name: {dashboard.displayName}</div>
                <div>Email: {dashboard.profile.email || dashboard.profile.user.email || "Not set"}</div>
                <div>Phone: {dashboard.profile.phone || "Not set"}</div>
                <div>Location: {[dashboard.profile.city, dashboard.profile.county, dashboard.profile.country].filter(Boolean).join(", ") || "Not set"}</div>
                <div>National ID: {dashboard.profile.nationalId || "Pending"}</div>
                <div>KRA PIN: {dashboard.profile.kraPin || "Pending"}</div>
              </div>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6">
              <div className="flex items-center gap-3">
                <Wallet className="h-5 w-5 text-emerald-300" />
                <h2 className="text-xl font-semibold text-white">Payment Account</h2>
              </div>
              <div className="mt-5 space-y-2 text-sm text-slate-300">
                <div>Preferred phone: {dashboard.profile.phone || "Add your payout phone in profile settings"}</div>
                <div>Agent status: {dashboard.profile.status}</div>
                <div>Payout requests submitted: {dashboard.payouts.length}</div>
              </div>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6">
              <div className="flex items-center gap-3">
                <Copy className="h-5 w-5 text-amber-300" />
                <h2 className="text-xl font-semibold text-white">Referral Link</h2>
              </div>
              <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/70 p-4 text-sm text-slate-200">
                {dashboard.referralLink}
              </div>
              <div className="mt-3 text-xs text-slate-500">Share this link or your code: {dashboard.profile.referralCode}</div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6">
              <div className="flex items-center gap-3">
                <Percent className="h-5 w-5 text-fuchsia-300" />
                <h2 className="text-xl font-semibold text-white">Commission History</h2>
              </div>
              <div className="mt-5 space-y-3">
                {dashboard.commissions.length ? dashboard.commissions.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="font-medium text-white">{item.sourceType}</div>
                        <div className="text-xs text-slate-500">{item.orderNumber || "No order"} · {item.status}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-white">{money(Number(item.commissionAmt ?? 0))}</div>
                        <div className="text-xs text-slate-500">{new Date(item.createdAt).toLocaleDateString()}</div>
                      </div>
                    </div>
                  </div>
                )) : <div className="text-sm text-slate-500">No commissions recorded yet.</div>}
              </div>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6">
              <div className="flex items-center gap-3">
                <ClipboardList className="h-5 w-5 text-cyan-300" />
                <h2 className="text-xl font-semibold text-white">Recent sales</h2>
              </div>
              <div className="mt-5 space-y-3">
                {dashboard.sales.length ? dashboard.sales.slice(0, 6).map((sale) => (
                  <div key={sale.id} className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="font-medium text-white">{sale.customerName}</div>
                        <div className="text-xs text-slate-500">
                          {sale.productName} · {sale.statusMeta.label} · {sale.receiptNumber || "No receipt"}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-white">
                          {sale.status === "completed" ? "Earned commission" : "Potential commission"}
                        </div>
                        <div className="text-xs text-amber-200">{money(sale.commissionAmount)}</div>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <div className="text-xs text-slate-500">{sale.commissionBadge}</div>
                      <Link href={agentPath(`/sales/${sale.id}`, useRootPaths)} className="text-sm font-medium text-cyan-300 hover:text-cyan-200">
                        Open sale
                      </Link>
                    </div>
                  </div>
                )) : <div className="text-sm text-slate-500">No sales submitted yet.</div>}
              </div>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6">
              <div className="flex items-center gap-3">
                <CreditCard className="h-5 w-5 text-lime-300" />
                <h2 className="text-xl font-semibold text-white">Payout Requests</h2>
              </div>
              <div className="mt-5 space-y-3">
                {dashboard.payouts.length ? dashboard.payouts.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="font-medium text-white">{item.method || "Unspecified method"}</div>
                        <div className="text-xs text-slate-500">{item.reference || "No reference"} · {item.status}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-white">{money(Number(item.amount ?? 0))}</div>
                        <div className="text-xs text-slate-500">{new Date(item.createdAt).toLocaleDateString()}</div>
                      </div>
                    </div>
                  </div>
                )) : <div className="text-sm text-slate-500">No payout requests yet.</div>}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-white">Agent activity</h2>
              <p className="mt-1 text-sm text-slate-400">Recent registration, approval, and payout events.</p>
            </div>
            <div className="flex gap-3">
              <Link href="/api/agents/profile" className="rounded-2xl border border-white/10 px-4 py-2 text-sm text-slate-200 transition hover:border-white/20">
                Profile API
              </Link>
              <Link href="/api/agents/commissions" className="rounded-2xl border border-white/10 px-4 py-2 text-sm text-slate-200 transition hover:border-white/20">
                Commissions API
              </Link>
            </div>
          </div>
          <div className="mt-5 grid gap-3 lg:grid-cols-3">
            {dashboard.activities.length ? dashboard.activities.map((item) => (
              <div key={item.id} className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                <div className="text-sm font-semibold text-white">{item.action}</div>
                <div className="mt-2 text-sm text-slate-400">{item.description || "No extra details"}</div>
                <div className="mt-2 text-xs text-slate-500">{new Date(item.createdAt).toLocaleString()}</div>
              </div>
            )) : <div className="text-sm text-slate-500">No activity logged yet.</div>}
          </div>
        </section>
      </div>
    </div>
  );
}
