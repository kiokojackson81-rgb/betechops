import Link from "next/link";
import { Download, FileCheck2 } from "lucide-react";
import { syncCustomerAccountRecords } from "@/app/account/_lib/accountData";
import { listCustomerAccountOrders } from "@/lib/shopCustomerOrders";
import { prisma } from "@/lib/prisma";
import { shopStyles } from "@/app/shop/_components/shopStyles";

export default async function AccountCertificatesPage() {
  const context = await syncCustomerAccountRecords();
  const orders = await listCustomerAccountOrders({ ...context.identity, take: 100 });
  const receiptIds = orders.map((order) => order.receiptId).filter((id): id is string => Boolean(id));
  const certificates = receiptIds.length
    ? await prisma.commissioningSession.findMany({
        where: { receiptId: { in: receiptIds }, status: "ISSUED" },
        select: {
          receiptId: true,
          certificateNo: true,
          issuedAt: true,
          receipt: { select: { receiptNumber: true, order: { select: { orderNumber: true, customerName: true } } } },
        },
        orderBy: { issuedAt: "desc" },
      })
    : [];
  return <div className="grid gap-4"><section className={`${shopStyles.darkPanel} p-5 sm:p-7`}><div className="text-[11px] font-black uppercase tracking-[.18em] text-[#ffd761]">My installations</div><h1 className="mt-3 text-2xl font-black sm:text-3xl">Completion certificates</h1><p className="mt-2 text-sm text-white/70">Download your Solar PV Completion & Commissioning Certificates at any time.</p></section><section className={`${shopStyles.lightCard} p-5`}><div className="space-y-3">{certificates.length ? certificates.map((certificate) => <article key={certificate.receiptId} className="flex flex-col gap-4 rounded-2xl border border-[#7a0000]/10 bg-[#fcfaf7] p-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2 font-black"><FileCheck2 className="h-5 w-5 text-[#0f9d58]" />{certificate.certificateNo || "Completion certificate"}</div><p className="mt-1 text-sm text-slate-600">{certificate.receipt.receiptNumber || certificate.receipt.order?.orderNumber} · {certificate.receipt.order?.customerName || "Betech customer"}</p></div><div className="flex gap-2"><a href={`/api/account/projects/${encodeURIComponent(certificate.receiptId)}/certificate`} className={shopStyles.primaryButton}><Download className="h-4 w-4" /> PDF</a><Link href={`/account/projects/${encodeURIComponent(certificate.receiptId)}`} className={shopStyles.secondaryButton}>View project</Link></div></article>) : <p className="rounded-2xl bg-[#fcfaf7] p-5 text-sm text-slate-600">Your issued installation certificates will appear here.</p>}</div></section></div>;
}
