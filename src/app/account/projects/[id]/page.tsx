import Link from "next/link";
import { CalendarDays, CheckCircle2, CircleDot, MapPin, Wrench } from "lucide-react";
import { getCustomerAccountContext } from "@/app/account/_lib/accountData";
import { formatCurrency, shopStyles } from "@/app/shop/_components/shopStyles";
import { getCustomerAccountOrderDetail } from "@/lib/shopCustomerOrders";
import { prisma } from "@/lib/prisma";
import { readReceiptProjectFlow } from "@/lib/receiptProjects";
import { notFound } from "next/navigation";

const stages = [
  ["RECEIPT_CREATED", "Request Received"],
  ["PAYMENT", "Payment Verification"],
  ["REVIEW", "Technical Review"],
  ["PROJECT_SCHEDULED", "Installation Scheduled"],
  ["ASSIGNED", "Technician Assigned"],
  ["PROJECT_IN_PROGRESS", "Installation"],
  ["COMPLETED_POSTED", "Completed"],
] as const;

function formatDate(value: string | null | undefined) {
  if (!value) return "Awaiting confirmation";
  return new Intl.DateTimeFormat("en-KE", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
}

function currentStageIndex(stage: string, paymentStatus: string) {
  if (stage === "COMPLETED_POSTED") return 6;
  if (stage === "PROJECT_INSTALLED") return 5;
  if (stage === "PROJECT_IN_PROGRESS") return 5;
  if (stage === "PROJECT_SCHEDULED") return 3;
  if (paymentStatus === "FULLY_PAID" || paymentStatus === "PARTIALLY_PAID") return 1;
  return 0;
}

export default async function CustomerProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { identity } = await getCustomerAccountContext();
  const order = await getCustomerAccountOrderDetail({ routeId: `receipt-${id}`, ...identity });
  if (!order) notFound();

  const receipt = await prisma.receipt.findUnique({ where: { id }, select: { data: true } });
  const data = receipt?.data && typeof receipt.data === "object" && !Array.isArray(receipt.data) ? receipt.data as Record<string, unknown> : {};
  const flow = readReceiptProjectFlow(data.projectFlow);
  if (!flow?.isProject) notFound();
  const preferredDate = typeof data.preferredInstallationDate === "string" ? data.preferredInstallationDate : null;
  const progress = currentStageIndex(flow.stage, flow.paymentStatus);

  return <div className="grid min-w-0 gap-4">
    <section className={`${shopStyles.darkPanel} p-5 sm:p-7`}>
      <div className="text-[11px] font-black uppercase tracking-[.18em] text-[#ffd761]">Installation project</div>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-2xl font-black sm:text-3xl">{order.orderRef}</h1><p className="mt-2 text-sm text-white/70">Track payment, technical review, scheduling and installation from one place.</p></div><span className="rounded-full bg-white/10 px-3 py-1 text-xs font-black text-white">{stages[Math.min(progress, stages.length - 1)][1]}</span></div>
      <div className="mt-6 grid gap-2 sm:grid-cols-3 lg:grid-cols-7">{stages.map(([, label], index) => <div key={label} className={`rounded-xl border p-3 text-xs font-bold ${index <= progress ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-100" : "border-white/10 bg-white/5 text-white/50"}`}><div className="mb-2">{index <= progress ? <CheckCircle2 className="h-4 w-4" /> : <CircleDot className="h-4 w-4" />}</div>{label}</div>)}</div>
    </section>
    <section className="grid gap-4 lg:grid-cols-2">
      <div className={`${shopStyles.lightCard} p-5`}><h2 className="font-black text-[#7a0000]">Project Details</h2><dl className="mt-4 grid gap-3 text-sm">{[["Project value", formatCurrency(flow.projectValue)], ["Payment terms", flow.paymentTerm.replaceAll("_", " ")], ["Amount paid", formatCurrency(flow.totalPaidAmount)], ["Outstanding balance", formatCurrency(flow.remainingAmount)], ["Payment status", flow.paymentStatus.replaceAll("_", " ")], ["Request submitted", formatDate(order.createdAt)]].map(([key, value]) => <div key={key} className="flex justify-between gap-4"><dt className="text-slate-500">{key}</dt><dd className="text-right font-bold">{value}</dd></div>)}</dl></div>
      <div className={`${shopStyles.lightCard} p-5`}><h2 className="flex items-center gap-2 font-black text-[#7a0000]"><CalendarDays className="h-4 w-4" /> Installation Details</h2><dl className="mt-4 grid gap-3 text-sm"><div><dt className="text-slate-500">Installation location</dt><dd className="mt-1 font-bold">{order.customerLocation}</dd></div><div><dt className="text-slate-500">Preferred installation date</dt><dd className="mt-1 font-bold">{formatDate(preferredDate)}</dd></div><div><dt className="text-slate-500">Confirmed installation date</dt><dd className="mt-1 font-bold">{formatDate(flow.scheduledDate)}</dd></div>{flow.assignedHandlers.length ? <div><dt className="flex items-center gap-2 text-slate-500"><Wrench className="h-4 w-4" /> Assigned technician/team</dt><dd className="mt-1 font-bold">{flow.assignedHandlers.map((handler) => handler.staffName || handler.externalAgentName).filter(Boolean).join(", ")}</dd></div> : null}</dl></div>
    </section>
    <Link href="/account/orders" className={`${shopStyles.secondaryButton} w-fit`}><MapPin className="h-4 w-4" /> Back to account orders</Link>
  </div>;
}
