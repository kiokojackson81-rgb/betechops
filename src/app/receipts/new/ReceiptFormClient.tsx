"use client";

import React, { useEffect, useState } from 'react';

export default function ReceiptFormClient() {
  const [attendants, setAttendants] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([{ title: '', quantity: 1, unitPrice: 0, serial: '', warranty: '' }]);
  const [attendantId, setAttendantId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [taxRate, setTaxRate] = useState(0);
  const [showTax, setShowTax] = useState(false);

  useEffect(() => {
    fetch('/api/users?role=ATTENDANT').then((r) => r.json()).then((j) => setAttendants(j.users || []));
  }, []);

  const addItem = () => setItems((s) => s.concat([{ title: '', quantity: 1, unitPrice: 0, serial: '', warranty: '' }]));
  const removeItem = (idx: number) => setItems((s) => s.filter((_, i) => i !== idx));

  const save = async () => {
    const payload: any = {
      docType: 'RECEIPT',
      attendantId,
      customerName,
      taxRate,
      showTax,
      items,
    };
    const res = await fetch('/api/receipts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const json = await res.json();
    if (json.ok) {
      alert('Saved. Printing...');
      // open print view
      window.open(`/receipts/${json.receiptId}`, '_blank');
      setTimeout(() => window.print(), 1000);
    } else {
      alert(json.error || 'Failed to save');
    }
  };

  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold">New Receipt</h2>
      <div className="mt-2">
        <label>Attendant</label>
        <select value={attendantId || ''} onChange={(e) => setAttendantId(e.target.value || null)} className="border p-1 w-full">
          <option value="">-- Select --</option>
          {attendants.map((a) => (<option key={a.id} value={a.id}>{a.name}</option>))}
        </select>
      </div>
      <div className="mt-2">
        <label>Customer Name</label>
        <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="w-full border p-1" />
      </div>

      <div className="mt-4">
        <h3 className="font-semibold">Items</h3>
        {items.map((it, idx) => (
          <div key={idx} className="grid grid-cols-6 gap-2 items-center my-1">
            <input value={it.title} onChange={(e) => setItems((s) => { const c = [...s]; c[idx].title = e.target.value; return c; })} className="col-span-2 border p-1" placeholder="Title" />
            <input type="number" value={it.quantity} onChange={(e) => setItems((s) => { const c = [...s]; c[idx].quantity = Number(e.target.value); return c; })} className="border p-1" />
            <input type="number" value={it.unitPrice} onChange={(e) => setItems((s) => { const c = [...s]; c[idx].unitPrice = Number(e.target.value); return c; })} className="border p-1" />
            <input value={it.serial} onChange={(e) => setItems((s) => { const c = [...s]; c[idx].serial = e.target.value; return c; })} className="border p-1" placeholder="Serial" />
            <input value={it.warranty} onChange={(e) => setItems((s) => { const c = [...s]; c[idx].warranty = e.target.value; return c; })} className="border p-1" placeholder="Warranty" />
            <button className="text-red-600" onClick={() => removeItem(idx)}>Remove</button>
          </div>
        ))}
        <button className="px-2 py-1 border mt-2" onClick={addItem}>Add Item</button>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <div>
          <label>Tax %</label>
          <input type="number" value={taxRate} onChange={(e) => setTaxRate(Number(e.target.value))} className="border p-1" />
        </div>
        <div>
          <label>Show Tax</label>
          <input type="checkbox" checked={showTax} onChange={(e) => setShowTax(e.target.checked)} />
        </div>
      </div>

      <div className="mt-4">
        <button className="px-4 py-2 bg-blue-600 text-white" onClick={save}>Save & Print</button>
      </div>
    </div>
  );
}
"use client";

import React, { useEffect, useMemo, useState } from "react";
import Input from "@/app/_components/Input";
import Button from "@/app/_components/Button";
import { showToast } from "@/lib/ui/toast";

const warrantyOptions = ["1 Year", "2 Years", "3 Years", "5 Years", "6 Years", "10 Years"];

type ItemRow = { id: string; title: string; quantity: number; unitPrice: number | ""; serial?: string; warranty?: string };

export default function ReceiptFormClient() {
  const [attendants, setAttendants] = useState<Array<{ id: string; name: string }>>([]);
  const [attendantId, setAttendantId] = useState<string | null>(null);
  const [docType, setDocType] = useState<string>("RECEIPT");
  const [serial, setSerial] = useState<string>("");
  const [customerName, setCustomerName] = useState<string>("");
  const [customerPhone, setCustomerPhone] = useState<string>("");
  const [items, setItems] = useState<ItemRow[]>([
    { id: String(Math.random()), title: "", quantity: 1, unitPrice: "", serial: "", warranty: "1 Year" },
  ]);
  const [taxRate, setTaxRate] = useState<number>(16);
  const [showTax, setShowTax] = useState<boolean>(true);
  const [discount, setDiscount] = useState<number>(0);
  const [showDiscount, setShowDiscount] = useState<boolean>(false);
  const [paymentDetailsShown, setPaymentDetailsShown] = useState<boolean>(false);
  const [notes, setNotes] = useState<string>("");
  const [warrantyText, setWarrantyText] = useState<string>("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/users?role=ATTENDANT');
        const json = await res.json();
        if (Array.isArray(json?.users)) setAttendants(json.users.map((u: any) => ({ id: u.id, name: u.name || u.email })));
      } catch (e) {
        // ignore
      }
    })();
  }, []);

  const addRow = () => setItems((s) => [...s, { id: String(Math.random()), title: "", quantity: 1, unitPrice: "", serial: "", warranty: warrantyOptions[0] }]);
  const removeRow = (id: string) => setItems((s) => (s.length > 1 ? s.filter((r) => r.id !== id) : s));
  const updateRow = (id: string, patch: Partial<ItemRow>) => setItems((s) => s.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const subtotal = useMemo(() => items.reduce((acc, it) => acc + (Number(it.unitPrice || 0) * Number(it.quantity || 1)), 0), [items]);
  const taxAmount = showTax ? subtotal * (taxRate / 100) : 0;
  const total = subtotal + taxAmount - discount;

  const handleSave = async () => {
    if (!attendantId) return showToast('Select attendant', 'error');
    setSending(true);
    try {
      const payload = {
        docType: docType.toLowerCase(),
        serial,
        date: new Date().toISOString(),
        customerName,
        customerPhone,
        attendantId,
        issuedById: attendantId,
        taxRate,
        showTax,
        discount,
        showDiscount,
        paymentDetailsShown,
        notes,
        warrantyText,
        items: items.map((it) => ({ title: it.title, quantity: it.quantity, unitPrice: Number(it.unitPrice || 0), serial: it.serial || null, warranty: it.warranty || null })),
      };

      const res = await fetch('/api/receipts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), credentials: 'same-origin' });
      const data = await res.json();
      if (!res.ok) {
        showToast(data?.error || 'Failed to save receipt', 'error');
      } else {
        showToast('Saved receipt', 'success');
        // open print dialog
        setTimeout(() => window.print(), 300);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save', 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl p-4">
      <h1 className="text-2xl font-semibold mb-4">Create Receipt / Invoice / Quotation / Layaway</h1>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="text-sm">Attendant</label>
          <select value={attendantId ?? ''} onChange={(e) => setAttendantId(e.target.value || null)} className="w-full rounded border px-3 py-2">
            <option value="">Select attendant</option>
            {attendants.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-sm">Document Type</label>
          <select value={docType} onChange={(e) => setDocType(e.target.value)} className="w-full rounded border px-3 py-2">
            <option>RECEIPT</option>
            <option>INVOICE</option>
            <option>QUOTATION</option>
            <option>LAYAWAY</option>
          </select>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <label className="text-sm">Serial / Receipt No.</label>
          <Input value={serial} onChange={(e) => setSerial(e.target.value)} placeholder="Serial" />
        </div>
        <div>
          <label className="text-sm">Customer Phone</label>
          <Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="07..." />
        </div>
      </div>

      <div className="mt-6">
        <div className="space-y-3">
          {items.map((it) => (
            <div key={it.id} className="grid gap-2 md:grid-cols-6 items-center border-b py-2">
              <input className="col-span-2 rounded border px-2 py-1" value={it.title} onChange={(e) => updateRow(it.id, { title: e.target.value })} placeholder="Item description" />
              <input type="number" min={1} className="rounded border px-2 py-1" value={it.quantity} onChange={(e) => updateRow(it.id, { quantity: Math.max(1, Number(e.target.value || 1)) })} />
              <input type="number" min={0} className="rounded border px-2 py-1" value={it.unitPrice as any} onChange={(e) => updateRow(it.id, { unitPrice: e.target.value === '' ? '' : Number(e.target.value) })} placeholder="Unit price" />
              <input className="rounded border px-2 py-1" value={it.serial} onChange={(e) => updateRow(it.id, { serial: e.target.value })} placeholder="Serial / IMEI" />
              <select className="rounded border px-2 py-1" value={it.warranty} onChange={(e) => updateRow(it.id, { warranty: e.target.value })}>
                {warrantyOptions.map((w) => <option key={w} value={w}>{w}</option>)}
              </select>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => removeRow(it.id)}>Remove</Button>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-2">
          <Button onClick={addRow}>+ Add item</Button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <div>
          <label className="text-sm">Tax %</label>
          <Input type="number" value={taxRate} onChange={(e) => setTaxRate(Number(e.target.value || 0))} />
          <label className="inline-flex items-center mt-1"><input type="checkbox" checked={showTax} onChange={(e) => setShowTax(e.target.checked)} className="mr-2"/> Show Tax</label>
        </div>
        <div>
          <label className="text-sm">Discount (KES)</label>
          <Input type="number" value={discount} onChange={(e) => setDiscount(Number(e.target.value || 0))} />
          <label className="inline-flex items-center mt-1"><input type="checkbox" checked={showDiscount} onChange={(e) => setShowDiscount(e.target.checked)} className="mr-2"/> Show Discount</label>
        </div>
        <div>
          <label className="text-sm">Payment details</label>
          <div className="mt-1">
            <label className="inline-flex items-center"><input type="checkbox" checked={paymentDetailsShown} onChange={(e) => setPaymentDetailsShown(e.target.checked)} className="mr-2"/> Include payment details on printed receipt</label>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <label className="text-sm">Warranty note</label>
        <Input value={warrantyText} onChange={(e) => setWarrantyText(e.target.value)} placeholder="Global warranty text (optional)" />
      </div>

      <div className="mt-4">
        <label className="text-sm">Notes</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full rounded border p-2" />
      </div>

      <div className="mt-6 flex items-center justify-between">
        <div>
          <div>Subtotal: KES {subtotal.toLocaleString()}</div>
          <div>Tax: KES {taxAmount.toLocaleString()}</div>
          <div>Total: KES {total.toLocaleString()}</div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => { navigator.clipboard?.writeText(JSON.stringify({ items, subtotal, taxAmount, total })); showToast('Copied snapshot to clipboard', 'info'); }}>Copy snapshot</Button>
          <Button onClick={handleSave} disabled={sending}>{sending ? 'Saving...' : 'Save to System & Print'}</Button>
        </div>
      </div>
    </div>
  );
}
