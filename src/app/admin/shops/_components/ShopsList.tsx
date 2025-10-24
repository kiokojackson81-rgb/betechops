"use client";
import React, { useState } from 'react';
import UserPicker from './UserPicker';

type ShopSummary = { id: string; name: string; platform?: string };

export default function ShopsList({ initial }: { initial: ShopSummary[] }) {
  const [shops] = useState<ShopSummary[]>(initial || []);
  const [openAssign, setOpenAssign] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<{ id: string; label: string } | null>(null);
  const [roleAtShop, setRoleAtShop] = useState<string>('ATTENDANT');

  async function assign(shopId: string, userId: string, roleAtShop: string) {
    const res = await fetch(`/api/shops/${shopId}/assign`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, roleAtShop }) });
    const j = await res.json();
    if (res.ok) {
      alert('Assigned');
      setOpenAssign(null);
      setSelectedUser(null);
    } else {
      alert('Error: ' + (j.error || 'failed'));
    }
  }

  return (
    <div className="space-y-3">
      {shops.map(s => (
        <div key={s.id} className="p-2 border rounded flex justify-between items-center">
          <div>
            <div className="font-medium">{s.name}</div>
            <div className="text-sm text-slate-500">{s.platform}</div>
          </div>
          <div>
            <button className="mr-2 px-2 py-1 border" onClick={() => setOpenAssign(s.id)}>Assign</button>
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
              if (!selectedUser) return alert('Select a user');
              assign(openAssign, selectedUser.id, roleAtShop);
            }}>Save</button>
            <button className="ml-2 px-2 py-1" onClick={() => { setOpenAssign(null); setSelectedUser(null); }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
