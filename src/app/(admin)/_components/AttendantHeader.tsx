"use client";
import React, { useEffect, useState } from 'react';

type Kpis = { queued: number; todayPacked: number; rts: number } | null;

export default function AttendantHeader({ user }: { user?: { name?: string } }) {
  const [kpis, setKpis] = useState<Kpis>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const res = await fetch('/api/metrics/kpis');
        if (!res.ok) return;
        const data = await res.json();
        if (mounted) setKpis(data);
      } catch (e) {
        // ignore
      }
    }
    void load();
    return () => { mounted = false };
  }, []);

  return (
    <header style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0 }}>Attendant</h2>
          <p style={{ margin: 0, color: '#6b7280' }}>{user?.name ?? '—'}</p>
        </div>
        <div style={{ display: 'flex', gap: 24, alignItems: 'baseline' }}>
          <div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>Queued</div>
            <div style={{ fontWeight: 600 }}>{kpis ? kpis.queued : '—'}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>Today Packed</div>
            <div style={{ fontWeight: 600 }}>{kpis ? kpis.todayPacked : '—'}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>RTS</div>
            <div style={{ fontWeight: 600 }}>{kpis ? kpis.rts : '—'}</div>
          </div>
        </div>
      </div>
      <div style={{ marginTop: 8, color: '#9ca3af', fontSize: 13 }}>Live KPIs powered by /api/metrics/kpis</div>
    </header>
  );
}
