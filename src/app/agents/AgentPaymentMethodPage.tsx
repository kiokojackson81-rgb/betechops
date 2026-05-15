import { redirect } from "next/navigation";
import AgentPortalShell from "@/app/agents/_components/AgentPortalShell";
import AgentPaymentMethodForm from "@/app/agents/_components/AgentPaymentMethodForm";
import { requireAgentSession } from "@/lib/agents/auth";
import { agentPath } from "@/lib/agents/host";
import { getAgentDashboardData } from "@/lib/agents/service";

const money = (value: number) =>
  new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format(value || 0);

type AgentPaymentMethodPageProps = {
  useRootPaths?: boolean;
};

export default async function AgentPaymentMethodPage({ useRootPaths = false }: AgentPaymentMethodPageProps) {
  const agentSession = await requireAgentSession();
  if (!agentSession) redirect(agentPath("/login", useRootPaths));

  const dashboard = await getAgentDashboardData(agentSession.userId);
  if (!dashboard) redirect(agentPath("/register", useRootPaths));

  const profile = dashboard.profile;
  const pendingPayouts = dashboard.payouts.filter((item) => !["paid", "rejected", "cancelled"].includes(String(item.status).toLowerCase()));

  return (
    <AgentPortalShell
      useRootPaths={useRootPaths}
      title="Payment Method"
      description="Control where your approved agent payouts go. This setup is separate from sales tracking so you can keep withdrawals organized."
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
      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <AgentPaymentMethodForm
          initialValues={{
            firstName: profile.firstName || "",
            lastName: profile.lastName || "",
            phone: profile.phone || "",
          }}
        />

        <div className="space-y-6">
          <section className="rounded-[28px] border border-[#e4d4cb] bg-white p-6 shadow-[0_12px_40px_rgba(64,32,18,0.08)]">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#7a0000]">Current setup</p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-[#210505]">Withdrawal profile</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="rounded-[24px] border border-[#e4d4cb] bg-[#fffaf5] p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Preferred payout rail</div>
                <div className="mt-2 text-xl font-semibold text-[#210505]">M-Pesa</div>
                <div className="mt-1 text-sm text-slate-600">Fast local settlement for Kenyan agents.</div>
              </div>
              <div className="rounded-[24px] border border-[#e4d4cb] bg-[#fffaf5] p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Saved payout phone</div>
                <div className="mt-2 text-xl font-semibold text-[#210505]">{profile.phone || "Not set"}</div>
                <div className="mt-1 text-sm text-slate-600">Used when a payout request is approved.</div>
              </div>
            </div>
          </section>

          <section className="rounded-[28px] border border-[#e4d4cb] bg-white p-6 shadow-[0_12px_40px_rgba(64,32,18,0.08)]">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#7a0000]">Payout visibility</p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-[#210505]">Commission summary</h2>
            <div className="mt-5 space-y-3 text-sm text-slate-700">
              <div className="flex items-center justify-between gap-4">
                <span>Earned commission</span>
                <span className="font-semibold text-[#210505]">{money(dashboard.salesSummary.earnedCommission)}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>Paid commission</span>
                <span className="font-semibold text-[#210505]">{money(dashboard.salesSummary.paidCommission)}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>Open payout requests</span>
                <span className="font-semibold text-[#210505]">{pendingPayouts.length}</span>
              </div>
            </div>
          </section>

          <section className="rounded-[28px] border border-[#f1b81d]/30 bg-[#fff3cf] p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#7a0000]">Before requesting payout</p>
            <ul className="mt-4 space-y-3 text-sm text-[#5a4300]">
              <li>Make sure your M-Pesa number is active and registered in your names.</li>
              <li>Only earned or paid commission can move into payout processing.</li>
              <li>If you change your line, update it here before creating the next payout request.</li>
            </ul>
          </section>
        </div>
      </div>
    </AgentPortalShell>
  );
}
