import { redirect } from "next/navigation";
import AgentPortalShell from "@/app/agents/_components/AgentPortalShell";
import AgentProfileSettingsForm from "@/app/agents/_components/AgentProfileSettingsForm";
import { requireAgentSession } from "@/lib/agents/auth";
import { agentPath } from "@/lib/agents/host";
import { getAgentDashboardData } from "@/lib/agents/service";

type AgentProfilePageProps = {
  useRootPaths?: boolean;
};

export default async function AgentProfilePage({ useRootPaths = false }: AgentProfilePageProps) {
  const agentSession = await requireAgentSession();
  if (!agentSession) redirect(agentPath("/login"));

  const dashboard = await getAgentDashboardData(agentSession.userId);
  if (!dashboard) redirect(agentPath("/register"));

  const profile = dashboard.profile;
  const location = [profile.city, profile.county, profile.country].filter(Boolean).join(", ") || "Not set";
  const latestPayout = dashboard.payouts[0] ?? null;

  return (
    <AgentPortalShell
      useRootPaths={useRootPaths}
      title="Profile"
      description="Manage your personal details, compliance information, and the contact details BETECH uses for your agent account."
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
        <AgentProfileSettingsForm
          initialValues={{
            firstName: profile.firstName || "",
            lastName: profile.lastName || "",
            email: profile.email || profile.user.email || "",
            phone: profile.phone || "",
            nationalId: profile.nationalId || "",
            kraPin: profile.kraPin || "",
            county: profile.county || "",
            city: profile.city || "",
            country: profile.country || "Kenya",
            address: profile.address || "",
          }}
        />

        <div className="space-y-6">
          <section className="rounded-[28px] border border-[#e4d4cb] bg-white p-6 shadow-[0_12px_40px_rgba(64,32,18,0.08)]">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#7a0000]">Account summary</p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-[#210505]">Agent identity</h2>
            <div className="mt-5 space-y-3 text-sm text-slate-700">
              <div className="flex items-center justify-between gap-4">
                <span>Referral code</span>
                <span className="font-semibold text-[#210505]">{profile.referralCode}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>Status</span>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                  {profile.status}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>Location</span>
                <span className="text-right font-medium text-[#210505]">{location}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>Saved phone</span>
                <span className="font-medium text-[#210505]">{profile.phone || "Not set"}</span>
              </div>
            </div>
          </section>

          <section className="rounded-[28px] border border-[#e4d4cb] bg-white p-6 shadow-[0_12px_40px_rgba(64,32,18,0.08)]">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#7a0000]">Payout readiness</p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-[#210505]">How you receive money</h2>
            <p className="mt-3 text-sm text-slate-600">
              BETECH currently pays agents through M-Pesa. Keep your phone number updated before requesting a withdrawal.
            </p>
            <div className="mt-5 space-y-3 rounded-[24px] border border-[#f1b81d]/25 bg-[#fff6df] p-4 text-sm text-[#5a4300]">
              <div className="flex items-center justify-between gap-4">
                <span>Payout method</span>
                <span className="font-semibold text-[#210505]">M-Pesa</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>Payout phone</span>
                <span className="font-semibold text-[#210505]">{profile.phone || "Add phone number"}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>Latest payout request</span>
                <span className="font-semibold text-[#210505]">
                  {latestPayout ? `${latestPayout.status} · KES ${Number(latestPayout.amount || 0).toLocaleString()}` : "No requests yet"}
                </span>
              </div>
            </div>
          </section>

          <section className="rounded-[28px] border border-[#e4d4cb] bg-white p-6 shadow-[0_12px_40px_rgba(64,32,18,0.08)]">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#7a0000]">Agent guidance</p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-[#210505]">Keep this updated</h2>
            <ul className="mt-4 space-y-3 text-sm text-slate-600">
              <li>Your phone number should match the M-Pesa line you want payouts sent to.</li>
              <li>Use your correct legal names to avoid payout verification delays.</li>
              <li>Update county and town so admin teams can match you to nearby leads and operations support.</li>
            </ul>
          </section>
        </div>
      </div>
    </AgentPortalShell>
  );
}
