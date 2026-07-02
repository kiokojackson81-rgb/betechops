"use client";

import Link from "next/link";
import { useSoftphone } from "@/components/voice/SoftphoneProvider";
import { buildAdminCustomerProfileHref } from "@/lib/adminCustomerProfileLinks";

export default function IncomingCallModal() {
  const softphone = useSoftphone();
  const call = softphone.incomingCall;

  if (!call) return null;

  const customerHref = buildAdminCustomerProfileHref({
    phone: call.remoteIdentity,
    phones: [call.remoteIdentity],
    displayName: call.customer?.name || call.displayName,
  });

  return (
    <div className="pointer-events-none fixed bottom-3 right-3 z-[45] w-[calc(100vw-24px)] sm:bottom-5 sm:right-5 sm:w-auto">
      <div className="pointer-events-auto w-full max-w-xl rounded-[30px] border border-cyan-500/20 bg-[linear-gradient(180deg,rgba(8,15,28,0.98),rgba(3,6,18,1))] p-6 shadow-[0_24px_90px_rgba(2,8,20,0.7)]">
        <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-300">Incoming Call</div>
        <h2 className="mt-3 text-3xl font-semibold text-white">{call.customer?.name || call.displayName}</h2>
        <div className="mt-2 whitespace-nowrap text-lg text-slate-300">{call.remoteIdentity}</div>

        <div className="mt-5 grid gap-3 rounded-[24px] border border-white/10 bg-white/[0.03] p-4 sm:grid-cols-2">
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Customer</div>
            <div className="mt-2 text-sm text-slate-100">{call.customer ? "Returning customer" : "Unknown caller"}</div>
            <div className="mt-1 text-sm text-slate-400">Spent: KES {(call.customer?.totalSpent || 0).toLocaleString("en-KE")}</div>
            <div className="mt-1 text-sm text-slate-400">Location: {call.customer?.location || "Unknown"}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-slate-500">CRM context</div>
            <div className="mt-2 text-sm text-slate-200">Orders {call.customer?.recentOrders || 0}</div>
            <div className="mt-1 text-sm text-slate-400">Quotes {call.customer?.recentQuotes || 0} · Receipts {call.customer?.recentReceipts || 0}</div>
            <div className="mt-2 text-xs text-slate-500">{call.customer?.notes?.[0] || "No note loaded yet"}</div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={softphone.answerCall}
            className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-5 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-100 transition hover:border-emerald-400"
          >
            Answer
          </button>
          <button
            type="button"
            onClick={softphone.rejectCall}
            className="rounded-full border border-rose-500/30 bg-rose-500/10 px-5 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-rose-100 transition hover:border-rose-400"
          >
            Decline
          </button>
          <Link
            href={customerHref}
            className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-5 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-100 transition hover:border-cyan-400"
          >
            Open CRM
          </Link>
        </div>
      </div>
    </div>
  );
}
