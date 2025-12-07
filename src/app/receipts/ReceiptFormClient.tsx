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
    <div className="mx-auto max-w-6xl p-4 space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Create receipt / invoice / quotation / layaway</h1>
        <p className="text-sm text-slate-500">Saves to the unified receipts table and is ready for printing or sending.</p>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="text-sm text-slate-600">Attendant</label>
          <select value={attendantId ?? ""} onChange={(e) => setAttendantId(e.target.value || null)} className="w-full rounded border px-3 py-2">
            <option value="">Select attendant</option>
            {attendants.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-sm text-slate-600">Document Type</label>
          <select value={docType} onChange={(e) => setDocType(e.target.value)} className="w-full rounded border px-3 py-2">
            <option>RECEIPT</option>
            <option>INVOICE</option>
            <option>QUOTATION</option>
            <option>LAYAWAY</option>
          </select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label className="text-sm text-slate-600">Serial / Receipt No.</label>
          <Input value={serial} onChange={(e) => setSerial(e.target.value)} placeholder="Serial" />
        </div>
        <div>
          <label className="text-sm text-slate-600">Customer Name</label>
          <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Customer name" />
        </div>
        <div>
          <label className="text-sm text-slate-600">Customer Phone</label>
          <Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="07..." />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="text-sm text-slate-600">Customer Email (for sending)</label>
          <Input value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} placeholder="email@example.com" />
        </div>
        <div className="flex items-end gap-3">
          <label className="inline-flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} />
            Send via e-mail
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={sendWhatsapp} onChange={(e) => setSendWhatsapp(e.target.checked)} />
            Send via WhatsApp
          </label>
        </div>
      </div>

      <section className="space-y-3 rounded-xl border border-slate-200 p-3">
        <div className="flex flex-wrap items-center gap-4">
          <label className="inline-flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={showSerials} onChange={(e) => setShowSerials(e.target.checked)} />
            Capture serial / IMEI per item
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={showWarranty} onChange={(e) => setShowWarranty(e.target.checked)} />
            Capture warranty per item
          </label>
        </div>

        <div className="space-y-2">
          {items.map((it) => (
            <div key={it.id} className="grid gap-2 md:grid-cols-6 items-center border-b pb-2">
              <input className="col-span-2 rounded border px-2 py-1" value={it.title} onChange={(e) => updateRow(it.id, { title: e.target.value })} placeholder="Item description" />
              <input type="number" min={1} className="rounded border px-2 py-1" value={it.quantity} onChange={(e) => updateRow(it.id, { quantity: Math.max(1, Number(e.target.value || 1)) })} />
              <input type="number" min={0} className="rounded border px-2 py-1" value={it.unitPrice as any} onChange={(e) => updateRow(it.id, { unitPrice: e.target.value === "" ? "" : Number(e.target.value) })} placeholder="Unit price" />
              {showSerials ? (
                <input className="rounded border px-2 py-1" value={it.serial} onChange={(e) => updateRow(it.id, { serial: e.target.value })} placeholder="Serial / IMEI" />
              ) : (
                <div />
              )}
              {showWarranty ? (
                <select className="rounded border px-2 py-1" value={it.warranty} onChange={(e) => updateRow(it.id, { warranty: e.target.value })}>
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
        <div className="mt-2">
          <Button onClick={addRow}>+ Add item</Button>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label className="text-sm text-slate-600">Tax %</label>
          <Input type="number" value={taxRate} onChange={(e) => setTaxRate(Number(e.target.value || 0))} />
          <label className="inline-flex items-center mt-1 text-sm text-slate-600"><input type="checkbox" checked={showTax} onChange={(e) => setShowTax(e.target.checked)} className="mr-2" /> Show Tax</label>
        </div>
        <div>
          <label className="text-sm text-slate-600">Discount (KES)</label>
          <Input type="number" value={discount} onChange={(e) => setDiscount(Number(e.target.value || 0))} />
          <label className="inline-flex items-center mt-1 text-sm text-slate-600"><input type="checkbox" checked={showDiscount} onChange={(e) => setShowDiscount(e.target.checked)} className="mr-2" /> Show Discount</label>
        </div>
        <div>
          <label className="text-sm text-slate-600">Payment details</label>
          <div className="mt-1">
            <label className="inline-flex items-center text-sm text-slate-600"><input type="checkbox" checked={paymentDetailsShown} onChange={(e) => setPaymentDetailsShown(e.target.checked)} className="mr-2" /> Include payment details on receipt</label>
          </div>
          {docType === "LAYAWAY" && (
            <div className="mt-3 space-y-1">
              <label className="text-sm text-slate-600">Deposit (KES)</label>
              <Input type="number" value={deposit} onChange={(e) => setDeposit(Number(e.target.value || 0))} />
              <p className="text-xs text-slate-500">Balance auto-computed from total.</p>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="text-sm text-slate-600">Warranty note</label>
          <Input value={warrantyText} onChange={(e) => setWarrantyText(e.target.value)} placeholder="Global warranty text (optional)" />
        </div>
        <div>
          <label className="text-sm text-slate-600">General notes / terms</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full rounded border p-2 h-full min-h-[60px]" />
        </div>
      </div>

      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm card-top-accent">
        <div className="space-y-1 text-sm">
          <div>Subtotal: KES {subtotal.toLocaleString()}</div>
          <div>Tax: KES {taxAmount.toLocaleString()}</div>
          <div>Discount: KES {discount.toLocaleString()}</div>
          <div className="text-lg font-semibold">Total: KES {total.toLocaleString()}</div>
          {docType === "LAYAWAY" && <div className="text-amber-700">Balance after deposit: KES {balance.toLocaleString()}</div>}
          <p className="text-xs text-slate-500">
            Thank you for shopping with Betech Solar Solutions. You were served by {attendants.find((a) => a.id === attendantId)?.name || "____"}. Follow us on all social media platforms: @Betech Solar Solutions Kenya.
          </p>
          <p className="text-xs text-slate-500">Official Stamp: __________________________</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => { navigator.clipboard?.writeText(JSON.stringify({ items, subtotal, taxAmount, total })); showToast("Copied snapshot", "info"); }}>Copy snapshot</Button>
          <Button variant="primary" onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save to System & Print"}</Button>
        </div>
      </div>
    </div>
  );
}
