import { notFound } from "next/navigation";
import { CheckCircle2, Clock3, FileText, MessageCircle, Paperclip } from "lucide-react";
import ComplaintReplyForm from "./ComplaintReplyForm";
import { getCustomerAccountContext } from "@/app/account/_lib/accountData";
import { shopStyles } from "@/app/shop/_components/shopStyles";
import { getCustomerComplaint } from "@/lib/complaints";
import { complaintCategoryLabels } from "@/lib/complaintsShared";

export const dynamic = "force-dynamic";
const format = (value: string) => value.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());

export default async function ComplaintDetailPage({ params, searchParams }: { params: Promise<{ reference: string }>; searchParams: Promise<{ created?: string }> }) {
  const { userId } = await getCustomerAccountContext(); const { reference } = await params; const complaint = await getCustomerComplaint(reference, userId); if (!complaint) notFound(); const query = await searchParams;
  return <div className="space-y-4">{query.created === "1" ? <div className="flex gap-3 rounded-[20px] border border-emerald-200 bg-emerald-50 p-4 text-emerald-900"><CheckCircle2 className="h-5 w-5 shrink-0" /><div><div className="font-black">Complaint submitted successfully</div><p className="text-sm">Keep reference {complaint.reference}. Support can now review your case and evidence.</p></div></div> : null}
    <section className={`${shopStyles.lightCard} p-5 sm:p-7`}><div className="flex flex-wrap items-start justify-between gap-4"><div><div className={shopStyles.sectionEyebrow}>{complaint.reference}</div><h1 className="mt-3 text-2xl font-black sm:text-3xl">{complaint.title}</h1><p className="mt-2 text-sm text-slate-600">{complaintCategoryLabels[complaint.category as keyof typeof complaintCategoryLabels] || format(complaint.category)}</p></div><div className="rounded-2xl bg-[#fff3d8] px-4 py-3 text-center"><div className="text-[10px] font-black uppercase tracking-widest text-[#7a0000]">Status</div><div className="mt-1 font-black">{format(complaint.status)}</div></div></div>
      <div className="mt-6 grid gap-3 sm:grid-cols-3"><Info label="Priority" value={format(complaint.priority)} /><Info label="Assigned to" value={complaint.assignedTo?.name || "Support queue"} /><Info label="Related record" value={complaint.relatedReference || "No linked transaction"} /></div>
      <div className="mt-5 rounded-2xl bg-[#fcfaf7] p-5"><div className="text-xs font-black uppercase tracking-widest text-[#7a0000]">Your report</div><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{complaint.description}</p></div>
      {complaint.attachments.length ? <div className="mt-5"><h2 className="flex items-center gap-2 font-black"><Paperclip className="h-4 w-4" />Evidence</h2><div className="mt-3 flex flex-wrap gap-2">{complaint.attachments.map((file) => <a key={file.id} href={file.fileUrl} target="_blank" rel="noreferrer" className={shopStyles.secondaryButton}><FileText className="h-4 w-4" />{file.fileName}</a>)}</div></div> : null}
    </section>
    <div className="grid gap-4 xl:grid-cols-2"><section className={`${shopStyles.lightCard} p-5 sm:p-7`}><h2 className="flex items-center gap-2 text-xl font-black"><MessageCircle className="h-5 w-5 text-[#7a0000]" />Messages</h2><div className="mt-4 space-y-3">{complaint.messages.length ? complaint.messages.map((message) => <div key={message.id} className={`rounded-2xl p-4 text-sm ${message.authorUserId === userId ? "ml-6 bg-[#fff3d8]" : "mr-6 bg-slate-100"}`}><div className="font-black">{message.author.name || (message.authorUserId === userId ? "You" : "Betech support")}</div><p className="mt-1 whitespace-pre-wrap text-slate-700">{message.message}</p><div className="mt-2 text-xs text-slate-500">{new Date(message.createdAt).toLocaleString("en-KE")}</div></div>) : <p className="text-sm text-slate-500">No messages yet. Add information below if needed.</p>}</div><ComplaintReplyForm reference={complaint.reference} /></section>
      <section className={`${shopStyles.lightCard} p-5 sm:p-7`}><h2 className="flex items-center gap-2 text-xl font-black"><Clock3 className="h-5 w-5 text-[#7a0000]" />Case timeline</h2><div className="mt-5 space-y-4">{complaint.activities.map((activity) => <div key={activity.id} className="relative border-l-2 border-[#f2b20f]/40 pl-5"><span className="absolute -left-[6px] top-1 h-2.5 w-2.5 rounded-full bg-[#7a0000]" /><div className="font-bold">{activity.summary}</div><div className="mt-1 text-xs text-slate-500">{new Date(activity.createdAt).toLocaleString("en-KE")}</div></div>)}</div></section></div>
  </div>;
}

function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl border border-[#7a0000]/10 bg-white p-4"><div className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</div><div className="mt-1 break-words font-black">{value}</div></div>; }
