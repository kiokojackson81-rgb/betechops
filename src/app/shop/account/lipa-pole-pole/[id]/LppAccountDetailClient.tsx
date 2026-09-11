"use client";

import Link from "next/link";
import { useState } from "react";
import { getNextLppInstallment } from "@/lib/lipaPolePoleSchedule";
import MpesaStkPaymentPanel from "@/app/shop/_components/MpesaStkPaymentPanel";

type LppDetail = {
  account: {
    id: string;
    reference: string;
    customerName: string | null;
    customerPhone: string | null;
    customerEmail: string | null;
    productName: string | null;
    agreedTotal: number;
    totalPaid: number;
    balance: number;
    percentagePaid: number;
    status: string;
    expectedCompletionDate: string | null;
    assignedToName: string | null;
    convertedReceiptId: string | null;
    convertedProjectId: string | null;
  };
  items: Array<{
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
    serial: string | null;
    warranty: string | null;
  }>;
  payments: Array<{
    id: string;
    amount: number;
    method: string;
    reference: string | null;
    status: string;
    receivedAt: string;
    notes: string | null;
    reversedAt: string | null;
    rejectedAt?: string | null;
    rejectionReason?: string | null;
  }>;
  installments: Array<{
    id: string;
    dueDate: string;
    expectedAmount: number;
  }>;
  summary: {
    agreedTotal: number;
    totalPaid: number;
    balance: number;
    percentagePaid: number;
    isFullyPaid: boolean;
  };
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  })
    .format(Number(value || 0))
    .replace("KES", "KSh");
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export default function LppAccountDetailClient({ initialDetail }: { initialDetail: LppDetail }) {
  const [detail, setDetail] = useState(initialDetail);
  const nextInstallment = getNextLppInstallment(detail.installments, detail.summary.totalPaid);

  async function refresh() {
    const response = await fetch(`/api/shop/lipa-pole-pole/${encodeURIComponent(detail.account.id)}`, {
      cache: "no-store",
    });
    const data = (await response.json().catch(() => null)) as (LppDetail & { error?: string }) | null;
    if (!response.ok || !data) {
      throw new Error(data?.error || "Failed to refresh account.");
    }
    setDetail(data);
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-[#7a0000]/10 bg-white p-6 shadow-[0_22px_60px_rgba(15,23,42,0.08)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.18em] text-[#7a0000]">Lipa Pole Pole account</div>
            <h1 className="mt-2 text-3xl font-black text-slate-950">{detail.account.reference}</h1>
            <p className="mt-2 text-sm text-slate-600">
              {detail.account.productName || "Reserved product"} • Assigned support: {detail.account.assignedToName || "Betech team"}
            </p>
          </div>
          <div className="rounded-full bg-[#fff3d8] px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-[#7a0000]">
            {detail.account.status.replace(/_/g, " ")}
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-4">
          <div className="rounded-[18px] border border-[#7a0000]/10 bg-[#fcfaf7] p-4">
            <div className="text-[11px] font-black uppercase tracking-[0.12em] text-[#7a0000]">Total</div>
            <div className="mt-1 text-lg font-black text-slate-950">{formatCurrency(detail.summary.agreedTotal)}</div>
          </div>
          <div className="rounded-[18px] border border-[#7a0000]/10 bg-[#fcfaf7] p-4">
            <div className="text-[11px] font-black uppercase tracking-[0.12em] text-[#7a0000]">Paid</div>
            <div className="mt-1 text-lg font-black text-slate-950">{formatCurrency(detail.summary.totalPaid)}</div>
          </div>
          <div className="rounded-[18px] border border-[#7a0000]/10 bg-[#fcfaf7] p-4">
            <div className="text-[11px] font-black uppercase tracking-[0.12em] text-[#7a0000]">Balance</div>
            <div className="mt-1 text-lg font-black text-slate-950">{formatCurrency(detail.summary.balance)}</div>
          </div>
          <div className="rounded-[18px] border border-[#7a0000]/10 bg-[#fcfaf7] p-4">
            <div className="text-[11px] font-black uppercase tracking-[0.12em] text-[#7a0000]">Due date</div>
            <div className="mt-1 text-lg font-black text-slate-950">{formatDate(detail.account.expectedCompletionDate)}</div>
          </div>
        </div>

        <div className="mt-5 h-3 overflow-hidden rounded-full bg-[#ecdcc5]">
          <div
            className="h-full rounded-full bg-[linear-gradient(90deg,#7a0000_0%,#d97706_100%)]"
            style={{ width: `${Math.max(2, Math.min(100, detail.summary.percentagePaid || 0))}%` }}
          />
        </div>

        <div className="mt-5 rounded-[20px] border border-[#7a0000]/10 bg-[#fcfaf7] p-4">
          <div className="text-xs font-black uppercase tracking-[0.14em] text-[#7a0000]">Products</div>
          <div className="mt-3 space-y-3">
            {detail.items.map((item) => (
              <div key={item.id} className="flex flex-wrap items-start justify-between gap-3 border-b border-[#7a0000]/10 pb-3 last:border-0 last:pb-0">
                <div><div className="font-bold text-slate-950">{item.description}</div><div className="text-sm text-slate-600">Qty {item.quantity}{item.serial ? ` · Serial ${item.serial}` : ""}{item.warranty ? ` · ${item.warranty} warranty` : ""}</div></div>
                <div className="font-black text-slate-950">{formatCurrency(item.total)}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-2 text-sm font-semibold text-slate-600">
          {detail.summary.percentagePaid.toFixed(2)}% paid
        </div>

        {nextInstallment && detail.summary.balance > 0 ? (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-amber-200 bg-amber-50 px-5 py-4">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.14em] text-[#7a0000]">Next installment</div>
              <div className="mt-1 text-sm font-semibold text-slate-600">Due {formatDate(nextInstallment.dueDate)}</div>
            </div>
            <div className="text-xl font-black text-slate-950">{formatCurrency(nextInstallment.amount)}</div>
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-2">
          {detail.summary.balance > 0 ? (
            <a href="#make-payment" className="rounded-[16px] bg-[#7a0000] px-4 py-3 text-sm font-bold text-white">
              Make a payment
            </a>
          ) : null}
          <Link
            href={`/shop/account/lipa-pole-pole/${encodeURIComponent(detail.account.id)}/statement`}
            className="rounded-[16px] border border-[#7a0000]/14 bg-white px-4 py-3 text-sm font-bold text-[#7a0000]"
          >
            Print statement
          </Link>
          <Link
            href={`/shop/account/lipa-pole-pole/${encodeURIComponent(detail.account.id)}/booking-receipt?autoPrint=1`}
            target="_blank"
            className="rounded-[16px] border border-[#7a0000]/14 bg-white px-4 py-3 text-sm font-bold text-[#7a0000]"
          >
            Download booking receipt
          </Link>
          {detail.account.convertedReceiptId ? (
            <Link
              href={`/receipts/${encodeURIComponent(detail.account.convertedReceiptId)}`}
              className="rounded-[16px] border border-[#7a0000]/14 bg-white px-4 py-3 text-sm font-bold text-[#7a0000]"
            >
              View final receipt
            </Link>
          ) : null}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <section id="make-payment" className="rounded-[28px] border border-[#7a0000]/10 bg-white p-6 shadow-[0_22px_60px_rgba(15,23,42,0.08)]">
          <div className="text-xs font-black uppercase tracking-[0.18em] text-[#7a0000]">Continue paying</div>
          <h2 className="mt-2 text-2xl font-black text-slate-950">Pay with M-Pesa</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">Choose an installment amount and we will send a secure M-Pesa prompt. Your balance changes only after Safaricom confirms payment.</p>
          <div className="mt-5"><MpesaStkPaymentPanel resourceType="LPP" reference={detail.account.reference} amountDue={detail.summary.balance} initialPhone={detail.account.customerPhone} allowAmountChoice onSuccess={() => void refresh()} /></div>
        </section>

        <section className="rounded-[28px] border border-[#7a0000]/10 bg-white p-6 shadow-[0_22px_60px_rgba(15,23,42,0.08)]">
          <div className="text-xs font-black uppercase tracking-[0.18em] text-[#7a0000]">Payment history</div>
          <h2 className="mt-2 text-2xl font-black text-slate-950">Acknowledgements and history</h2>
          <div className="mt-5 space-y-3">
            {detail.payments.length ? (
              detail.payments.map((payment) => (
                <div key={payment.id} className="rounded-[18px] border border-[#7a0000]/10 bg-[#fcfaf7] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-base font-black text-slate-950">{formatCurrency(payment.amount)}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {payment.method} • {formatDate(payment.receivedAt)} • {payment.reference || "No reference"}
                      </div>
                    </div>
                    <div className="rounded-full bg-white px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-[#7a0000]">
                      {payment.status === "SUCCESS" ? "Verified" : payment.status === "PENDING" ? "Pending verification" : payment.status === "FAILED" ? "Rejected" : payment.status}
                    </div>
                  </div>
                  {payment.notes ? <div className="mt-2 text-sm text-slate-600">{payment.notes}</div> : null}
                  {payment.rejectionReason ? <div className="mt-2 text-sm font-semibold text-red-700">Reason: {payment.rejectionReason}</div> : null}
                  {payment.reversedAt ? (
                    <div className="mt-2 text-sm font-semibold text-red-700">
                      Reversed on {formatDate(payment.reversedAt)}
                    </div>
                  ) : null}
                  <div className="mt-3">
                    <Link
                      href={`/shop/account/lipa-pole-pole/${encodeURIComponent(detail.account.id)}/payments/${encodeURIComponent(payment.id)}`}
                      className="rounded-[16px] border border-[#7a0000]/14 bg-white px-4 py-2 text-sm font-bold text-[#7a0000]"
                    >
                      Open acknowledgement
                    </Link>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm text-slate-500">No payments recorded yet.</div>
            )}
          </div>
        </section>
      </section>
    </div>
  );
}
