"use client";
import React, { useEffect, useState } from 'react';

type Item = { id: number; message: string; type: string };

export default function ToastContainer() {
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    let idSeq = 1;
    function onToast(e: Event) {
      const ev = e as CustomEvent<{ message?: string; type?: string }>;
  const { message, type } = ev.detail || {};
  const msg = message ?? String(e);
  const tp = type ?? 'info';
  const id = idSeq++;
  setItems((s) => [...s, { id, message: msg, type: tp }]);
      setTimeout(() => setItems((s) => s.filter(x => x.id !== id)), 4000);
    }
    window.addEventListener('betechops:toast', onToast as EventListener);
    return () => window.removeEventListener('betechops:toast', onToast as EventListener);
  }, []);

  if (!items.length) return null;
  return (
    <div style={{ position: 'fixed', right: 12, top: 12, zIndex: 9999 }}>
      {items.map(i => (
        <div key={i.id} style={{ marginBottom: 8, padding: '8px 12px', background: '#111827', color: 'white', borderRadius: 6, minWidth: 220 }}>
          <div style={{ fontSize: 14 }}>{i.message}</div>
        </div>
      ))}
    </div>
  );
}
