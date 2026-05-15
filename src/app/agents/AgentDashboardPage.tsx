import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, CircleDollarSign, ClipboardList, CreditCard, PlusCircle, UserRound, Wallet } from "lucide-react";
import AgentPortalShell from "@/app/agents/_components/AgentPortalShell";
import { requireAgentSession } from "@/lib/agents/auth";
import { agentPath } from "@/lib/agents/host";
import { getAgentDashboardData } from "@/lib/agents/service";

const money = (value: number) =>
  new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format(value || 0);

const statCards = [
  { key: "totalSubmittedSales", label: "Total submitted sales", tone: "bg-[#fff3cf] text-[#5a4300]" },
  { key: "pendingSales", label: "Pending sales", tone: "bg-[#fffaf5] text-slate-700" },
  { key: "processingSales", label: "Sales in progress", tone: "bg-[#f1f8ff] text-[#174c7a]" },
  { key: "completedSales", label: "Completed sales", tone: "bg-[#edf9f0] text-[#136233]" },
  { key: "potentialCommission", label: "Potential commission", tone: "bg-[#fff3cf] text-[#5a4300]", money: true },
  { key: "earnedCommission", label: "Earned commission", tone: "bg-[#fceeee] text-[#7a0000]", money: true },
  { key: "paidCommission", label: "Paid commission", tone: "bg-[#edf9f0] text-[#136233]", money: true },
] as const;

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
      <div className="min-h-screen bg-[#f7f1eb] px-6 py-10">
        <div className="mx-auto max-w-3xl rounded-[32px] border border-[#e4d4cb] bg-white p-10 text-center shadow-[0_24px_80px_rgba(64,32,18,0.08)]">
          <div className="text-xs font-semibold uppercase tracking-[0.28em] text-[#7a0000]">Account under review</div>
          <h1 className="mt-4 text-4xl font-black tracking-tight text-[#210505]">Your agent account is pending approval</h1>
          <p className="mt-4 text-sm text-slate-600">
            We have your registration details. An admin needs to approve the account before your full sales dashboard and payout tools are unlocked.
          </p>
          <div className="mt-6 text-sm text-slate-500">Referral code: {dashboard.profile.referralCode}</div>
        </div>
      </div>
    );
  }

  if (status === "rejected" || status === "suspended") {
    return (
      <div className="min-h-screen bg-[#f7f1eb] px-6 py-10">
        <div className="mx-auto max-w-3xl rounded-[32px] border border-rose-200 bg-white p-10 text-center shadow-[0_24px_80px_rgba(64,32,18,0.08)]">
          <div className="text-xs font-semibold uppercase tracking-[0.28em] text-rose-600">Access blocked</div>
          <h1 className="mt-4 text-4xl font-black tracking-tight text-[#210505]">
            {status === "suspended" ? "Your account is suspended" : "Your application was rejected"}
          </h1>
          <p className="mt-4 text-sm text-slate-600">
            This workspace is only available to approved BETECH agents. Contact support or an administrator if you need clarification.
          </p>
        </div>
      </div>
    );
  }

  return (
    <AgentPortalShell
      useRootPaths={useRootPaths}
      title="Overview"
      description="Track your pipeline, potential commission, earned payouts, and the key actions that move your sales from referral to payment."
      agent={{
        displayName: dashboard.displayName,
        email: dashboard.profile.email || dashboard.profile.user.email,
        status: String(dashboard.profile.status || ""),
        referralCode: dashboard.profile.referralCode,
        payoutPhone: dashboard.profile.phone,
      }}
      stats={{
        potentialCommission: dashboard.salesSummary.potentialCommission,
        earnedCommission: dashboard.salesSummary.earnedCommission,
        paidCommission: dashboard.salesSummary.paidCommission,
      }}
    >
      <div className="space-y-6">
        <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-[30px] bg-[linear-gradient(135deg,#7a0000_0%,#3c0909_100%)] p-7 text-white shadow-[0_20px_60px_rgba(64,10,10,0.28)]">
            <div className="inline-flex rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-[#f5d88f]">
              Welcome back
            </div>
            <h2 className="mt-4 text-3xl font-black tracking-tight">Build your solar sales pipeline with clarity</h2>
            <p className="mt-3 max-w-2xl text-sm text-white/78">
              Submit customer opportunities, watch them move through payment and delivery, and see exactly when your 6% commission becomes earned.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href={agentPath("/sales/new", useRootPaths)}
                className="rounded-2xl bg-[#f1b81d] px-5 py-3 text-sm font-semibold text-[#4d0808] transition hover:brightness-95"
              >
                Submit new sale
              </Link>
              <Link
                href={agentPath("/sales", useRootPaths)}
                className="rounded-2xl border border-white/15 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                View all sales
              </Link>
              <Link
                href={agentPath("/profile/payment-method", useRootPaths)}
                className="rounded-2xl border border-white/15 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Manage payout setup
              </Link>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-1">
            <div className="rounded-[28px] border border-[#e4d4cb] bg-white p-5 shadow-[0_12px_40px_rgba(64,32,18,0.08)]">
              <div className="flex items-center gap-3 text-[#7a0000]">
                <Wallet className="h-5 w-5" />
                <div className="text-sm font-semibold uppercase tracking-[0.18em]">Potential Commission</div>
              </div>
              <div className="mt-3 text-3xl font-black tracking-tight text-[#210505]">{money(dashboard.salesSummary.potentialCommission)}</div>
              <p className="mt-2 text-sm text-slate-600">Locked until full payment and delivery are confirmed.</p>
            </div>
            <div className="rounded-[28px] border border-[#e4d4cb] bg-white p-5 shadow-[0_12px_40px_rgba(64,32,18,0.08)]">
              <div className="flex items-center gap-3 text-[#7a0000]">
                <CircleDollarSign className="h-5 w-5" />
                <div className="text-sm font-semibold uppercase tracking-[0.18em]">Earned Commission</div>
              </div>
              <div className="mt-3 text-3xl font-black tracking-tight text-[#210505]">{money(dashboard.salesSummary.earnedCommission)}</div>
              <p className="mt-2 text-sm text-slate-600">Completed sales waiting for payout processing.</p>
            </div>
            <div className="rounded-[28px] border border-[#e4d4cb] bg-white p-5 shadow-[0_12px_40px_rgba(64,32,18,0.08)]">
              <div className="flex items-center gap-3 text-[#7a0000]">
                <CreditCard className="h-5 w-5" />
                <div className="text-sm font-semibold uppercase tracking-[0.18em]">Payout Method</div>
              </div>
              <div className="mt-3 text-xl font-black tracking-tight text-[#210505]">{dashboard.profile.phone || "Add M-Pesa number"}</div>
              <p className="mt-2 text-sm text-slate-600">Current agent payouts are processed through M-Pesa.</p>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {statCards.map((item) => {
            const value = dashboard.salesSummary[item.key];
            return (
              <article
                key={item.label}
                className={`rounded-[26px] border border-[#e4d4cb] p-5 shadow-[0_12px_40px_rgba(64,32,18,0.06)] ${item.tone}`}
              >
                <div className="text-xs font-semibold uppercase tracking-[0.2em]">{item.label}</div>
                <div className="mt-3 text-3xl font-black tracking-tight text-[#210505]">
                  {"money" in item && item.money ? money(Number(value || 0)) : String(value)}
                </div>
              </article>
            );
          })}
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-6">
            <article className="rounded-[28px] border border-[#e4d4cb] bg-white p-6 shadow-[0_12px_40px_rgba(64,32,18,0.08)]">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#7a0000]">Quick actions</p>
                  <h3 className="mt-2 text-2xl font-black tracking-tight text-[#210505]">What you can do next</h3>
                </div>
              </div>
              <div className="mt-5 grid gap-4 md:grid-cols-3">
                <Link href={agentPath("/sales/new", useRootPaths)} className="rounded-[24px] border border-[#e4d4cb] bg-[#fffaf5] p-4 transition hover:-translate-y-0.5 hover:shadow-[0_12px_25px_rgba(64,32,18,0.08)]">
                  <PlusCircle className="h-5 w-5 text-[#7a0000]" />
                  <div className="mt-4 text-lg font-semibold text-[#210505]">Submit sale</div>
                  <p className="mt-2 text-sm text-slate-600">Capture a new customer opportunity and lock in potential commission.</p>
                </Link>
                <Link href={agentPath("/profile", useRootPaths)} className="rounded-[24px] border border-[#e4d4cb] bg-[#fffaf5] p-4 transition hover:-translate-y-0.5 hover:shadow-[0_12px_25px_rgba(64,32,18,0.08)]">
                  <UserRound className="h-5 w-5 text-[#7a0000]" />
                  <div className="mt-4 text-lg font-semibold text-[#210505]">Update profile</div>
                  <p className="mt-2 text-sm text-slate-600">Keep your contact, KRA, and ID details ready for approvals and payouts.</p>
                </Link>
                <Link href={agentPath("/profile/payment-method", useRootPaths)} className="rounded-[24px] border border-[#e4d4cb] bg-[#fffaf5] p-4 transition hover:-translate-y-0.5 hover:shadow-[0_12px_25px_rgba(64,32,18,0.08)]">
                  <CreditCard className="h-5 w-5 text-[#7a0000]" />
                  <div className="mt-4 text-lg font-semibold text-[#210505]">Set payout method</div>
                  <p className="mt-2 text-sm text-slate-600">Make sure BETECH has the correct M-Pesa number before you request payouts.</p>
                </Link>
              </div>
            </article>

            <article className="rounded-[28px] border border-[#e4d4cb] bg-white p-6 shadow-[0_12px_40px_rgba(64,32,18,0.08)]">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#7a0000]">Recent sales</p>
                  <h3 className="mt-2 text-2xl font-black tracking-tight text-[#210505]">Sales in motion</h3>
                </div>
                <Link href={agentPath("/sales", useRootPaths)} className="text-sm font-semibold text-[#7a0000] hover:text-[#5d0000]">
                  View all
                </Link>
              </div>
              <div className="mt-5 space-y-3">
                {dashboard.sales.length ? dashboard.sales.slice(0, 5).map((sale) => (
                  <div key={sale.id} className="rounded-[24px] border border-[#ece1d9] bg-[#fffaf5] p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="font-semibold text-[#210505]">{sale.customerName}</div>
                        <div className="mt-1 text-sm text-slate-600">
                          {sale.productName} · {sale.statusMeta.label} · {sale.receiptNumber || "No receipt linked"}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-[#210505]">
                          {sale.status === "completed" ? "Earned" : "Potential"}
                        </div>
                        <div className="text-sm text-[#7a0000]">{money(sale.commissionAmount)}</div>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-4">
                      <span className="rounded-full bg-[#fff3cf] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#7a0000]">
                        {sale.commissionBadge}
                      </span>
                      <Link
                        href={agentPath(`/sales/${sale.id}`, useRootPaths)}
                        className="inline-flex items-center gap-2 text-sm font-semibold text-[#7a0000] hover:text-[#5d0000]"
                      >
                        Open sale <ArrowRight className="h-4 w-4" />
                      </Link>
                    </div>
                  </div>
                )) : (
                  <div className="rounded-[24px] border border-dashed border-[#d9c6ba] bg-[#fffaf5] p-8 text-center text-sm text-slate-500">
                    No sales submitted yet. Start by adding your first customer opportunity.
                  </div>
                )}
              </div>
            </article>
          </div>

          <div className="space-y-6">
            <article className="rounded-[28px] border border-[#e4d4cb] bg-white p-6 shadow-[0_12px_40px_rgba(64,32,18,0.08)]">
              <div className="flex items-center gap-3">
                <ClipboardList className="h-5 w-5 text-[#7a0000]" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#7a0000]">Commission pipeline</p>
                  <h3 className="mt-1 text-2xl font-black tracking-tight text-[#210505]">Refer → Earn → Withdraw</h3>
                </div>
              </div>
              <div className="mt-5 space-y-4">
                <div className="rounded-[24px] bg-[#fff3cf] p-4">
                  <div className="text-sm font-semibold text-[#210505]">Potential commission</div>
                  <p className="mt-1 text-sm text-[#6a5000]">Appears immediately after you submit a sale.</p>
                </div>
                <div className="rounded-[24px] bg-[#fceeee] p-4">
                  <div className="text-sm font-semibold text-[#210505]">Earned commission</div>
                  <p className="mt-1 text-sm text-[#7a0000]">Unlocks only after full payment and delivery confirmation.</p>
                </div>
                <div className="rounded-[24px] bg-[#edf9f0] p-4">
                  <div className="text-sm font-semibold text-[#210505]">Paid commission</div>
                  <p className="mt-1 text-sm text-[#136233]">Moves here once BETECH processes your payout.</p>
                </div>
              </div>
            </article>

            <article className="rounded-[28px] border border-[#e4d4cb] bg-white p-6 shadow-[0_12px_40px_rgba(64,32,18,0.08)]">
              <div className="flex items-center gap-3">
                <CreditCard className="h-5 w-5 text-[#7a0000]" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#7a0000]">Payout activity</p>
                  <h3 className="mt-1 text-2xl font-black tracking-tight text-[#210505]">Recent payout requests</h3>
                </div>
              </div>
              <div className="mt-5 space-y-3">
                {dashboard.payouts.length ? dashboard.payouts.slice(0, 4).map((item) => (
                  <div key={item.id} className="rounded-[24px] border border-[#ece1d9] bg-[#fffaf5] p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="font-semibold text-[#210505]">{item.method || "M-Pesa payout"}</div>
                        <div className="mt-1 text-sm text-slate-600">{item.reference || "Awaiting reference"} · {item.status}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-[#210505]">{money(Number(item.amount || 0))}</div>
                        <div className="text-xs text-slate-500">{new Date(item.createdAt).toLocaleDateString()}</div>
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="rounded-[24px] border border-dashed border-[#d9c6ba] bg-[#fffaf5] p-6 text-sm text-slate-500">
                    No payout requests yet. Save your M-Pesa number, then request payouts when commissions are ready.
                  </div>
                )}
              </div>
            </article>

            <article className="rounded-[28px] border border-[#e4d4cb] bg-white p-6 shadow-[0_12px_40px_rgba(64,32,18,0.08)]">
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[#7a0000]">Recent activity</div>
              <div className="mt-4 space-y-3">
                {dashboard.activities.length ? dashboard.activities.map((item) => (
                  <div key={item.id} className="rounded-[24px] border border-[#ece1d9] bg-[#fffaf5] p-4">
                    <div className="font-semibold text-[#210505]">{item.action}</div>
                    <div className="mt-1 text-sm text-slate-600">{item.description || "No extra details"}</div>
                    <div className="mt-2 text-xs text-slate-500">{new Date(item.createdAt).toLocaleString()}</div>
                  </div>
                )) : (
                  <div className="rounded-[24px] border border-dashed border-[#d9c6ba] bg-[#fffaf5] p-6 text-sm text-slate-500">
                    No activity logged yet.
                  </div>
                )}
              </div>
            </article>
          </div>
        </section>
      </div>
    </AgentPortalShell>
  );
}
