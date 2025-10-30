"use client";
import React, { useState, useEffect } from 'react';
import UserPicker from './UserPicker';
import ManageAssignments from './ManageAssignments';
import { showToast } from '@/lib/ui/toast';

type ShopSummary = { id: string; name: string; platform?: string; assignedUser?: { id: string; label: string; roleAtShop?: string } };

type Probe =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok"; source: "SHOP" | "ENV"; platform?: string }
  | { status: "error"; message: string };

export default function ShopsList({ initial }: { initial: ShopSummary[] }) {
  const [shops, setShops] = useState<ShopSummary[]>(initial || []);
  const [prodTotals, setProdTotals] = useState<Record<string, { total: number; approx?: boolean }>>({});
  const [openAssign, setOpenAssign] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<{ id: string; label: string } | null>(null);
  const [roleAtShop, setRoleAtShop] = useState<string>('ATTENDANT');
  const [openManage, setOpenManage] = useState<string | null>(null);

  // NEW: per-shop probe results
  const [probe, setProbe] = useState<Record<string, Probe>>({});

  async function testAuth(shopId: string) {
    setProbe(p => ({ ...p, [shopId]: { status: "loading" } }));
    try {
      const res = await fetch(`/api/shops/${shopId}/auth-source`, { method: "POST" });
      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error(j?.error || `HTTP ${res.status}`);
      setProbe(p => ({ ...p, [shopId]: { status: "ok", source: j.source, platform: j.platform } }));
      showToast(`Auth OK (${j.source})`, j.source === "SHOP" ? "success" : "info");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setProbe(p => ({ ...p, [shopId]: { status: "error", message: msg || "failed" } }));
      showToast(`Auth failed: ${msg || "unknown error"}`, "error");
    }
  }

  async function assign(shopId: string, userId: string, roleAtShop: string) {
    const res = await fetch(`/api/shops/${shopId}/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, roleAtShop })
    });
    const j = await res.json();
    if (res.ok) {
      setShops((prev) => prev.map((p) => p.id === shopId ? { ...p, assignedUser: { id: userId, label: selectedUser?.label ?? '', roleAtShop } } : p));
      showToast('Assigned user to shop', 'success');
      setOpenAssign(null);
      setSelectedUser(null);
    } else {
      showToast('Error: ' + (j.error || 'failed'), 'error');
    }
  }

  // Load product totals per shop (best-effort)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = shops || [];
      for (const s of list) {
        try {
          const r = await fetch(`/api/debug/jumia/products-count?shopId=${encodeURIComponent(s.id)}&size=1`, { cache: 'no-store' });
          const j = await r.json();
          if (!cancelled && r.ok && j && typeof j.total === 'number') {
            setProdTotals((prev) => ({ ...prev, [s.id]: { total: j.total, approx: Boolean(j.approx) } }));
          }
        } catch {
          // ignore
        }
      }
    })();
    return () => { cancelled = true; };
  }, [shops]);

  const badge = (p: Probe | undefined) => {
    if (!p || p.status === "idle") return null;
    if (p.status === "loading") return <span className="ml-2 text-xs rounded-full px-2 py-0.5 bg-white/10">Testing…</span>;
    if (p.status === "error")   return <span className="ml-2 text-xs rounded-full px-2 py-0.5 bg-red-500/20 text-red-300">Error</span>;
    // ok
    const isShop = p.source === "SHOP";
    return (
      <span className={`ml-2 text-xs rounded-full px-2 py-0.5 ${isShop ? "bg-emerald-500/20 text-emerald-300" : "bg-yellow-500/20 text-yellow-300"}`}>
        {isShop ? "Using SHOP creds" : "Using ENV fallback"}
      </span>
    );
  };

  return (
    <div className="space-y-3">
      {shops.map(s => (
        <div key={s.id} className="p-3 border rounded flex justify-between items-center">
          <div className="min-w-0">
            <div className="font-medium flex items-center">
              <span className="truncate max-w-[40ch]">{s.name}</span>
              {badge(probe[s.id])}
            </div>
            <div className="text-sm text-slate-500">{s.platform}</div>
            <div className="text-sm text-slate-400">
              Products: {prodTotals[s.id]?.total ?? '…'}{prodTotals[s.id]?.approx ? ' (approx)' : ''}
            </div>
            {s.assignedUser && (
              <div className="text-sm text-slate-600">
                Assigned: {s.assignedUser.label} {s.assignedUser.roleAtShop ? `(${s.assignedUser.roleAtShop})` : ''}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button className="px-2 py-1 border" onClick={() => setOpenAssign(s.id)}>Assign</button>
            <button className="px-2 py-1 border" onClick={() => setOpenManage(s.id)}>Manage</button>
            {/* NEW: Test Auth */}
            <button
              className="px-2 py-1 border bg-white/5 hover:bg-white/10"
              onClick={() => testAuth(s.id)}
              disabled={probe[s.id]?.status === "loading"}
              title="Mint a token and show whether SHOP or ENV credentials are used"
            >
              Test Auth
            </button>
          </div>
        </div>
      ))}

      {openAssign && (
        <div className="p-3 border rounded">
          <h3 className="font-semibold">Assign user to shop</h3>
          <div className="space-x-2 mt-2 flex items-center">
            <UserPicker onSelect={(u) => setSelectedUser(u)} placeholder="Search user..." />
            <select value={roleAtShop} onChange={(e) => setRoleAtShop(e.target.value)} className="border p-1 ml-2">
              <option>ATTENDANT</option>
              <option>SUPERVISOR</option>
            </select>
            <button className="px-2 py-1 bg-blue-600 text-white ml-2"
              onClick={() => {
                if (!selectedUser) return showToast('Select a user', 'warn');
                assign(openAssign, selectedUser.id, roleAtShop);
              }}
            >
              Save
            </button>
            <button className="ml-2 px-2 py-1" onClick={() => { setOpenAssign(null); setSelectedUser(null); }}>Cancel</button>
          </div>
        </div>
      )}

      {openManage && (
        <div className="p-3 border rounded">
          <h3 className="font-semibold">Manage assignments</h3>
          <div className="mt-2">
            <ManageAssignments shopId={openManage} />
            <div className="mt-2">
              <button className="px-2 py-1" onClick={() => setOpenManage(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
