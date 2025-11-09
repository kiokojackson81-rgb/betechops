"use client";
import React, { useState } from 'react';
import { showToast } from '@/lib/ui/toast';
import { useShopsActionsSafe } from './ShopsActionsContext';
import { attendantCategoryOptions } from '@/lib/attendants/categories';

type AttendantProps = {
  shops: { id: string; name: string }[];
  onCreatedAction?: (u: { id: string; email?: string; name?: string }, assigned?: { shopId?: string; roleAtShop?: string }) => void;
};

export default function AttendantForm({ shops }: AttendantProps) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [shopId, setShopId] = useState('');
  const [roleAtShop, setRoleAtShop] = useState('ATTENDANT');
  const [categories, setCategories] = useState<string[]>(['GENERAL']);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const actions = useShopsActionsSafe();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const res = await fetch('/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, name, categories }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || 'failed');
      const user = j.user;
      if (shopId) {
        const r2 = await fetch(`/api/shops/${shopId}/assign`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id, roleAtShop }) });
        const j2 = await r2.json();
        if (!r2.ok) throw new Error(j2?.error || 'assign failed');
      }
      // Notify the user and let a parent update the UI in-place if available.
      setEmail(''); setName(''); setShopId(''); setCategories(['GENERAL']);
      showToast('Attendant created', 'success');
  // Notify parent via context if available (provider optional).
  actions.onAttendantCreated(user, shopId ? { shopId, roleAtShop } : undefined);
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
        <label className="block">Categories</label>
        <div className="flex flex-col gap-1 border border-slate-600/40 p-2 rounded">
          {attendantCategoryOptions.map(opt => {
            const checked = categories.includes(opt.id);
            return (
              <label key={opt.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={e => {
                    const next = e.target.checked
                      ? Array.from(new Set([...categories, opt.id]))
                      : categories.filter(c => c !== opt.id);
                    if (!next.length) {
                      showToast('Select at least one category', 'error');
                      return;
                    }
                    setCategories(next);
                  }}
                />
                <span>{opt.label}</span>
              </label>
            );
          })}
        </div>
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
