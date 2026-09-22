import { Check, Clock, Download, FileText, MessageCircle, Phone, Star } from "lucide-react";
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
        <section aria-labelledby="purchase-heading" className="mt-6">
          <h2 id="purchase-heading" className="text-xl font-bold">Purchase summary</h2>
          <ul className="mt-3 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-slate-50">
            {receipt.items.map(item => <li key={item.id} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 p-4"><div className="min-w-0 flex-1 basis-40"><p className="break-words font-medium">{item.name}</p><p className="mt-1 text-sm text-slate-600">Qty {item.quantity} × {receiptMoney(item.unitPrice)}</p></div><p className="font-semibold">{receiptMoney(item.lineTotal)}</p></li>)}
          </ul>
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
