"use client";

import React, { useState } from 'react';

export default function ReceiptsAdminClient({ initial }: { initial: any[] }) {
  const [rows, setRows] = useState(initial || []);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState<any | null>(null);
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [customer, setCustomer] = useState<string>("");
  const [docType, setDocType] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  const toggle = (id: string) => setExpanded((s) => ({ ...s, [id]: !s[id] }));

  const openEdit = async (id: string) => {
    try {
      const res = await fetch(`/api/receipts/${id}`);
      const json = await res.json();
      const receipt = json?.receipt ?? null;
      if (receipt) {
        setEditing({ ...receipt, order: { ...receipt.order, items: (receipt.order?.items || []).map((it: any) => ({ id: it.id, productId: it.productId, title: it.title || it.productName, quantity: it.quantity, sellingPrice: it.sellingPrice || it.unitPrice, serial: it.serial || '', warranty: it.warranty || '' })) } });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const closeEdit = () => setEditing(null);

  const saveEdit = async (payload: any) => {
    try {
      const res = await fetch(`/api/receipts/${editing.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const json = await res.json();
      if (json?.ok) {
        const list = await fetch('/api/receipts/list?includeItems=true');
        const j = await list.json();
        setRows(j.receipts || []);
        closeEdit();
      } else {
        alert(json?.error || 'Failed to save');
      }
    } catch (e) {
      alert('Failed to save');
    }
  };

  const fetchList = async (opts?: { page?: number }) => {
    try {
      setLoading(true);
      const q: any = new URLSearchParams();
      if (dateFrom) q.append('from', dateFrom);
      if (dateTo) q.append('to', dateTo);
      if (customer) q.append('customer', customer);
      if (docType) q.append('docType', docType);
      if (status) q.append('status', status);
      if (opts?.page) q.append('page', String(opts.page));
      q.append('includeItems', 'true');
      const res = await fetch('/api/receipts/list?' + q.toString());
      const json = await res.json();
      setRows(json.receipts || []);
    } catch (e) {
      console.error('Failed to fetch receipts list', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-4 p-2 border rounded">
        <div className="grid grid-cols-6 gap-2">
          <div>
            <label className="text-xs">From</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="border p-1 w-full" />
          </div>
          <div>
            <label className="text-xs">To</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="border p-1 w-full" />
          </div>
          <div>
            <label className="text-xs">Customer</label>
            <input value={customer} onChange={(e) => setCustomer(e.target.value)} className="border p-1 w-full" />
          </div>
          <div>
            <label className="text-xs">Doc Type</label>
            <input value={docType} onChange={(e) => setDocType(e.target.value)} className="border p-1 w-full" />
          </div>
          <div>
            <label className="text-xs">Status</label>
            <input value={status} onChange={(e) => setStatus(e.target.value)} className="border p-1 w-full" />
          </div>
          <div className="flex items-end gap-2">
            <button className="px-2 py-1 border" onClick={() => fetchList() }>{loading ? 'Searching...' : 'Search'}</button>
            <button className="px-2 py-1 border" onClick={() => { setDateFrom(''); setDateTo(''); setCustomer(''); setDocType(''); setStatus(''); fetchList(); }}>Reset</button>
          </div>
        </div>
      </div>
      <table className="w-full table-auto border-collapse">
        <thead>
          <tr className="text-left">
            <th>No.</th>
            <th>Date</th>
            <th>Doc Type</th>
            <th>Customer</th>
            <th>Attendant</th>
            <th>Total</th>
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
                <td>{(r.totals && r.totals.total) || r.total || ''}</td>
                <td>
                  <button className="mr-2" onClick={() => toggle(r.id)}>{expanded[r.id] ? 'Hide' : 'Expand'}</button>
                  <button onClick={() => openEdit(r.id)}>Edit</button>
                </td>
              </tr>
              {expanded[r.id] && (
                <tr>
                  <td colSpan={7}>
                    <table className="w-full">
                      <thead>
                        <tr><th>Title</th><th>Qty</th><th>Unit</th><th>Serial</th><th>Warranty</th></tr>
                      </thead>
                      <tbody>
                        {(r.items || []).map((it: any, i: number) => (
                          <tr key={i}><td>{it.title || it.productName}</td><td>{it.quantity}</td><td>{it.unitPrice || it.sellingPrice}</td><td>{it.serial}</td><td>{it.warranty}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white p-4 rounded max-w-2xl w-full">
            <h2 className="text-lg font-semibold">Edit Receipt {editing.id}</h2>
            <div className="mt-2">
              <label className="text-sm">Notes</label>
              <textarea value={editing.notes || ''} onChange={(e) => setEditing((s: any) => ({ ...s, notes: e.target.value }))} className="w-full border p-2" />
            </div>
            <div className="mt-2">
              <h3 className="font-semibold">Items</h3>
              {(editing.order?.items || []).map((it: any, idx: number) => (
                <div key={it.id || idx} className="grid grid-cols-6 gap-2 items-center my-1">
                  <input value={it.title || ''} onChange={(e) => setEditing((s: any) => { const copy = { ...s }; copy.order.items[idx].title = e.target.value; return copy; })} className="col-span-2 border p-1" />
                  <input type="number" value={it.quantity} onChange={(e) => setEditing((s: any) => { const copy = { ...s }; copy.order.items[idx].quantity = Number(e.target.value); return copy; })} className="border p-1" />
                  <input type="number" value={it.sellingPrice || 0} onChange={(e) => setEditing((s: any) => { const copy = { ...s }; copy.order.items[idx].sellingPrice = Number(e.target.value); return copy; })} className="border p-1" />
                  <input value={it.serial || ''} onChange={(e) => setEditing((s: any) => { const copy = { ...s }; copy.order.items[idx].serial = e.target.value; return copy; })} className="border p-1" />
                  <input value={it.warranty || ''} onChange={(e) => setEditing((s: any) => { const copy = { ...s }; copy.order.items[idx].warranty = e.target.value; return copy; })} className="border p-1" />
                  <button className="ml-2 text-red-600" onClick={() => setEditing((s: any) => { const copy = { ...s }; copy.order.items = copy.order.items.filter((_: any, i: number) => i !== idx); return copy; })}>Remove</button>
                </div>
              ))}
              <div className="mt-2">
                <button className="px-2 py-1 border mr-2" onClick={() => setEditing((s: any) => { const copy = { ...s }; copy.order.items = copy.order.items.concat([{ id: null, productId: null, title: '', quantity: 1, sellingPrice: 0, serial: '', warranty: '' }]); return copy; })}>Add Item</button>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={closeEdit} className="px-3 py-1 border">Cancel</button>
              <button onClick={() => saveEdit({ items: editing.order.items, notes: editing.notes })} className="px-3 py-1 bg-blue-600 text-white">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
