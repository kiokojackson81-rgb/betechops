"use client";

import React, { useEffect, useState } from 'react';

export default function ReceiptFilesAdminClient() {
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showOnlyPod, setShowOnlyPod] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/receipt-files');
      const j = await res.json();
      setFiles(j.files || []);
    } catch (err) {
      console.error('failed to load receipt files', err);
      setFiles([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const remove = async (id: string) => {
    if (!confirm('Delete this receipt file?')) return;
    const res = await fetch(`/api/receipt-files/${id}`, { method: 'DELETE' });
    const j = await res.json();
    if (j.ok) load(); else alert(j.error || 'Failed');
  };

  return (
    <div>
      <h2 className="text-lg font-semibold">Receipt Files</h2>
      <div className="mt-2 mb-2 flex items-center gap-3">
        <label className="text-sm">Show only POD receipts</label>
        <input type="checkbox" checked={showOnlyPod} onChange={(e) => setShowOnlyPod(e.target.checked)} />
        <button className="ml-4 text-sm text-sky-600" onClick={() => load()}>Refresh</button>
      </div>
      {loading ? <div>Loading...</div> : (
        <table className="w-full border-collapse mt-2">
          <thead><tr><th>Receipt</th><th>URL</th><th>UploadedAt</th><th>ExpiresAt</th><th>Actions</th></tr></thead>
          <tbody>
            {files
              .filter((f) => !showOnlyPod || Boolean(f.podDelivery))
              .map((f) => (
              <React.Fragment key={f.id}>
                <tr className="border-t">
                  <td>
                    <div>{f.receiptId}</div>
                    <div className="text-[11px] text-slate-400">{f.receiptDocType ?? ''}</div>
                    {f.podDelivery ? <div className="text-[11px] text-amber-300">POD: {String(f.podDelivery.status ?? '')}</div> : null}
                  </td>
                  <td><a href={f.url} target="_blank" rel="noreferrer">link</a></td>
                  <td>{new Date(f.uploadedAt).toLocaleString()}</td>
                  <td>{f.expiresAt ? new Date(f.expiresAt).toLocaleString() : ''}</td>
                  <td className="flex items-center gap-2">
                    <button className="text-red-600" onClick={() => remove(f.id)}>Delete</button>
                    <button className="text-sm text-slate-600" onClick={() => setExpanded(prev => ({ ...prev, [f.id]: !prev[f.id] }))}>{expanded[f.id] ? 'Hide' : 'Details'}</button>
                  </td>
                </tr>
                {expanded[f.id] ? (
                  <tr>
                    <td colSpan={5} className="bg-slate-50 p-2">
                      <pre className="text-xs max-h-48 overflow-auto">{JSON.stringify(f, null, 2)}</pre>
                    </td>
                  </tr>
                ) : null}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
