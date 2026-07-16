import { redirect } from "next/navigation";
import AgentPortalShell from "@/app/agents/_components/AgentPortalShell";
import AgentReviewReferralWithdrawalForm from "@/app/agents/_components/AgentReviewReferralWithdrawalForm";
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
  if (!agentSession) redirect(agentPath("/login"));

  const dashboard = await getAgentDashboardData(agentSession.userId);
  if (!dashboard) redirect(agentPath("/register"));

  const profile = dashboard.profile;
  const eligibleCommission = dashboard.commissions
    .filter((item) => String(item.status || "").toLowerCase() === "approved")
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
  const reviewReferralAvailableAmount = Number(dashboard.reviewReferralSummary.totals.availableBalance || 0);
  const reviewReferralPendingAmount = Number(dashboard.reviewReferralSummary.totals.pendingWithdrawalAmount || 0);
  const reviewReferralPaidAmount = Number(dashboard.reviewReferralSummary.totals.paidWithdrawalAmount || 0);
  const combinedPotentialCommission =
    Number(dashboard.salesSummary.potentialCommission || 0) + Number(dashboard.reviewReferralSummary.totals.potentialCommission || 0);
  const combinedEarnedCommission = Number(dashboard.salesSummary.earnedCommission || 0) + reviewReferralAvailableAmount;
  const combinedPaidCommission = Number(dashboard.salesSummary.paidCommission || 0) + reviewReferralPaidAmount;

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
        potentialCommission: combinedPotentialCommission,
        earnedCommission: combinedEarnedCommission,
        paidCommission: combinedPaidCommission,
      }}
    >
      <div className="grid gap-5 sm:gap-6 xl:grid-cols-[1.02fr_0.98fr]">
        <div className="space-y-5 sm:space-y-6">
          <AgentWithdrawalRequestForm
            availableAmount={availableAmount}
            pendingAmount={pendingPayoutAmount}
            paidAmount={paidPayoutAmount}
            phone={profile.phone || ""}
          />
          <AgentReviewReferralWithdrawalForm
            availableAmount={reviewReferralAvailableAmount}
            pendingAmount={reviewReferralPendingAmount}
            paidAmount={reviewReferralPaidAmount}
          />
        </div>

        <div className="space-y-6">
          <section className="rounded-[28px] border border-[#e4d4cb] bg-white p-4 shadow-[0_12px_40px_rgba(64,32,18,0.08)] sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#7a0000]">Withdrawal procedure</p>
            <h2 className="mt-2 text-xl font-black tracking-tight text-[#210505] sm:text-2xl">How commission moves to your M-Pesa</h2>
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

          <section className="rounded-[28px] border border-[#e4d4cb] bg-white p-4 shadow-[0_12px_40px_rgba(64,32,18,0.08)] sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#7a0000]">Recent withdrawal activity</p>
            <h2 className="mt-2 text-xl font-black tracking-tight text-[#210505] sm:text-2xl">Your payout requests</h2>
            <div className="mt-5 space-y-3">
              {dashboard.payouts.length ? dashboard.payouts.slice(0, 6).map((item) => (
                <div key={item.id} className="rounded-[24px] border border-[#ece1d9] bg-[#fffaf5] p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
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

          <section className="rounded-[28px] border border-[#e4d4cb] bg-white p-4 shadow-[0_12px_40px_rgba(64,32,18,0.08)] sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#7a0000]">Review referral withdrawals</p>
            <h2 className="mt-2 text-xl font-black tracking-tight text-[#210505] sm:text-2xl">Customer review referral payout requests</h2>
            <div className="mt-5 space-y-3">
              {dashboard.reviewReferralSummary.withdrawals.length ? dashboard.reviewReferralSummary.withdrawals.slice(0, 6).map((item) => (
                <div key={item.id} className="rounded-[24px] border border-[#ece1d9] bg-[#fffaf5] p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="font-semibold text-[#210505]">{String(item.method || "M_PESA").replace(/_/g, " ")}</div>
                      <div className="mt-1 text-sm text-slate-600">
                        {String(item.status || "").replace(/_/g, " ")} · {item.reference || "Awaiting admin reference"}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-[#210505]">{money(Number(item.amount || 0))}</div>
                      <div className="text-xs text-slate-500">{item.createdAt ? new Date(item.createdAt).toLocaleDateString() : "Not available"}</div>
                    </div>
                  </div>
                </div>
              )) : (
                <div className="rounded-[24px] border border-dashed border-[#d9c6ba] bg-[#fffaf5] p-6 text-sm text-slate-500">
                  No customer review referral withdrawal requests yet.
                </div>
              )}
            </div>
          </section>

          <section className="rounded-[28px] border border-[#f1b81d]/30 bg-[#fff3cf] p-4 sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#7a0000]">Balance overview</p>
            <div className="mt-4 space-y-3 text-sm text-[#5a4300]">
              <div className="flex items-center justify-between gap-4">
                <span>Agent sales unlocked for withdrawal</span>
                <span className="font-semibold text-[#210505]">{money(eligibleCommission)}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>Agent sales already requested or paid out</span>
                <span className="font-semibold text-[#210505]">{money(reservedPayouts)}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>Review referral balance available now</span>
                <span className="font-semibold text-[#210505]">{money(reviewReferralAvailableAmount)}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>Combined available to request now</span>
                <span className="font-semibold text-[#210505]">{money(availableAmount + reviewReferralAvailableAmount)}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>Review referral already withdrawn</span>
                <span className="font-semibold text-[#210505]">{money(reviewReferralPaidAmount)}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>Review referral awaiting payout</span>
                <span className="font-semibold text-[#210505]">{money(reviewReferralPendingAmount)}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>Total available to request now</span>
                <span className="font-semibold text-[#210505]">{money(availableAmount + reviewReferralAvailableAmount)}</span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </AgentPortalShell>
  );
}
