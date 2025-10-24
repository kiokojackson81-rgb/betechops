"use client";
import React, { useState } from 'react';

type Shop = { id: string; name: string; platform?: string };

export default function ShopForm({ onCreatedAction }: { onCreatedAction?: (s: Shop) => void }) {
  const [name, setName] = useState('');
  const [platform, setPlatform] = useState('JUMIA');
  const [credentials, setCredentials] = useState('{}');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

      async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
  const res = await fetch('/api/shops', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, platform, credentials: JSON.parse(credentials) }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || 'failed');
      // If a parent provided a callback, call it to let the parent update UI in-place.
      // Otherwise fall back to a full reload for compatibility.
      if (onCreatedAction) {
        onCreatedAction(j as Shop);
      } else if (typeof window !== 'undefined') {
        window.location.reload();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErr(msg);
    } finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <div>
        <label className="block">Name</label>
        <input value={name} onChange={e=>setName(e.target.value)} className="border p-1" />
      </div>
      <div>
        <label className="block">Platform</label>
        <select value={platform} onChange={e=>setPlatform(e.target.value)} className="border p-1">
          <option>JUMIA</option>
          <option>KILIMALL</option>
        </select>
      </div>
      <div>
        <label className="block">Credentials (JSON)</label>
        <textarea value={credentials} onChange={e=>setCredentials(e.target.value)} className="border p-1 w-full" rows={6} />
      </div>
      {err && <div className="text-red-600">{err}</div>}
      <button type="submit" disabled={busy} className="px-3 py-1 bg-blue-600 text-white">Create Shop</button>
    </form>
  );
}
