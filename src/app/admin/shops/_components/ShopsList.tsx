"use client";
import React, { useState } from 'react';

type ShopSummary = { id: string; name: string; platform?: string };

export default function ShopsList({ initial }: { initial: ShopSummary[] }) {
  const [shops] = useState<ShopSummary[]>(initial || []);
  const [openAssign, setOpenAssign] = useState<string | null>(null);

  async function assign(shopId: string, userId: string, roleAtShop: string) {
    const res = await fetch(`/api/shops/${shopId}/assign`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, roleAtShop }) });
    const j = await res.json();
    if (res.ok) {
      alert('Assigned');
      setOpenAssign(null);
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
          <div className="space-x-2 mt-2">
            <input id="userId" placeholder="User ID" className="border p-1" />
            <select id="roleAtShop" className="border p-1">
              <option>ATTENDANT</option>
              <option>SUPERVISOR</option>
            </select>
            <button className="px-2 py-1 bg-blue-600 text-white" onClick={() => {
              const userId = (document.getElementById('userId') as HTMLInputElement).value;
              const roleAtShop = (document.getElementById('roleAtShop') as HTMLSelectElement).value;
              assign(openAssign, userId, roleAtShop);
            }}>Save</button>
            <button className="ml-2 px-2 py-1" onClick={() => setOpenAssign(null)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
