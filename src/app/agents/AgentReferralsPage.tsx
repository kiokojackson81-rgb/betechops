import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
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

type AgentReferralsPageProps = {
  useRootPaths?: boolean;
};

function maskPhoneNumber(value?: string | null) {
  const raw = String(value || "").trim();
  if (!raw) return "Not captured";
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 7) return raw;
  const lastTwo = digits.slice(-2);
  if (raw.startsWith("+")) {
    return `+${digits.slice(0, 4)}•••••${lastTwo}`;
  }
  return `${digits.slice(0, 4)}••••${lastTwo}`;
}

function statusBadge(status: string) {
  const normalized = String(status || "").toLowerCase();
  if (["delivered", "payment_confirmed"].includes(normalized)) return "bg-[#edf9f0] text-[#136233]";
  if (normalized === "cancelled") return "bg-[#fdecec] text-[#8d1f1f]";
  if (["processing", "confirmed", "receipt_issued", "dispatched"].includes(normalized)) return "bg-[#eef6ff] text-[#174c7a]";
  return "bg-[#fffaf5] text-slate-700";
}

export default async function AgentReferralsPage({ useRootPaths = false }: AgentReferralsPageProps) {
  const agentSession = await requireAgentSession();
  if (!agentSession) redirect(agentPath("/login", useRootPaths));

  const dashboard = await getAgentDashboardData(agentSession.userId);
  if (!dashboard) redirect(agentPath("/register", useRootPaths));

  return (
    <AgentPortalShell
      useRootPaths={useRootPaths}
      title="Referral Customers"
      description="View customers who purchased through your referral attribution, the products they bought, and the value of each purchase."
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
      <div className="space-y-5 sm:space-y-6">
        <section className="grid gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-[26px] border border-[#e4d4cb] bg-white p-5 shadow-[0_12px_40px_rgba(64,32,18,0.06)]">
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[#7a0000]">Referral orders</div>
            <div className="mt-3 text-3xl font-black tracking-tight text-[#210505]">
              {dashboard.websiteReferralSummary.totalOrders}
            </div>
          </div>
          <div className="rounded-[26px] border border-[#e4d4cb] bg-white p-5 shadow-[0_12px_40px_rgba(64,32,18,0.06)]">
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[#7a0000]">Open orders</div>
            <div className="mt-3 text-3xl font-black tracking-tight text-[#210505]">
              {dashboard.websiteReferralSummary.openOrders}
            </div>
          </div>
          <div className="rounded-[26px] border border-[#e4d4cb] bg-white p-5 shadow-[0_12px_40px_rgba(64,32,18,0.06)]">
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[#7a0000]">Completed orders</div>
            <div className="mt-3 text-3xl font-black tracking-tight text-[#210505]">
              {dashboard.websiteReferralSummary.completedOrders}
            </div>
          </div>
          <div className="rounded-[26px] border border-[#e4d4cb] bg-white p-5 shadow-[0_12px_40px_rgba(64,32,18,0.06)]">
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[#7a0000]">Referral revenue</div>
            <div className="mt-3 text-3xl font-black tracking-tight text-[#210505]">
              {money(dashboard.websiteReferralSummary.totalRevenue)}
            </div>
          </div>
        </section>

        <section className="rounded-[28px] border border-[#e4d4cb] bg-white p-4 shadow-[0_12px_40px_rgba(64,32,18,0.08)] sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#7a0000]">Website referral history</p>
              <h2 className="mt-2 text-xl font-black tracking-tight text-[#210505] sm:text-2xl">Customers and items purchased</h2>
              <p className="mt-2 text-sm text-slate-600">
                Every referred order shows the customer details, purchased items, payment arrangement, and current order status.
              </p>
            </div>
            <Link
              href={agentPath("/dashboard", useRootPaths)}
              className="inline-flex items-center gap-2 rounded-2xl border border-[#d6c0b5] bg-white px-4 py-2 text-sm font-semibold text-[#7a0000] transition hover:-translate-y-0.5"
            >
              Back to dashboard <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-6 space-y-4">
            {dashboard.referredWebsiteOrders.length ? (
              dashboard.referredWebsiteOrders.map((order) => (
                <article key={order.id} className="rounded-[26px] border border-[#ece1d9] bg-[#fffaf5] p-4 sm:p-5">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="text-lg font-semibold text-[#210505] sm:text-xl">
                          {order.customerName || "Referred customer"}
                        </h3>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${statusBadge(order.status)}`}>
                          {String(order.status).replace(/_/g, " ")}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {order.items.map((item) => (
                          <span
                            key={`${order.id}-${item.id}-tag`}
                            className="rounded-full border border-[#ead8cb] bg-white px-3 py-1 text-xs font-medium text-slate-700"
                          >
                            {item.productName}
                          </span>
                        ))}
                      </div>
                      <div className="grid gap-2 text-sm text-slate-600 sm:grid-cols-2 xl:grid-cols-4">
                        <div>Order: {order.orderRef}</div>
                        <div>Phone: {maskPhoneNumber(order.customerPhone)}</div>
                        <div>Location: {order.customerLocation || "Pending"}</div>
                        <div>Payment: {order.paymentMethod}</div>
                        <div>Date: {new Intl.DateTimeFormat("en-KE", { dateStyle: "medium" }).format(order.createdAt)}</div>
                        <div>Total: {money(order.totalAmount)}</div>
                        <div>Items: {order.items.reduce((sum, item) => sum + item.quantity, 0)}</div>
                        <div>Referred product: {order.items[0]?.productName || "Not captured"}</div>
                      </div>
                    </div>
                    <div className="w-full rounded-[24px] border border-[#f1b81d]/25 bg-[#fff3cf] p-4 xl:min-w-[260px] xl:max-w-[320px]">
                      <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[#7a0000]">Customer purchase value</div>
                      <div className="mt-3 text-2xl font-black tracking-tight text-[#210505] sm:text-3xl">{money(order.totalAmount)}</div>
                      <div className="mt-2 text-sm text-[#6e5500]">
                        {order.items.length} item{order.items.length === 1 ? "" : "s"} on this referred order.
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 overflow-hidden rounded-[24px] border border-[#ece1d9] bg-white">
                    <div className="grid grid-cols-[minmax(0,1.6fr)_90px_140px_140px] gap-3 border-b border-[#ece1d9] bg-[#fff8e7] px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#7a0000]">
                      <div>Item</div>
                      <div className="text-center">Qty</div>
                      <div className="text-right">Amount</div>
                      <div className="text-right">Line total</div>
                    </div>
                    {order.items.map((item) => (
                      <div
                        key={item.id}
                        className="grid grid-cols-[minmax(0,1.6fr)_90px_140px_140px] gap-3 border-b border-[#f3e7de] px-4 py-3 text-sm last:border-b-0"
                      >
                        <div className="font-medium text-[#210505]">{item.productName}</div>
                        <div className="text-center text-slate-600">{item.quantity}</div>
                        <div className="text-right text-slate-600">
                          {item.quantity > 0 ? money(item.totalAmount / item.quantity) : money(item.totalAmount)}
                        </div>
                        <div className="text-right font-semibold text-[#210505]">{money(item.totalAmount)}</div>
                      </div>
                    ))}
                  </div>
                </article>
              ))
            ) : (
              <div className="rounded-[24px] border border-dashed border-[#d9c6ba] bg-[#fffaf5] p-10 text-center text-slate-500">
                No referred customer purchases have been attributed to your account yet.
              </div>
            )}
          </div>
        </section>
      </div>
    </AgentPortalShell>
  );
}
