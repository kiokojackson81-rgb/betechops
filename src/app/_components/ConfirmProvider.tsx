"use client";
import React, { useEffect, useState } from 'react';

export default function ConfirmProvider() {
  const [queue, setQueue] = useState<Array<{ id: string; message: string }>>([]);

  useEffect(() => {
    function onRequest(e: Event) {
      const ev = e as CustomEvent<{ id?: string; message?: string }>;
      const id = ev.detail?.id;
      if (!id) return;
      setQueue((q) => [...q, { id: id as string, message: ev.detail.message || '' }]);
    }
    window.addEventListener('betechops:confirm-request', onRequest as EventListener);
    return () => window.removeEventListener('betechops:confirm-request', onRequest as EventListener);
  }, []);

  function respond(id: string, ok: boolean) {
    window.dispatchEvent(new CustomEvent('betechops:confirm-response', { detail: { id, ok } }));
    setQueue((q) => q.filter(x => x.id !== id));
  }

  if (!queue.length) return null;
  const top = queue[0];
  return (
    <div style={{ position: 'fixed', left: 0, right: 0, top: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999 }}>
      <div style={{ background: 'rgba(0,0,0,0.4)', position: 'absolute', inset: 0 }} />
      <div style={{ background: 'white', padding: 20, borderRadius: 8, zIndex: 100000, minWidth: 320 }}>
        <div style={{ marginBottom: 12 }}>{top.message}</div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={() => respond(top.id, false)} style={{ padding: '8px 12px' }}>Cancel</button>
          <button onClick={() => respond(top.id, true)} style={{ padding: '8px 12px', background: '#2563eb', color: 'white' }}>OK</button>
        </div>
      </div>
    </div>
  );
}
