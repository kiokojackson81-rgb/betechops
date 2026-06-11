import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { ArrowRight, CircleDollarSign, ClipboardList, CreditCard, PlusCircle, UserRound, Wallet } from "lucide-react";
import AgentPortalShell from "@/app/agents/_components/AgentPortalShell";
import {
  getAgentPotentialCommissionValue,
  getPopularitySignalsByProduct,
  sortAgentProductsBySignals,
} from "@/app/agents/agentCatalogue";
import { getAgentProductHref, getAgentProductsHref } from "@/app/agents/storefrontPaths";
import { getShopProducts } from "@/app/shop/shopApi";
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
  { key: "totalSubmittedSales", label: "Customer Orders", tone: "bg-[#fff3cf] text-[#5a4300]" },
  { key: "pendingSales", label: "Orders Pending", tone: "bg-[#fffaf5] text-slate-700" },
  { key: "processingSales", label: "Orders In Progress", tone: "bg-[#f1f8ff] text-[#174c7a]" },
  { key: "completedSales", label: "Completed Orders", tone: "bg-[#edf9f0] text-[#136233]" },
  { key: "totalCommissionEarnedSoFar", label: "Total Earned So Far", tone: "bg-[#fff3cf] text-[#5a4300]", money: true },
  { key: "earnedCommission", label: "Ready To Withdraw", tone: "bg-[#fceeee] text-[#7a0000]", money: true },
  { key: "paidCommission", label: "Withdrawn Earnings", tone: "bg-[#edf9f0] text-[#136233]", money: true },
] as const;

function getSaleCommissionHeadline(sale: { status: string; commissionStatus: string }) {
  const saleStatus = String(sale.status || "").toLowerCase();
  const commissionStatus = String(sale.commissionStatus || "").toLowerCase();
  if (commissionStatus === "paid") return "Paid";
  if (saleStatus === "rejected" || saleStatus === "cancelled") return "Rejected";
  if (saleStatus === "completed") return "Earned";
  return "Potential";
}

function formatActivity(action: string, description: string | null) {
  const normalized = String(action || "").toLowerCase();
  if (normalized === "status_approved") return "✅ Your agent account was approved";
  if (normalized === "registered") return "🟢 Agent account created successfully";
  if (normalized === "sale_submitted") return "📦 Customer order submitted";
  if (normalized === "commission_unlocked") return "💰 Commission unlocked";
  if (normalized === "sale_completed") return "✅ Customer order completed";
  return description || action || "Activity updated";
}

type AgentDashboardPageProps = {
  useRootPaths?: boolean;
};

