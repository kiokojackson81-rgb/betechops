import Link from "next/link";
import { MessageSquareWarning, Paperclip } from "lucide-react";
import { getCustomerAccountContext } from "@/app/account/_lib/accountData";
import { shopStyles } from "@/app/shop/_components/shopStyles";
import { complaintCategoryLabels } from "@/lib/complaintsShared";
import { listCustomerComplaints } from "@/lib/complaints";

export const dynamic = "force-dynamic";
const format = (value: string) => value.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());

export default async function CustomerComplaintsPage() {
  const { userId } = await getCustomerAccountContext();
  const complaints = await listCustomerComplaints(userId);
  return <section className={`${shopStyles.lightCard} w-full min-w-0 p-5 sm:p-7`}>
    <div className="flex flex-wrap items-start justify-between gap-4"><div><div className={shopStyles.sectionEyebrow}>My Support Reports</div><h1 className="mt-3 text-2xl font-black sm:text-3xl">Track your reports and updates</h1><p className="mt-2 text-sm text-slate-600">Review progress, support replies, files, and updates from Betech.</p></div><Link href="/support/report-issue" className={shopStyles.primaryButton}>Report an Issue</Link></div>
    <div className="mt-6 grid gap-4 xl:grid-cols-2">{complaints.length ? complaints.map((caseItem) => <Link key={caseItem.id} href={`/account/complaints/${caseItem.reference}`} className="group rounded-[22px] border border-[#7a0000]/10 bg-[#fcfaf7] p-5 transition hover:-translate-y-0.5 hover:border-[#7a0000]/25 hover:bg-white">
      <div className="flex items-start justify-between gap-3"><div><div className="text-xs font-black uppercase tracking-[.16em] text-[#7a0000]">{caseItem.reference}</div><h2 className="mt-2 text-lg font-black group-hover:text-[#7a0000]">{caseItem.title}</h2></div><span className="rounded-full bg-[#fff3d8] px-3 py-1 text-[11px] font-black uppercase tracking-wider text-[#7a0000]">{format(caseItem.status)}</span></div>
      <div className="mt-3 text-sm text-slate-600">{complaintCategoryLabels[caseItem.category as keyof typeof complaintCategoryLabels] || format(caseItem.category)} · Opened {new Date(caseItem.createdAt).toLocaleDateString("en-KE")}</div>
      <div className="mt-4 flex flex-wrap gap-4 text-xs font-bold text-slate-500"><span>{caseItem.assignedTo?.name ? `Assigned to ${caseItem.assignedTo.name}` : "In support queue"}</span><span className="flex items-center gap-1"><Paperclip className="h-3.5 w-3.5" />{caseItem._count.attachments} attachments</span><span>{caseItem._count.messages} messages</span></div>
    </Link>) : <div className="rounded-[22px] border border-dashed border-[#7a0000]/15 p-10 text-center xl:col-span-2"><MessageSquareWarning className="mx-auto h-9 w-9 text-[#7a0000]" /><div className="mt-3 font-black">No support reports yet</div><p className="mt-2 text-sm text-slate-500">Use Report an Issue when you need help with a purchase, project, or other concern.</p></div>}</div>
  </section>;
}
