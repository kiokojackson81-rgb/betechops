"use client";

import { useEffect, useState } from "react";

type Withdrawal = { id: string; amountKes: number; status: string; contributorName?: string | null; contributorEmail?: string | null; requestedAt: string; paymentReference?: string | null; adminNote?: string | null };
const money = (amount: number) => new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(amount);

export default function ContributorWithdrawalsAdmin() {
  const [items, setItems] = useState<Withdrawal[]>([]); const [notice, setNotice] = useState<string | null>(null); const [busy, setBusy] = useState<string | null>(null);
  const load = async () => { const res = await fetch("/api/admin/product-contributors/withdrawals", { cache: "no-store" }); const data = await res.json(); if (res.ok) setItems(data.withdrawals || []); else setNotice(data.error || "Unable to load withdrawals."); };
  useEffect(() => { void load(); }, []);
  async function update(item: Withdrawal, status: "PAID" | "REJECTED") {
    const paymentReference = status === "PAID" ? window.prompt("Payment reference (optional):", item.paymentReference || "") : "";
    if (paymentReference === null) return;
    const adminNote = window.prompt(status === "PAID" ? "Payment note (optional):" : "Reason for rejecting this withdrawal (optional):", item.adminNote || "");
    if (adminNote === null) return;
    setBusy(item.id); const res = await fetch(`/api/admin/product-contributors/withdrawals/${item.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status, paymentReference, adminNote }) }); const data = await res.json().catch(() => ({})); setBusy(null);
    if (!res.ok) { setNotice(data.error || "Could not update withdrawal."); return; } setNotice(`Withdrawal marked ${status.toLowerCase()}.`); await load();
  }
  return <section className="space-y-6"><div><p className="text-xs font-bold uppercase tracking-[.25em] text-emerald-300">Product contributor</p><h1 className="mt-2 text-3xl font-black">Withdrawal requests</h1><p className="mt-2 text-slate-400">Mark a request paid after sending payment. Paid requests are deducted from the contributor’s available earnings.</p></div>{notice ? <div className="rounded-xl border border-cyan-400/30 bg-cyan-400/10 p-3 text-cyan-100">{notice}</div> : null}<div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950"><table className="w-full text-left text-sm"><thead className="bg-white/5 text-slate-400"><tr><th className="p-4">Contributor</th><th className="p-4">Amount</th><th className="p-4">Requested</th><th className="p-4">Status</th><th className="p-4">Action</th></tr></thead><tbody>{items.map((item) => <tr key={item.id} className="border-t border-white/10"><td className="p-4 font-semibold">{item.contributorName || "Contributor"}<div className="font-normal text-slate-400">{item.contributorEmail}</div></td><td className="p-4 font-black text-emerald-300">{money(item.amountKes)}</td><td className="p-4 text-slate-300">{new Date(item.requestedAt).toLocaleString("en-KE")}</td><td className="p-4">{item.status}</td><td className="p-4">{item.status === "PENDING" ? <div className="flex gap-2"><button disabled={busy === item.id} onClick={() => void update(item, "PAID")} className="rounded-lg bg-emerald-400 px-3 py-2 font-bold text-slate-950">Mark paid</button><button disabled={busy === item.id} onClick={() => void update(item, "REJECTED")} className="rounded-lg border border-red-400/40 px-3 py-2 font-bold text-red-300">Reject</button></div> : <span className="text-slate-400">{item.paymentReference || item.adminNote || "Processed"}</span>}</td></tr>)}{!items.length ? <tr><td colSpan={5} className="p-8 text-center text-slate-400">No contributor withdrawal requests.</td></tr> : null}</tbody></table></div></section>;
}
