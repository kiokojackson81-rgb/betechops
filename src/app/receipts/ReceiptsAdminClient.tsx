"use client";

import React, { useEffect, useState } from "react";

type ReceiptRow = {
  id: string;
  orderRef?: string;
  docType: string;
  createdAt: string;
  customerName?: string | null;
  attendantName?: string | null;
  total?: number | null;
  status?: string | null;
  items?: any[];
};

type EditState = {
  id: string;
  notes?: string | null;
  taxRate?: number;
  showTax?: boolean;
  discount?: number;
  showDiscount?: boolean;
  paymentDetailsShown?: boolean;
  warrantyText?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  attendantId?: string | null;
  items: Array<{ id?: string | null; title: string; quantity: number; unitPrice: number; serial?: string | null; warranty?: string | null; supportItemId?: string | null; buyingPrice?: number | null }>;
};

export default function ReceiptsAdminClient({ initial, allowEdit = true }: { initial: ReceiptRow[]; allowEdit?: boolean }) {
  const [rows, setRows] = useState<ReceiptRow[]>(initial || []);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState<EditState | null>(null);
  const [start, setStart] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [end, setEnd] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [search, setSearch] = useState<string>("");
  const [docType, setDocType] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  const toggle = (id: string) => setExpanded((s) => ({ ...s, [id]: !s[id] }));

  const openEdit = async (id: string) => {
    if (!allowEdit) return;
    try {
      const res = await fetch(`/api/receipts/${id}`);
      const json = await res.json();
      const receipt = json?.receipt ?? null;
      const supportItems: Array<{ id: string; buyingPrice: number | null }> = json?.supportItems || [];
      if (receipt) {
        const orderItems = (receipt.order?.items || []).map((it: any, idx: number) => ({
          id: it.id,
          title: it.title || it.productName || "",
          quantity: it.quantity,
          unitPrice: Number(it.sellingPrice || it.unitPrice || 0),
          serial: it.serial || "",
          warranty: it.warranty || "",
          supportItemId: supportItems[idx]?.id || null,
          buyingPrice: supportItems[idx]?.buyingPrice ?? null,
        }));
        setEditing({
          id,
          notes: receipt.notes || "",
          taxRate: Number(receipt.taxRate || 0),
          showTax: Boolean(receipt.showTax),
          discount: Number(receipt.discount || 0),
          showDiscount: Boolean(receipt.showDiscount),
          paymentDetailsShown: Boolean(receipt.paymentDetailsShown),
          warrantyText: receipt.warrantyText || "",
          customerName: receipt.order?.customerName || "",
          customerPhone: receipt.order?.customerPhone || "",
          customerEmail: receipt.order?.customerEmail || "",
          attendantId: receipt.order?.attendantId || "",
          items: orderItems,
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const closeEdit = () => setEditing(null);

  const saveEdit = async () => {
    if (!editing) return;
    try {
      const payload = {
        notes: editing.notes,
        taxRate: editing.taxRate,
        showTax: editing.showTax,
        discount: editing.discount,
        showDiscount: editing.showDiscount,
        paymentDetailsShown: editing.paymentDetailsShown,
        warrantyText: editing.warrantyText,
        customerName: editing.customerName,
        customerPhone: editing.customerPhone,
        customerEmail: editing.customerEmail,
        attendantId: editing.attendantId,
        items: editing.items,
      };
      const res = await fetch(`/api/receipts/${editing.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const json = await res.json();
      if (json?.ok) {
        await fetchList();
        closeEdit();
      } else {
        alert(json?.error || "Failed to save");
      }
    } catch (e) {
      alert("Failed to save");
    }
  };

  const savePrices = async () => {
    if (!editing) return;
    try {
      for (const it of editing.items) {
        if (!it.supportItemId) continue;
        const price = Number(it.buyingPrice || 0);
        if (!price) continue;
        await fetch("/api/support/price-sale", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ receiptItemId: it.supportItemId, buyingPrice: price }),
        });
      }
      alert("Prices saved");
      await fetchList();
      closeEdit();
    } catch (e) {
      alert("Failed to save prices");
    }
  };

  const fetchList = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (start) params.append("start", start);
      if (end) params.append("end", end);
      if (search) params.append("q", search);
      if (docType) params.append("docType", docType);
      params.append("includeItems", "true");
      const res = await fetch(`/api/receipts?${params.toString()}`);
      const json = await res.json();
      setRows(json.receipts || []);
    } catch (e) {
      console.error("Failed to fetch receipts list", e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-2 rounded border border-slate-200 p-3 md:grid-cols-5">
        <div>
          <label className="text-xs">From</label>
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="w-full rounded border p-1" />
        </div>
        <div>
          <label className="text-xs">To</label>
          <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="w-full rounded border p-1" />
        </div>
        <div>
          <label className="text-xs">Search (name / phone / ref)</label>
          <input value={search} onChange={(e) => setSearch(e.target.value)} className="w-full rounded border p-1" placeholder="Name, phone, ref" />
        </div>
        <div>
          <label className="text-xs">Doc Type</label>
          <select value={docType} onChange={(e) => setDocType(e.target.value)} className="w-full rounded border p-1">
            <option value="">All</option>
            <option value="RECEIPT">Receipt</option>
            <option value="INVOICE">Invoice</option>
            <option value="QUOTATION">Quotation</option>
            <option value="LAYAWAY">Layaway</option>
          </select>
        </div>
        <div className="flex items-end gap-2">
          <button className="rounded border px-3 py-1" onClick={fetchList}>{loading ? "Loading..." : "Search"}</button>
          <button
            className="rounded border px-3 py-1"
            onClick={() => {
              const today = new Date().toISOString().split("T")[0];
              setStart(today);
              setEnd(today);
              setSearch("");
              setDocType("");
              fetchList();
            }}
          >
            Reset
          </button>
        </div>
      </div>

      <table className="w-full table-auto border-collapse text-sm">
        <thead>
          <tr className="text-left">
            <th>No.</th>
            <th>Date</th>
            <th>Doc Type</th>
            <th>Customer</th>
            <th>Attendant</th>
            <th>Total</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => (
            <React.Fragment key={r.id}>
              <tr className="border-t">
                <td>{idx + 1}</td>
                <td>{new Date(r.createdAt).toLocaleString()}</td>
                <td>{r.docType}</td>
                <td>{r.customerName}</td>
                <td>{r.attendantName}</td>
                <td>{r.total}</td>
                <td>{r.status}</td>
                <td className="space-x-2">
                  <button onClick={() => toggle(r.id)} className="text-blue-600">{expanded[r.id] ? "Hide" : "Expand"}</button>
                  {allowEdit && <button onClick={() => openEdit(r.id)} className="text-emerald-700">Edit</button>}
                </td>
              </tr>
              {expanded[r.id] && (
                <tr>
                  <td colSpan={8}>
                    <div className="rounded border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs text-slate-500 mb-2">Items for {r.orderRef}</p>
                      <table className="w-full text-xs">
                        <thead>
                          <tr><th>Title</th><th>Qty</th><th>Unit</th><th>Serial</th><th>Warranty</th></tr>
                        </thead>
                        <tbody>
                          {(r.items || []).map((it: any, i: number) => (
                            <tr key={i}><td>{it.title || it.productName}</td><td>{it.quantity}</td><td>{it.unitPrice || it.sellingPrice}</td><td>{it.serial}</td><td>{it.warranty}</td></tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded bg-white p-4">
            <h2 className="text-lg font-semibold">Edit Receipt {editing.id}</h2>
            <div className="mt-2 grid gap-3 md:grid-cols-2">
              <div>
                <label className="text-xs">Customer name</label>
                <input value={editing.customerName || ""} onChange={(e) => setEditing((s) => s ? { ...s, customerName: e.target.value } : s)} className="w-full rounded border p-1" />
              </div>
              <div>
                <label className="text-xs">Customer phone</label>
                <input value={editing.customerPhone || ""} onChange={(e) => setEditing((s) => s ? { ...s, customerPhone: e.target.value } : s)} className="w-full rounded border p-1" />
              </div>
              <div>
                <label className="text-xs">Customer email</label>
                <input value={editing.customerEmail || ""} onChange={(e) => setEditing((s) => s ? { ...s, customerEmail: e.target.value } : s)} className="w-full rounded border p-1" />
              </div>
              <div>
                <label className="text-xs">Notes</label>
                <textarea value={editing.notes || ""} onChange={(e) => setEditing((s) => s ? { ...s, notes: e.target.value } : s)} className="w-full rounded border p-1" />
              </div>
            </div>

            <div className="mt-3 grid gap-2 md:grid-cols-3">
              <label className="text-xs flex flex-col gap-1">Tax %<input type="number" value={editing.taxRate ?? 0} onChange={(e) => setEditing((s) => s ? { ...s, taxRate: Number(e.target.value || 0) } : s)} className="rounded border p-1" /></label>
              <label className="text-xs flex items-center gap-2"><input type="checkbox" checked={Boolean(editing.showTax)} onChange={(e) => setEditing((s) => s ? { ...s, showTax: e.target.checked } : s)} /> Show tax</label>
              <label className="text-xs flex flex-col gap-1">Discount (KES)<input type="number" value={editing.discount ?? 0} onChange={(e) => setEditing((s) => s ? { ...s, discount: Number(e.target.value || 0) } : s)} className="rounded border p-1" /></label>
              <label className="text-xs flex items-center gap-2"><input type="checkbox" checked={Boolean(editing.showDiscount)} onChange={(e) => setEditing((s) => s ? { ...s, showDiscount: e.target.checked } : s)} /> Show discount</label>
              <label className="text-xs flex items-center gap-2"><input type="checkbox" checked={Boolean(editing.paymentDetailsShown)} onChange={(e) => setEditing((s) => s ? { ...s, paymentDetailsShown: e.target.checked } : s)} /> Include payment details</label>
            </div>

            <div className="mt-3">
              <label className="text-xs">Warranty text</label>
              <input value={editing.warrantyText || ""} onChange={(e) => setEditing((s) => s ? { ...s, warrantyText: e.target.value } : s)} className="w-full rounded border p-1" />
            </div>

            <div className="mt-3">
              <h3 className="font-semibold">Items</h3>
              {(editing.items || []).map((it, idx) => (
                <div key={it.id || idx} className="mt-2 grid grid-cols-7 items-center gap-2">
                  <input value={it.title} onChange={(e) => setEditing((s) => {
                    if (!s) return s;
                    const copy = { ...s };
                    copy.items[idx].title = e.target.value;
                    return copy;
                  })} className="col-span-2 rounded border p-1" placeholder="Title" />
                  <input type="number" value={it.quantity} onChange={(e) => setEditing((s) => {
                    if (!s) return s;
                    const copy = { ...s };
                    copy.items[idx].quantity = Number(e.target.value);
                    return copy;
                  })} className="rounded border p-1" />
                  <input type="number" value={it.unitPrice} onChange={(e) => setEditing((s) => {
                    if (!s) return s;
                    const copy = { ...s };
                    copy.items[idx].unitPrice = Number(e.target.value);
                    return copy;
                  })} className="rounded border p-1" />
                  <input value={it.serial || ""} onChange={(e) => setEditing((s) => {
                    if (!s) return s;
                    const copy = { ...s };
                    copy.items[idx].serial = e.target.value;
                    return copy;
                  })} className="rounded border p-1" placeholder="Serial" />
                  <input value={it.warranty || ""} onChange={(e) => setEditing((s) => {
                    if (!s) return s;
                    const copy = { ...s };
                    copy.items[idx].warranty = e.target.value;
                    return copy;
                  })} className="rounded border p-1" placeholder="Warranty" />
                  {it.supportItemId ? (
                    <input type="number" value={it.buyingPrice ?? ""} onChange={(e) => setEditing((s) => {
                      if (!s) return s;
                      const copy = { ...s };
                      copy.items[idx].buyingPrice = Number(e.target.value || 0);
                      return copy;
                    })} className="rounded border p-1" placeholder="Buying price" />
                  ) : (
                    <div className="text-xs text-slate-500">Price later</div>
                  )}
                  <button className="text-red-600" onClick={() => setEditing((s) => {
                    if (!s) return s;
                    const copy = { ...s };
                    copy.items = copy.items.filter((_, i) => i !== idx);
                    return copy;
                  })}>Remove</button>
                </div>
              ))}
              <div className="mt-2">
                <button className="rounded border px-2 py-1" onClick={() => setEditing((s) => s ? { ...s, items: [...s.items, { id: null, title: "", quantity: 1, unitPrice: 0, serial: "", warranty: "" }] } : s)}>Add Item</button>
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button onClick={closeEdit} className="rounded border px-3 py-1">Cancel</button>
              <button onClick={saveEdit} className="rounded bg-blue-600 px-3 py-1 text-white">Save</button>
              <button onClick={savePrices} className="rounded bg-emerald-600 px-3 py-1 text-white">Save Prices</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
