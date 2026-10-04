import { CalendarDays, Check, CircleDot, Clock, Download, FileText, MessageCircle, Phone, Star } from "lucide-react";
import { footerGroups } from "@/app/shop/shopData";
import { receiptMoney, type CustomerReceiptPresentation } from "@/lib/customerReceiptPresentation";
import type { ReceiptReferralOffer } from "@/lib/reviewsReferrals";
import ReceiptReferralCard from "./ReceiptReferralCard";
import styles from "./receipt.module.css";

const contacts = footerGroups.flatMap(group => group.links);
const whatsapp = contacts.find(link => link.href.startsWith("https://wa.me/"))!.href;
const phone = contacts.find(link => link.href.startsWith("tel:"))!.href;

export default function ReceiptLandingPage({ receipt, token, reviewUrl, offers }: { receipt: CustomerReceiptPresentation; token: string; reviewUrl: string | null; offers: ReceiptReferralOffer[] }) {
  const pdf = `/r/${encodeURIComponent(token)}`;
  const paid = receipt.status === "Paid in full";
  return <div className={styles.page}>
    <article className="mx-auto max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm max-[480px]:rounded-none max-[480px]:border-x-0">
      <header className="border-b border-slate-200 px-5 py-5 sm:px-8">
        <a href="https://www.betech.co.ke" aria-label="Betech Solar Solutions home" className="inline-block"><span className="block text-4xl font-black leading-none tracking-tight text-[#870000]">BETECH</span><span className="mt-1 block text-[10px] font-bold tracking-[.3em]">SOLAR SOLUTIONS</span><span className="mt-1 block text-[10px] italic tracking-wider text-slate-500">Powering a Brighter Kenya</span></a>
      </header>
      <div className="p-5 sm:p-8">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Your receipt</h1>
        <p className="mt-2 text-lg text-slate-600">Thank you for choosing Betech.</p>
        <section aria-label="Payment summary" className="mt-5 rounded-xl border border-emerald-200 bg-[#eafaf0] p-5 sm:p-6">
          <h2 className="flex items-center gap-3 text-xl font-bold text-emerald-900"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">{paid ? <Check aria-hidden="true" /> : <Clock aria-hidden="true" />}</span>{receipt.status}</h2>
          <dl className="mt-5 grid gap-x-5 gap-y-3 text-sm sm:grid-cols-[140px_1fr] sm:text-base">
            <dt className="text-slate-600">Customer</dt><dd className="-mt-2 break-words font-semibold sm:mt-0">{receipt.customerName}</dd>
            <dt className="text-slate-600">Receipt number</dt><dd className="-mt-2 break-all sm:mt-0">{receipt.receiptNumber}</dd>
            <dt className="text-slate-600">Payment date</dt><dd className="-mt-2 sm:mt-0">{receipt.paymentDate}</dd>
          </dl>
          <dl className="mt-5 grid gap-4 border-t border-emerald-200 pt-5 sm:grid-cols-[1.3fr_1fr]">
            <div><dt className="text-sm text-slate-600">Amount paid</dt><dd className="mt-1 break-words text-3xl font-extrabold tracking-tight text-emerald-900 sm:text-4xl">{receiptMoney(receipt.paid)}</dd></div>
            <div className="sm:border-l sm:border-emerald-200 sm:pl-5"><dt className="text-sm text-slate-600">Outstanding balance</dt><dd className="mt-1 break-words text-2xl font-bold text-emerald-900">{receiptMoney(receipt.balance)}</dd></div>
          </dl>
        </section>
        {receipt.delivery ? <section aria-label="Delivery status" className={`mt-4 rounded-xl border p-4 text-sm ${receipt.delivery.status === "failed" || receipt.delivery.status === "delivery_failed" ? "border-rose-200 bg-rose-50 text-rose-900" : "border-sky-200 bg-sky-50 text-sky-950"}`}>
          <p className="font-bold">Delivery: {receipt.delivery.status === "delivered" ? "Delivered" : receipt.delivery.status === "failed" || receipt.delivery.status === "delivery_failed" ? "Delivery failed" : "Pending"}</p>
          <p className="mt-1">{receipt.delivery.paymentLabel}. {receipt.delivery.status === "delivered" ? "Staff will confirm the payment record once payment has been verified." : "Your order is not treated as a completed sale until delivery and payment are confirmed."}</p>
        </section> : null}
        {receipt.project ? <ProjectStatusCard project={receipt.project} /> : null}
        <section aria-labelledby="purchase-heading" className="mt-6">
          <h2 id="purchase-heading" className="text-xl font-bold">Purchase summary</h2>
          <ul className="mt-3 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-slate-50">
            {receipt.items.map(item => <li key={item.id} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 p-4"><div className="min-w-0 flex-1 basis-40"><p className="break-words font-medium">{item.name}</p><p className="mt-1 text-sm text-slate-600">Qty {item.quantity} × {receiptMoney(item.unitPrice)}</p></div><p className="font-semibold">{receiptMoney(item.lineTotal)}</p></li>)}
          </ul>
          <dl className="mt-3 rounded-xl border border-slate-200 bg-white p-4 text-sm sm:ml-auto sm:max-w-md">
            <div className="flex items-center justify-between gap-4"><dt className="text-slate-600">Item subtotal</dt><dd className="font-medium">{receiptMoney(receipt.subtotal)}</dd></div>
            {receipt.showDiscount ? <div className="mt-2 flex items-center justify-between gap-4 text-emerald-700"><dt>Discount</dt><dd className="font-medium">−{receiptMoney(receipt.discount)}</dd></div> : null}
            <div className="mt-3 flex items-center justify-between gap-4 border-t border-slate-200 pt-3 text-base font-bold text-slate-950"><dt>Final amount payable</dt><dd>{receiptMoney(receipt.total)}</dd></div>
          </dl>
          <div className="mt-4 grid gap-3 sm:grid-cols-2"><a href={pdf} target="_blank" rel="noreferrer" className="receipt-primary"><FileText size={21} aria-hidden="true" />View Receipt</a><a href={`${pdf}?download=1`} className="receipt-secondary"><Download size={21} aria-hidden="true" />Download PDF</a></div>
        </section>
        <section aria-labelledby="help-heading" className="mt-6 border-t border-slate-200 pt-5">
          <h2 id="help-heading" className="text-xl font-bold">Need help with your purchase?</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2"><a href={whatsapp} target="_blank" rel="noreferrer" className="receipt-secondary"><MessageCircle size={22} aria-hidden="true" />WhatsApp Support</a><a href={phone} className="receipt-secondary"><Phone size={21} aria-hidden="true" />Call Us</a></div>
          <a href="https://www.betech.co.ke/support/report-issue" rel="noreferrer" className="mx-auto mt-2 flex min-h-11 w-fit items-center text-sm font-medium text-[#870000] underline">Report an Issue</a>
        </section>
        <section aria-labelledby="review-heading" className="mt-3 flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 pt-5">
          <div><h2 id="review-heading" className="text-xl font-bold">How was your experience?</h2><p className="mt-1 text-slate-600">Share feedback about your purchase.</p></div>
          {reviewUrl ? <a href={reviewUrl} rel="noreferrer" className="receipt-secondary max-sm:w-full"><Star size={22} aria-hidden="true" />Write a Review</a> : <p className="text-sm text-slate-600">Reviews are temporarily unavailable. Please try again later.</p>}
        </section>
        <ReceiptReferralCard token={token} offers={offers} />
        <footer className="mt-5 border-t border-slate-200 pt-3 text-sm text-slate-600">
          <div className="flex flex-wrap items-center justify-between gap-x-4"><nav aria-label="Receipt legal links" className="flex gap-5"><a href="https://www.betech.co.ke/p/terms" rel="noreferrer" className="inline-flex min-h-11 items-center text-[#870000]">Terms &amp; Conditions</a><a href="https://www.betech.co.ke/privacy" rel="noreferrer" className="inline-flex min-h-11 items-center text-[#870000]">Privacy</a></nav><p>Keep your receipt link private.</p></div>
          <p className="mt-3">© {new Date().getFullYear()} Betech Solar Solutions. All rights reserved.</p><p className="mt-1">Powering a Brighter Kenya.</p>
        </footer>
      </div>
    </article>
  </div>;
}

const projectStages = [
  ["RECEIPT_CREATED", "Confirmed"],
  ["PROJECT_SCHEDULED", "Scheduled"],
  ["PROJECT_IN_PROGRESS", "In progress"],
  ["PROJECT_INSTALLED", "Installed"],
  ["COMPLETED_POSTED", "Completed"],
] as const;

function ProjectStatusCard({ project }: { project: NonNullable<CustomerReceiptPresentation["project"]> }) {
  const isCancelled = project.stage === "CANCELLED";
  const currentIndex = projectStages.findIndex(([stage]) => stage === project.stage);
  return <section aria-label="Project progress" className={`mt-6 rounded-xl border p-5 sm:p-6 ${isCancelled ? "border-rose-200 bg-rose-50" : "border-sky-200 bg-sky-50"}`}>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className={`text-xs font-bold uppercase tracking-[0.16em] ${isCancelled ? "text-rose-700" : "text-sky-700"}`}>Installation project</p>
        <h2 className="mt-1 flex items-center gap-2 text-xl font-bold text-slate-900"><CircleDot className={isCancelled ? "text-rose-600" : "text-sky-600"} size={22} aria-hidden="true" />Project status: {project.stageLabel}</h2>
      </div>
      {project.scheduledDate ? <div className="flex items-center gap-2 rounded-lg bg-white/80 px-3 py-2 text-sm font-semibold text-slate-700"><CalendarDays size={18} className="text-sky-700" aria-hidden="true" />Installation date: {project.scheduledDate}</div> : null}
    </div>
    {!isCancelled ? <ol className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-5">{projectStages.map(([stage, label], index) => {
      const complete = currentIndex >= index;
      return <li key={stage} className={`min-h-16 rounded-lg border p-3 text-xs font-bold ${complete ? "border-sky-300 bg-white text-sky-900" : "border-slate-200 bg-white/50 text-slate-500"}`}><span className="mb-2 flex h-5 w-5 items-center justify-center rounded-full bg-current/10">{complete ? <Check size={13} aria-hidden="true" /> : index + 1}</span>{label}</li>;
    })}</ol> : <p className="mt-3 text-sm text-rose-800">This project has been cancelled. Please contact Betech if you need assistance.</p>}
  </section>;
}
