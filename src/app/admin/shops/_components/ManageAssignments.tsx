"use client";
import React, { useEffect, useState } from 'react';
import { showToast } from '@/lib/ui/toast';
import { confirmDialog } from '@/lib/ui/toast';

type Assignment = { id: string; user: { id: string; name?: string; email?: string }; roleAtShop: string };

export default function ManageAssignments({ shopId }: { shopId: string }) {
  const [rows, setRows] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/shops/${shopId}/assignments`);
        if (!res.ok) throw new Error('Failed to load');
        const j = await res.json();
        if (mounted) setRows(j || []);
      } catch {
        showToast('Failed to load assignments', 'error');
      } finally { if (mounted) setLoading(false); }
    }
    load();
    return () => { mounted = false; };
  }, [shopId]);

  async function remove(userId: string) {
    // two-step delete confirmation: first click marks pending
    const ok = await confirmDialog(`Remove assignment for user ${userId}?`);
    if (!ok) return;
    try {
      const res = await fetch(`/api/shops/${shopId}/assignments`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId }) });
      if (!res.ok) throw new Error('Delete failed');
      showToast('Removed assignment', 'success');
      // refresh assignments
      const r2 = await fetch(`/api/shops/${shopId}/assignments`);
      if (r2.ok) {
        const j2 = await r2.json();
        setRows(j2 || []);
      }
    } catch {
      showToast('Failed to remove assignment', 'error');
    }
  }

  if (loading) return <div>Loading...</div>;
  if (!rows.length) return <div className="text-sm text-slate-500">No assignments</div>;
  return (
    <div className="space-y-2">
      {rows.map(r => (
        <div key={r.id} className="flex justify-between items-center p-2 border rounded">
          <div>
            <div className="font-medium">{r.user.name ?? r.user.email}</div>
            <div className="text-sm text-slate-500">{r.roleAtShop}</div>
          </div>
          <div>
            <button className="text-red-600 px-2 py-1" onClick={() => remove(r.user.id)}>Remove</button>
          </div>
        </div>
      ))}
    </div>
  );
}
