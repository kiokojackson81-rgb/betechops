"use client";

import React, { useEffect, useMemo, useState } from "react";
import Input from "@/app/_components/Input";
import Button from "@/app/_components/Button";
import { showToast } from "@/lib/ui/toast";

type ItemRow = {
  id: string;
  title: string;
  quantity: number;
  unitPrice: number | "";
  serial?: string;
  warranty?: string;
};

const warrantyOptions = ["1 Year", "2 Years", "3 Years", "5 Years", "6 Years", "10 Years"];

const newItem = (): ItemRow => ({
  id: Math.random().toString(36).slice(2),
  title: "",
  quantity: 1,
  unitPrice: "",
  serial: "",
  warranty: warrantyOptions[0],
});

export default function ReceiptFormClient({ onCreated }: { onCreated?: (receipt: any) => void }) {
  const [attendants, setAttendants] = useState<Array<{ id: string; name: string }>>([]);
  const [attendantId, setAttendantId] = useState<string | null>(null);
  const [docType, setDocType] = useState<string>("RECEIPT");
  const [serial, setSerial] = useState<string>("");
  const [customerName, setCustomerName] = useState<string>("");
  const [customerPhone, setCustomerPhone] = useState<string>("");
  const [customerEmail, setCustomerEmail] = useState<string>("");
  const [items, setItems] = useState<ItemRow[]>([newItem()]);
  const [taxRate, setTaxRate] = useState<number>(16);
  const [showTax, setShowTax] = useState<boolean>(true);
  const [discount, setDiscount] = useState<number>(0);
  const [showDiscount, setShowDiscount] = useState<boolean>(false);
  const [paymentDetailsShown, setPaymentDetailsShown] = useState<boolean>(false);
  const [notes, setNotes] = useState<string>("");
  const [warrantyText, setWarrantyText] = useState<string>("");
  const [deposit, setDeposit] = useState<number>(0);
  const [showSerials, setShowSerials] = useState<boolean>(true);
  const [showWarranty, setShowWarranty] = useState<boolean>(true);
  const [sendEmail, setSendEmail] = useState<boolean>(false);
  const [sendWhatsapp, setSendWhatsapp] = useState<boolean>(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/users?role=ATTENDANT");
        const json = await res.json();
        if (Array.isArray(json?.users)) setAttendants(json.users.map((u: any) => ({ id: u.id, name: u.name || u.email })));
      } catch (e) {
        // ignore
      }
    })();
  }, []);

  const addRow = () => setItems((s) => [...s, newItem()]);
  const removeRow = (id: string) => setItems((s) => (s.length > 1 ? s.filter((r) => r.id !== id) : s));
  const updateRow = (id: string, patch: Partial<ItemRow>) => setItems((s) => s.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const subtotal = useMemo(() => items.reduce((acc, it) => acc + (Number(it.unitPrice || 0) * Number(it.quantity || 1)), 0), [items]);
  const taxAmount = showTax ? subtotal * (taxRate / 100) : 0;
  const total = subtotal + taxAmount - discount;
  const balance = docType === "LAYAWAY" ? Math.max(0, total - deposit) : 0;

  const handleSave = async () => {
    if (!attendantId) return showToast("Select attendant", "error");
    if (!items.length) return showToast("Add at least one item", "error");

    setSaving(true);
    try {
      const payload = {
        docType: docType.toLowerCase(),
        serial,
        date: new Date().toISOString(),
        customerName,
        customerPhone,
        customerEmail,
        attendantId,
        issuedById: attendantId,
        taxRate,
        showTax,
        discount,
        showDiscount,
        paymentDetailsShown,
        notes,
        warrantyText,
        deposit: docType === "LAYAWAY" ? deposit : undefined,
        items: items.map((it) => ({
          title: it.title,
          quantity: it.quantity,
          unitPrice: Number(it.unitPrice || 0),
          serial: showSerials ? it.serial || null : null,
          warranty: showWarranty ? it.warranty || null : null,
        })),
        sendChannels: {
          email: sendEmail,
          whatsapp: sendWhatsapp,
        },
      };

      const res = await fetch("/api/receipts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), credentials: "same-origin" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return showToast(data?.error || "Failed to save receipt", "error");
      }
      showToast("Saved receipt", "success");
      onCreated?.(data);
      setTimeout(() => window.print(), 300);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to save", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl p-6 space-y-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold">Create Receipt / Invoice / Quotation / Layaway</h1>
          <p className="text-sm text-slate-300">Saves to the unified receipts table and is ready for printing or sending.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-200">Betech Receipts Module</span>
        </div>
      </header>

      <div className="space-y-6 rounded-2xl border border-slate-800 bg-slate-950/70 card-top-accent p-6 shadow-xl shadow-black/20">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="text-xs uppercase tracking-wide text-slate-400">Attendant</label>
            <select value={attendantId ?? ""} onChange={(e) => setAttendantId(e.target.value || null)} className="w-full rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 placeholder-slate-500">
              <option value="">Select attendant</option>
              {attendants.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs uppercase tracking-wide text-slate-400">Document Type</label>
            <select value={docType} onChange={(e) => setDocType(e.target.value)} className="w-full rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 placeholder-slate-500">
              <option>RECEIPT</option>
              <option>INVOICE</option>
              <option>QUOTATION</option>
              <option>LAYAWAY</option>
            </select>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="text-xs uppercase tracking-wide text-slate-400">Serial / Receipt No.</label>
            <Input className="rounded-xl border border-slate-800 bg-slate-950/80 text-slate-100 placeholder-slate-500" value={serial} onChange={(e) => setSerial(e.target.value)} placeholder="Serial" />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wide text-slate-400">Customer Name</label>
            <Input className="rounded-xl border border-slate-800 bg-slate-950/80 text-slate-100 placeholder-slate-500" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Customer name" />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wide text-slate-400">Customer Phone</label>
            <Input className="rounded-xl border border-slate-800 bg-slate-950/80 text-slate-100 placeholder-slate-500" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="07..." />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-xs uppercase tracking-wide text-slate-400">Customer Email (for sending)</label>
            <Input className="rounded-xl border border-slate-800 bg-slate-950/80 text-slate-100 placeholder-slate-500" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} placeholder="email@example.com" />
          </div>
          <div className="flex items-end gap-4">
            <label className="inline-flex items-center gap-2 text-xs text-slate-300">
              <input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} />
              Send via e-mail
            </label>
            <label className="inline-flex items-center gap-2 text-xs text-slate-300">
              <input type="checkbox" checked={sendWhatsapp} onChange={(e) => setSendWhatsapp(e.target.checked)} />
              Send via WhatsApp
            </label>
          </div>
        </div>
      </div>

      <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-950/70 p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          <label className="inline-flex items-center gap-2 text-xs text-slate-300">
            <input type="checkbox" checked={showSerials} onChange={(e) => setShowSerials(e.target.checked)} />
            Capture serial / IMEI per item
          </label>
          <label className="inline-flex items-center gap-2 text-xs text-slate-300">
            <input type="checkbox" checked={showWarranty} onChange={(e) => setShowWarranty(e.target.checked)} />
            Capture warranty per item
          </label>
        </div>

        <div className="space-y-2">
          {items.map((it) => (
            <div key={it.id} className="grid gap-2 md:grid-cols-6 items-center border-b border-slate-800 pb-2">
              <input className="col-span-2 rounded-xl border border-slate-800 bg-slate-950/80 text-slate-100 placeholder-slate-500 px-3 py-2" value={it.title} onChange={(e) => updateRow(it.id, { title: e.target.value })} placeholder="Item description" />
              <input type="number" min={1} className="rounded-xl border border-slate-800 bg-slate-950/80 text-slate-100 px-3 py-2" value={it.quantity} onChange={(e) => updateRow(it.id, { quantity: Math.max(1, Number(e.target.value || 1)) })} />
              <input type="number" min={0} className="rounded-xl border border-slate-800 bg-slate-950/80 text-slate-100 px-3 py-2" value={it.unitPrice as any} onChange={(e) => updateRow(it.id, { unitPrice: e.target.value === "" ? "" : Number(e.target.value) })} placeholder="Unit price" />
              {showSerials ? (
                <input className="rounded-xl border border-slate-800 bg-slate-950/80 text-slate-100 placeholder-slate-500 px-3 py-2" value={it.serial} onChange={(e) => updateRow(it.id, { serial: e.target.value })} placeholder="Serial / IMEI" />
              ) : (
                <div />
              )}
              {showWarranty ? (
                <select className="rounded-xl border border-slate-800 bg-slate-950/80 text-slate-100 px-3 py-2" value={it.warranty} onChange={(e) => updateRow(it.id, { warranty: e.target.value })}>
                  {warrantyOptions.map((w) => <option key={w} value={w}>{w}</option>)}
                </select>
              ) : (
                <div />
              )}
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => removeRow(it.id)}>Remove</Button>
              </div>
            </div>
          ))}
        </div>
        <div className="pt-2">
          <Button variant="primary" onClick={addRow} className="rounded-xl border border-white/10 bg-transparent px-4 py-2 text-xs font-medium text-slate-200 hover:bg-white/5">+ Add item</Button>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label className="text-xs uppercase tracking-wide text-slate-400">Tax % (optional)</label>
          <Input className="rounded-xl border border-slate-800 bg-slate-950/80 text-slate-100 placeholder-slate-500" type="number" value={taxRate} onChange={(e) => setTaxRate(Number(e.target.value || 0))} />
          <label className="inline-flex items-center mt-1 text-xs text-slate-300"><input type="checkbox" checked={showTax} onChange={(e) => setShowTax(e.target.checked)} className="mr-2" /> Show tax on document</label>
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide text-slate-400">Discount (KES)</label>
          <Input className="rounded-xl border border-slate-800 bg-slate-950/80 text-slate-100 placeholder-slate-500" type="number" value={discount} onChange={(e) => setDiscount(Number(e.target.value || 0))} />
          <label className="inline-flex items-center mt-1 text-xs text-slate-300"><input type="checkbox" checked={showDiscount} onChange={(e) => setShowDiscount(e.target.checked)} className="mr-2" /> Show Discount</label>
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide text-slate-400">Payment details</label>
          <div className="mt-1">
            <label className="inline-flex items-center text-xs text-slate-300"><input type="checkbox" checked={paymentDetailsShown} onChange={(e) => setPaymentDetailsShown(e.target.checked)} className="mr-2" /> Include payment details on receipt</label>
          </div>
          {docType === "LAYAWAY" && (
            <div className="mt-3 space-y-1">
              <label className="text-xs uppercase tracking-wide text-slate-400">Deposit (KES)</label>
              <Input className="rounded-xl border border-slate-800 bg-slate-950/80 text-slate-100 placeholder-slate-500" type="number" value={deposit} onChange={(e) => setDeposit(Number(e.target.value || 0))} />
              <p className="text-xs text-slate-500">Balance auto-computed from total.</p>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="text-xs uppercase tracking-wide text-slate-400">Warranty note</label>
          <Input className="rounded-xl border border-slate-800 bg-slate-950/80 text-slate-100 placeholder-slate-500" value={warrantyText} onChange={(e) => setWarrantyText(e.target.value)} placeholder="Global warranty text (optional)" />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide text-slate-400">General notes / terms</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full rounded-xl border border-slate-800 bg-slate-950/80 text-slate-100 placeholder-slate-500 p-3 h-full min-h-[60px]" />
        </div>
      </div>

      <div className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-950/80 p-4 shadow-xl shadow-black/30 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1 text-sm">
          <div>Subtotal: KES {subtotal.toLocaleString()}</div>
          <div>Tax: KES {taxAmount.toLocaleString()}</div>
          <div>Discount: KES {discount.toLocaleString()}</div>
          <div className="text-lg font-semibold text-emerald-400">Total: KES {total.toLocaleString()}</div>
          {docType === "LAYAWAY" && <div className="text-amber-400">Balance after deposit: KES {balance.toLocaleString()}</div>}
          <p className="pt-1 text-xs text-slate-400">
            Thank you for shopping with Betech Solar Solutions. You were served by {attendants.find((a) => a.id === attendantId)?.name || "____"}. Follow us on all social media platforms: @Betech Solar Solutions Kenya.
          </p>
          <p className="text-xs text-slate-400">Official Stamp: __________________________</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => { navigator.clipboard?.writeText(JSON.stringify({ items, subtotal, taxAmount, total })); showToast("Copied snapshot", "info"); }}>Copy snapshot</Button>
          <Button onClick={handleSave} disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-2 text-sm font-semibold text-black hover:brightness-95 focus:outline-none">{saving ? "Saving..." : "Save to System & Print"}</Button>
        </div>
      </div>
    </div>
  );
}
