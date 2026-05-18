import { redirect } from "next/navigation";
import AgentPortalShell from "@/app/agents/_components/AgentPortalShell";
import AgentWithdrawalRequestForm from "@/app/agents/_components/AgentWithdrawalRequestForm";
import { requireAgentSession } from "@/lib/agents/auth";
import { agentPath } from "@/lib/agents/host";
import { getAgentDashboardData } from "@/lib/agents/service";

const money = (value: number) =>
  new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format(value || 0);

type AgentWithdrawalsPageProps = {
  useRootPaths?: boolean;
};

export default async function AgentWithdrawalsPage({ useRootPaths = false }: AgentWithdrawalsPageProps) {
  const agentSession = await requireAgentSession();
  if (!agentSession) redirect(agentPath("/login", useRootPaths));

  const dashboard = await getAgentDashboardData(agentSession.userId);
  if (!dashboard) redirect(agentPath("/register", useRootPaths));

  const profile = dashboard.profile;
  const eligibleCommission = dashboard.commissions
    .filter((item) => ["approved", "paid"].includes(String(item.status || "").toLowerCase()))
    .reduce((sum, item) => sum + Number(item.commissionAmt ?? 0), 0);
  const reservedPayouts = dashboard.payouts
    .filter((item) => !["rejected", "cancelled"].includes(String(item.status || "").toLowerCase()))
    .reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
  const pendingPayoutAmount = dashboard.payouts
    .filter((item) => !["paid", "rejected", "cancelled"].includes(String(item.status || "").toLowerCase()))
    .reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
  const paidPayoutAmount = dashboard.payouts
    .filter((item) => String(item.status || "").toLowerCase() === "paid")
    .reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
  const availableAmount = Math.max(0, eligibleCommission - reservedPayouts);

  return (
    <AgentPortalShell
      useRootPaths={useRootPaths}
      title="Withdrawals"
      description="Request commission withdrawals, see what is available now, and track the payouts already in progress."
      agent={{
        displayName: dashboard.displayName,
        email: profile.email || profile.user.email,
        status: String(profile.status || ""),
        referralCode: profile.referralCode,
        payoutPhone: profile.phone,
      }}
      stats={{
        potentialCommission: dashboard.salesSummary.potentialCommission,
        earnedCommission: dashboard.salesSummary.earnedCommission,
        paidCommission: dashboard.salesSummary.paidCommission,
      }}
    >
      <div className="grid gap-6 xl:grid-cols-[1.02fr_0.98fr]">
        <AgentWithdrawalRequestForm
          availableAmount={availableAmount}
          pendingAmount={pendingPayoutAmount}
          paidAmount={paidPayoutAmount}
          phone={profile.phone || ""}
        />

        <div className="space-y-6">
          <section className="rounded-[28px] border border-[#e4d4cb] bg-white p-6 shadow-[0_12px_40px_rgba(64,32,18,0.08)]">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#7a0000]">Withdrawal procedure</p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-[#210505]">How commission moves to your M-Pesa</h2>
            <div className="mt-5 space-y-3">
              {[
                "1. Submit customer orders and let BETECH complete payment and delivery.",
                "2. Once commission is unlocked, it becomes available for withdrawal.",
                "3. Request withdrawal here using your saved M-Pesa number.",
                "4. Admin reviews the request and processes payout.",
                "5. Your withdrawal history and status update here automatically.",
              ].map((item) => (
                <div key={item} className="rounded-[20px] border border-[#ece1d9] bg-[#fffaf5] px-4 py-3 text-sm text-slate-700">
                  {item}
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[28px] border border-[#e4d4cb] bg-white p-6 shadow-[0_12px_40px_rgba(64,32,18,0.08)]">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#7a0000]">Recent withdrawal activity</p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-[#210505]">Your payout requests</h2>
            <div className="mt-5 space-y-3">
              {dashboard.payouts.length ? dashboard.payouts.slice(0, 6).map((item) => (
                <div key={item.id} className="rounded-[24px] border border-[#ece1d9] bg-[#fffaf5] p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-semibold text-[#210505]">{item.method || "M-Pesa withdrawal"}</div>
                      <div className="mt-1 text-sm text-slate-600">
                        {String(item.status || "").replace(/_/g, " ")} · {item.reference || "Awaiting admin reference"}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-[#210505]">{money(Number(item.amount || 0))}</div>
                      <div className="text-xs text-slate-500">{new Date(item.createdAt).toLocaleDateString()}</div>
                    </div>
                  </div>
                </div>
              )) : (
                <div className="rounded-[24px] border border-dashed border-[#d9c6ba] bg-[#fffaf5] p-6 text-sm text-slate-500">
                  No withdrawal requests yet. Once you have commission available, you can request payout from this page.
                </div>
              )}
            </div>
          </section>

          <section className="rounded-[28px] border border-[#f1b81d]/30 bg-[#fff3cf] p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#7a0000]">Balance overview</p>
            <div className="mt-4 space-y-3 text-sm text-[#5a4300]">
              <div className="flex items-center justify-between gap-4">
                <span>Commission unlocked for withdrawal</span>
                <span className="font-semibold text-[#210505]">{money(eligibleCommission)}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>Already requested or paid out</span>
                <span className="font-semibold text-[#210505]">{money(reservedPayouts)}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>Available to request now</span>
                <span className="font-semibold text-[#210505]">{money(availableAmount)}</span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </AgentPortalShell>
  );
}
