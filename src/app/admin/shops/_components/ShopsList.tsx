"use client";
import React, { useState } from 'react';
import UserPicker from './UserPicker';
import ManageAssignments from './ManageAssignments';
import { showToast } from '@/lib/ui/toast';

type ShopSummary = { id: string; name: string; platform?: string; assignedUser?: { id: string; label: string; roleAtShop?: string } };

export default function ShopsList({ initial }: { initial: ShopSummary[] }) {
  const [shops, setShops] = useState<ShopSummary[]>(initial || []);
  const [openAssign, setOpenAssign] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<{ id: string; label: string } | null>(null);
  const [roleAtShop, setRoleAtShop] = useState<string>('ATTENDANT');
  const [openManage, setOpenManage] = useState<string | null>(null);

  async function assign(shopId: string, userId: string, roleAtShop: string) {
    const res = await fetch(`/api/shops/${shopId}/assign`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, roleAtShop }) });
    const j = await res.json();
    if (res.ok) {
      // optimistic UI update: set assigned user locally
      setShops((prev) => prev.map((p) => p.id === shopId ? { ...p, assignedUser: { id: userId, label: selectedUser?.label ?? '', roleAtShop } } : p));
      showToast('Assigned user to shop', 'success');
      setOpenAssign(null);
      setSelectedUser(null);
    } else {
      showToast('Error: ' + (j.error || 'failed'), 'error');
    }
  }

  return (
    <div className="space-y-3">
      {shops.map(s => (
        <div key={s.id} className="p-2 border rounded flex justify-between items-center">
          <div>
            <div className="font-medium">{s.name}</div>
            <div className="text-sm text-slate-500">{s.platform}</div>
            {s.assignedUser && <div className="text-sm text-slate-600">Assigned: {s.assignedUser.label} {s.assignedUser.roleAtShop ? `(${s.assignedUser.roleAtShop})` : ''}</div>}
          </div>
          <div>
            <button className="mr-2 px-2 py-1 border" onClick={() => setOpenAssign(s.id)}>Assign</button>
            <button className="px-2 py-1 border" onClick={() => setOpenManage(s.id)}>Manage</button>
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
            <button className="px-2 py-1 bg-blue-600 text-white ml-2" onClick={() => {
              if (!selectedUser) return showToast('Select a user', 'warn');
              assign(openAssign, selectedUser.id, roleAtShop);
            }}>Save</button>
            <button className="ml-2 px-2 py-1" onClick={() => { setOpenAssign(null); setSelectedUser(null); }}>Cancel</button>
          </div>
        </div>
      )}
      {openManage && (
        <div className="p-3 border rounded">
          <h3 className="font-semibold">Manage assignments</h3>
          <div className="mt-2">
            <ManageAssignments shopId={openManage} />
            <div className="mt-2"><button className="px-2 py-1" onClick={() => setOpenManage(null)}>Close</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
