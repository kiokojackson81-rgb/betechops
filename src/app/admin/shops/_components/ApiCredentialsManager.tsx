"use client";
import React, { useEffect, useState } from 'react';
import { showToast } from '@/lib/ui/toast';

type Cred = { id: string; scope: string; apiBase?: string; apiKey?: string; apiSecret?: string; shopId?: string };

export default function ApiCredentialsManager() {
  const [creds, setCreds] = useState<Cred[]>([]);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ scope: 'GLOBAL', apiBase: '', apiKey: '', apiSecret: '', shopId: '' });
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    const res = await fetch('/api/credentials');
    if (!res.ok) return;
    const j = await res.json();
    setCreds(j || []);
  }

  useEffect(() => { load(); }, []);

  const [editingId, setEditingId] = useState<string | null>(null);

  async function create() {
    setBusy(true); setMsg(null);
    try {
      const method = editingId ? 'PATCH' : 'POST';
      const url = editingId ? `/api/credentials/${editingId}` : '/api/credentials';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || 'failed');
      showToast(editingId ? 'Updated' : 'Saved', 'success');
      setForm({ scope: 'GLOBAL', apiBase: '', apiKey: '', apiSecret: '', shopId: '' });
      setEditingId(null);
      await load();
    } catch (err: unknown) {
      const m = err instanceof Error ? err.message : String(err);
      setMsg(m);
      showToast(m, 'error');
    } finally { setBusy(false); }
  }

  async function remove(id: string) {
    // two-step delete: set pending state requiring a second click to confirm
    if (editingId !== id) {
      setEditingId(id);
      showToast('Click delete again to confirm deletion', 'warn');
      return;
    }
    const res = await fetch(`/api/credentials/${id}`, { method: 'DELETE' });
    if (res.ok) { showToast('Deleted', 'success'); setEditingId(null); load(); }
    else { showToast('Delete failed', 'error'); }
  }

  return (
    <div className="space-y-3">
      <div className="p-2 border rounded">
        <div className="font-semibold">Create API Credential</div>
        <div className="space-y-2 mt-2">
          <div>
            <label className="block">Scope</label>
            <select value={form.scope} onChange={e=>setForm(f=>({...f, scope: e.target.value}))} className="border p-1">
              <option>GLOBAL</option>
              <option>SHOP</option>
            </select>
          </div>
          <div>
            <label className="block">API Base</label>
            <input value={form.apiBase} onChange={e=>setForm(f=>({...f, apiBase: e.target.value}))} className="border p-1 w-full" />
          </div>
          <div>
            <label className="block">API Key</label>
            <input value={form.apiKey} onChange={e=>setForm(f=>({...f, apiKey: e.target.value}))} className="border p-1 w-full" />
          </div>
          <div>
            <label className="block">Shop ID (optional)</label>
            <input value={form.shopId} onChange={e=>setForm(f=>({...f, shopId: e.target.value}))} className="border p-1 w-full" />
          </div>
          <div>
            <button className="px-3 py-1 bg-blue-600 text-white" onClick={create} disabled={busy}>Save</button>
            {msg && <span className="ml-2 text-sm">{msg}</span>}
          </div>
        </div>
      </div>

      <div className="p-2 border rounded">
        <div className="font-semibold">Existing Credentials</div>
        <div className="mt-2 space-y-2">
          {creds.map(c => (
            <div key={c.id} className="flex justify-between items-center">
              <div>
                <div className="font-medium">{c.scope} {c.shopId ? `(${c.shopId})` : ''}</div>
                <div className="text-sm text-slate-500">{c.apiBase} {c.apiKey ? '•' : ''}</div>
              </div>
              <div>
                <button className="px-2 py-1 mr-2" onClick={() => { setForm({ scope: c.scope, apiBase: c.apiBase || '', apiKey: c.apiKey || '', apiSecret: c.apiSecret || '', shopId: c.shopId || '' }); setEditingId(c.id); showToast('Editing credential', 'info'); }}>Edit</button>
                <button className="px-2 py-1 text-red-600" onClick={() => remove(c.id)}>{editingId === c.id ? 'Confirm Delete' : 'Delete'}</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
