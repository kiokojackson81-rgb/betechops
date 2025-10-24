"use client";
import React, { useState } from 'react';
import { showToast } from '@/lib/ui/toast';

export default function AttendantForm({ shops, onCreatedAction }: { shops: Array<{ id: string; name: string }>; onCreatedAction?: (u: { id: string; email?: string; name?: string }) => void }) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [shopId, setShopId] = useState('');
  const [roleAtShop, setRoleAtShop] = useState('ATTENDANT');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const res = await fetch('/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, name }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || 'failed');
      const user = j.user;
      if (shopId) {
        const r2 = await fetch(`/api/shops/${shopId}/assign`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id, roleAtShop }) });
        const j2 = await r2.json();
        if (!r2.ok) throw new Error(j2?.error || 'assign failed');
      }
      onCreatedAction?.(user);
      setEmail(''); setName(''); setShopId('');
      showToast('Attendant created', 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErr(msg);
    } finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <div>
        <label className="block">Email</label>
        <input value={email} onChange={e=>setEmail(e.target.value)} className="border p-1" required />
      </div>
      <div>
        <label className="block">Name</label>
        <input value={name} onChange={e=>setName(e.target.value)} className="border p-1" />
      </div>
      <div>
        <label className="block">Assign to shop (optional)</label>
        <select value={shopId} onChange={e=>setShopId(e.target.value)} className="border p-1">
          <option value="">-- none --</option>
          {shops.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        {shopId && (
          <select value={roleAtShop} onChange={e=>setRoleAtShop(e.target.value)} className="border p-1 ml-2">
            <option>ATTENDANT</option>
            <option>SUPERVISOR</option>
          </select>
        )}
      </div>
      {err && <div className="text-red-600">{err}</div>}
      <button type="submit" disabled={busy} className="px-3 py-1 bg-green-600 text-white">Create Attendant</button>
    </form>
  );
}