export default async function AgentDashboardPage({ useRootPaths = false }: AgentDashboardPageProps) {
  const agentSession = await requireAgentSession();
  if (!agentSession) redirect(agentPath("/login", useRootPaths));

  const dashboard = await getAgentDashboardData(agentSession.userId);
  if (!dashboard) redirect(agentPath("/register", useRootPaths));
  const shopProducts = await getShopProducts();
  const popularitySignals = await getPopularitySignalsByProduct(shopProducts);
  const opportunityProducts = sortAgentProductsBySignals(shopProducts, popularitySignals, "featured").slice(0, 8);
  const status = String(dashboard.profile.status || "").toLowerCase();
  const totalCommissionEarnedSoFar =
    Number(dashboard.salesSummary.earnedCommission || 0) + Number(dashboard.salesSummary.paidCommission || 0);
  const dashboardSummary = {
    ...dashboard.salesSummary,
    totalCommissionEarnedSoFar,
  };

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
      title="Your Sales Dashboard"
      description="Track your customer orders, sales progress, and commissions all in one place."
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
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes agentOpportunityFlow {
              0% { transform: translateY(0); }
              100% { transform: translateY(-50%); }
            }
          `,
        }}
      />
      <div className="space-y-6">
        <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-[30px] bg-[linear-gradient(135deg,#7a0000_0%,#3c0909_100%)] p-7 text-white shadow-[0_20px_60px_rgba(64,10,10,0.28)]">
            <div className="inline-flex rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-[#f5d88f]">
              Welcome back 👋
            </div>
            <h2 className="mt-4 text-3xl font-black tracking-tight">Grow Your Solar Business With Betech</h2>
            <p className="mt-3 max-w-2xl text-sm text-white/78">
              Refer customers, submit orders, and earn up to 6% commission on successful solar sales across Kenya.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href={agentPath("/sales/new", useRootPaths)}
                className="rounded-2xl bg-[#f1b81d] px-5 py-3 text-sm font-semibold text-[#4d0808] transition hover:brightness-95"
              >
                🟢 Submit Customer Order
              </Link>
              <Link
                href={agentPath("/sales", useRootPaths)}
                className="rounded-2xl border border-white/15 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                📦 My Sales
              </Link>
              <Link
                href={agentPath("/profile/payment-method", useRootPaths)}
                className="rounded-2xl border border-white/15 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                💰 Withdraw Setup
              </Link>
              <Link
                href={agentPath("/withdrawals", useRootPaths)}
                className="rounded-2xl border border-[#f1b81d]/50 bg-[#f1b81d]/12 px-5 py-3 text-sm font-semibold text-[#fff3cf] transition hover:bg-[#f1b81d]/18"
              >
                💸 Request Withdrawal
              </Link>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-1">
            <div className="rounded-[28px] border border-[#e4d4cb] bg-white p-5 shadow-[0_12px_40px_rgba(64,32,18,0.08)]">
              <div className="flex items-center gap-3 text-[#7a0000]">
                <Wallet className="h-5 w-5" />
                <div className="text-sm font-semibold uppercase tracking-[0.18em]">Opportunity</div>
              </div>
              <div className="mt-2 text-xs leading-5 text-slate-500">
                Live catalogue products ranked by popularity and latest completed purchase activity.
              </div>
              <div className="mt-4 overflow-hidden rounded-[24px] border border-[#f1dfb0] bg-[linear-gradient(180deg,#fffaf0_0%,#fffdf9_100%)]">
                <div
                  className="divide-y divide-[#f1e5da]"
                  style={{
                    animation: "agentOpportunityFlow 18s linear infinite",
                  }}
                >
                  {[...opportunityProducts, ...opportunityProducts].map((product, index) => {
                    const commission = getAgentPotentialCommissionValue(product);
                    return (
                      <Link
                        key={`${product.id}-${index}`}
                        href={getAgentProductHref(product.slug, useRootPaths)}
                        className="flex items-center gap-3 px-3 py-3 transition hover:bg-white/70"
                      >
                        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-[#ead9cd] bg-white p-2">
                          <Image src={product.image} alt={product.name} width={64} height={64} className="h-full w-full object-contain" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-bold text-[#210505]">{product.name}</div>
                          <div className="mt-1 text-xs text-slate-500">Potential commission</div>
                          <div className="text-lg font-black tracking-tight text-[#7a0000]">{money(commission)}</div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
              <Link
                href={getAgentProductsHref(useRootPaths)}
                className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-[#7a0000] hover:text-[#5d0000]"
              >
                Open live catalogue <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="rounded-[28px] border border-[#e4d4cb] bg-white p-5 shadow-[0_12px_40px_rgba(64,32,18,0.08)]">
              <div className="flex items-center gap-3 text-[#7a0000]">
                <CircleDollarSign className="h-5 w-5" />
                <div className="text-sm font-semibold uppercase tracking-[0.18em]">Ready To Withdraw</div>
              </div>
              <div className="mt-3 text-3xl font-black tracking-tight text-[#210505]">{money(dashboard.salesSummary.earnedCommission)}</div>
              <p className="mt-2 text-sm text-slate-600">Completed and fully paid customer orders appear here.</p>
            </div>
            <div className="rounded-[28px] border border-[#e4d4cb] bg-white p-5 shadow-[0_12px_40px_rgba(64,32,18,0.08)]">
              <div className="flex items-center gap-3 text-[#7a0000]">
                <CreditCard className="h-5 w-5" />
                <div className="text-sm font-semibold uppercase tracking-[0.18em]">Withdrawal Method</div>
              </div>
              <div className="mt-3 text-xl font-black tracking-tight text-[#210505]">{dashboard.profile.phone || "Add M-Pesa number"}</div>
              <p className="mt-2 text-sm text-slate-600">Your commissions will be sent to this M-Pesa number.</p>
            </div>
          </div>
        </section>

        <section className="rounded-[30px] bg-[linear-gradient(135deg,#8b0b0b_0%,#530707_55%,#2f0808_100%)] p-6 text-white shadow-[0_18px_55px_rgba(122,0,0,0.22)]">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-sm font-black uppercase tracking-[0.18em] text-[#ffd76a]">🔥 Earn Up To 6% Commission On Every Successful Sale</div>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-white/90">
                <span>✅ Solar Kits</span>
                <span>✅ Batteries</span>
                <span>✅ Inverters</span>
                <span>✅ Water Pumps</span>
                <span>✅ Installations</span>
              </div>
            </div>
            <Link
              href={agentPath("/sales/new", useRootPaths)}
              className="inline-flex items-center justify-center rounded-2xl bg-[#f1b81d] px-5 py-3 text-sm font-bold text-[#4d0808] shadow-[0_0_28px_rgba(241,184,29,0.25)] transition hover:-translate-y-0.5 hover:brightness-95"
            >
              Submit Customer Order
            </Link>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {statCards.map((item) => {
            const value = dashboardSummary[item.key];
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
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#7a0000]">🚀 Quick Actions</p>
                  <h3 className="mt-2 text-2xl font-black tracking-tight text-[#210505]">Start Earning With Betech</h3>
                </div>
              </div>
              <div className="mt-5 grid gap-4 md:grid-cols-3">
                <Link href={agentPath("/sales/new", useRootPaths)} className="rounded-[24px] border border-[#e4d4cb] bg-[#fffaf5] p-4 transition hover:-translate-y-0.5 hover:shadow-[0_12px_25px_rgba(64,32,18,0.08)]">
                  <PlusCircle className="h-5 w-5 text-[#7a0000]" />
                  <div className="mt-4 text-lg font-semibold text-[#210505]">Submit Customer Order</div>
                  <p className="mt-2 text-sm text-slate-600">Submit customer orders and start tracking your earnings instantly.</p>
                </Link>
                <Link href={agentPath("/profile", useRootPaths)} className="rounded-[24px] border border-[#e4d4cb] bg-[#fffaf5] p-4 transition hover:-translate-y-0.5 hover:shadow-[0_12px_25px_rgba(64,32,18,0.08)]">
                  <UserRound className="h-5 w-5 text-[#7a0000]" />
                  <div className="mt-4 text-lg font-semibold text-[#210505]">Update profile</div>
                  <p className="mt-2 text-sm text-slate-600">Keep your details updated for smooth payouts and account support.</p>
                </Link>
                <Link href={agentPath("/profile/payment-method", useRootPaths)} className="rounded-[24px] border border-[#e4d4cb] bg-[#fffaf5] p-4 transition hover:-translate-y-0.5 hover:shadow-[0_12px_25px_rgba(64,32,18,0.08)]">
                  <CreditCard className="h-5 w-5 text-[#7a0000]" />
                  <div className="mt-4 text-lg font-semibold text-[#210505]">Setup Withdrawals</div>
                  <p className="mt-2 text-sm text-slate-600">Confirm the M-Pesa number where you want to receive commissions.</p>
                </Link>
              </div>
            </article>

            <article className="rounded-[28px] border border-[#e4d4cb] bg-white p-6 shadow-[0_12px_40px_rgba(64,32,18,0.08)]">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#7a0000]">📦 Recent Customer Orders</p>
                  <h3 className="mt-2 text-2xl font-black tracking-tight text-[#210505]">Your Sales Activity</h3>
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
                          {getSaleCommissionHeadline(sale)}
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
                  <div className="space-y-4">
                    <div className="rounded-[24px] border border-dashed border-[#d9c6ba] bg-[#fffaf5] p-8 text-center text-sm text-slate-500">
                      You haven’t submitted any customer orders yet.
                      <div className="mt-2 font-medium text-[#7a0000]">Start earning by submitting your first sale today 🚀</div>
                    </div>
                    {dashboard.salesSummary.totalSubmittedSales === 0 &&
                    dashboard.salesSummary.potentialCommission === 0 &&
                    dashboard.salesSummary.earnedCommission === 0 ? (
                      <div className="rounded-[24px] border border-[#f1b81d]/40 bg-[#fff3cf] p-6 text-center">
                        <div className="text-lg font-black text-[#210505]">🚀 Start Your First Sale</div>
                        <p className="mt-2 text-sm text-[#5a4300]">
                          Submit your first customer order and begin earning commissions with Betech Solar.
                        </p>
                        <Link
                          href={agentPath("/sales/new", useRootPaths)}
                          className="mt-4 inline-flex rounded-2xl bg-[#7a0000] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#5d0000]"
                        >
                          Submit Customer Order
                        </Link>
                      </div>
                    ) : null}
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
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#7a0000]">💰 How You Earn</p>
                  <h3 className="mt-1 text-2xl font-black tracking-tight text-[#210505]">Refer → Earn → Withdraw</h3>
                </div>
              </div>
              <div className="mt-5 space-y-4">
                <div className="rounded-[24px] bg-[#fff3cf] p-4">
                  <div className="text-sm font-semibold text-[#210505]">Potential Earnings</div>
                  <p className="mt-1 text-sm text-[#6a5000]">Appears after you submit a customer order.</p>
                </div>
                <div className="rounded-[24px] bg-[#fceeee] p-4">
                  <div className="text-sm font-semibold text-[#210505]">Commission Ready</div>
                  <p className="mt-1 text-sm text-[#7a0000]">Unlocked after customer payment and successful delivery.</p>
                </div>
                <div className="rounded-[24px] bg-[#edf9f0] p-4">
                  <div className="text-sm font-semibold text-[#210505]">Withdrawn Earnings</div>
                  <p className="mt-1 text-sm text-[#136233]">Completed payouts appear here.</p>
                </div>
              </div>
            </article>

            <article className="rounded-[28px] border border-[#e4d4cb] bg-white p-6 shadow-[0_12px_40px_rgba(64,32,18,0.08)]">
              <div className="flex items-center gap-3">
                <CreditCard className="h-5 w-5 text-[#7a0000]" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#7a0000]">💸 Withdrawal Activity</p>
                  <h3 className="mt-1 text-2xl font-black tracking-tight text-[#210505]">Recent Withdrawals</h3>
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
                    No withdrawals yet.
                    <div className="mt-2">Your earnings will appear here once customer orders are completed and paid.</div>
                  </div>
                )}
              </div>
              <div className="mt-5 rounded-[24px] border border-[#f1b81d]/30 bg-[#fff3cf] p-4">
                <div className="text-sm font-semibold text-[#210505]">Withdrawal procedure</div>
                <p className="mt-2 text-sm text-[#5a4300]">
                  Complete customer orders, wait for commission to unlock, then request withdrawal to your saved M-Pesa number.
                </p>
                <Link
                  href={agentPath("/withdrawals", useRootPaths)}
                  className="mt-4 inline-flex rounded-2xl bg-[#7a0000] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#5d0000]"
                >
                  Open withdrawals
                </Link>
              </div>
            </article>

            <article className="rounded-[28px] border border-[#e4d4cb] bg-white p-6 shadow-[0_12px_40px_rgba(64,32,18,0.08)]">
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[#7a0000]">📈 Account Activity</div>
              <div className="mt-4 space-y-3">
                {dashboard.activities.length ? dashboard.activities.map((item) => (
                  <div key={item.id} className="rounded-[24px] border border-[#ece1d9] bg-[#fffaf5] p-4">
                    <div className="font-semibold text-[#210505]">{formatActivity(item.action, item.description)}</div>
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
