import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import AgentSaleDetailAdminClient from "@/app/admin/agents/AgentSaleDetailAdminClient";
import { auth } from "@/lib/auth";
import { buildAgentSaleReceiptPrefillUrl, getAdminAgentSaleById } from "@/lib/agents/sales";

export const dynamic = "force-dynamic";

export default async function AdminAgentSaleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role ?? "";
  if (!session) redirect("/admin/login");
  if (role !== "ADMIN") redirect("/not-authorized");

  const { id } = await params;
  const result = await getAdminAgentSaleById(id);
  if (!result) notFound();

  const preparedSale = {
    ...result.sale,
    createdAt: result.sale.createdAt.toISOString(),
    updatedAt: result.sale.updatedAt.toISOString(),
    completedAt: result.sale.completedAt ? result.sale.completedAt.toISOString() : null,
  };
  const preparedActivity = result.activity.map((item) => ({
    ...item,
    createdAt: item.createdAt.toISOString(),
  }));
  const preparedTimeline = result.timeline.map((item) => ({
    ...item,
    createdAt: item.createdAt.toISOString(),
  }));
  const preparedAudit = result.audit.map((item) => ({
    ...item,
    createdAt: item.createdAt.toISOString(),
  }));
  const preparedFraudSignals = result.fraudSignals.map((item) => ({
    ...item,
    createdAt: item.createdAt.toISOString(),
    resolvedAt: item.resolvedAt ? item.resolvedAt.toISOString() : null,
  }));
  const preparedDuplicateReviews = result.duplicateReviews.map((item) => ({
    ...item,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    resolvedAt: item.resolvedAt ? item.resolvedAt.toISOString() : null,
  }));
  const preparedActiveOwnership = result.activeOwnership
    ? {
        ...result.activeOwnership,
        ownedUntil: result.activeOwnership.ownedUntil.toISOString(),
        releasedAt: result.activeOwnership.releasedAt ? result.activeOwnership.releasedAt.toISOString() : null,
        createdAt: result.activeOwnership.createdAt.toISOString(),
        updatedAt: result.activeOwnership.updatedAt.toISOString(),
        firstSale: {
          ...result.activeOwnership.firstSale,
          createdAt: result.activeOwnership.firstSale.createdAt.toISOString(),
        },
      }
    : null;
  const receiptPrefillUrl = buildAgentSaleReceiptPrefillUrl({
    id: result.sale.id,
    agentId: result.sale.agentId,
    agentName: result.sale.agentName,
    customerName: result.sale.customerName,
    customerPhone: result.sale.customerPhone,
    customerLocation: result.sale.customerLocation,
    productName: result.sale.productName,
    quantity: result.sale.quantity,
    unitPrice: result.sale.unitPrice,
    totalAmount: result.sale.totalAmount,
    amountPaid: result.sale.amountPaid,
    paymentType: result.sale.paymentType,
    deliveryNotes: result.sale.deliveryNotes,
  });

  return (
    <div className="space-y-8">
      <section className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,.95),rgba(2,6,23,.98))] p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-300">Agent sale review</div>
            <h1 className="text-4xl font-semibold tracking-tight text-white">
              {result.sale.customerName} · {result.sale.productName}
            </h1>
            <p className="max-w-4xl text-sm text-slate-400">
              Validate payment progress, link the sale to a receipt, and only unlock commission once the customer has paid fully and delivery or collection is confirmed.
            </p>
          </div>
          <Link
            href="/admin/agents/pending-sales"
            className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:border-white/20"
          >
            Back to pending sales
          </Link>
        </div>
      </section>

      <AgentSaleDetailAdminClient
        sale={preparedSale}
        activity={preparedActivity}
        timeline={preparedTimeline}
        audit={preparedAudit}
        fraudSignals={preparedFraudSignals}
        duplicateReviews={preparedDuplicateReviews}
        activeOwnership={preparedActiveOwnership}
        receiptPrefillUrl={receiptPrefillUrl}
      />
    </div>
  );
}
