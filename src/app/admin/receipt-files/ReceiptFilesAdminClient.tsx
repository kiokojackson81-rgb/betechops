"use client";

import React, { useCallback, useEffect, useState } from 'react';

export default function ReceiptFilesAdminClient() {
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showOnlyPod, setShowOnlyPod] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const url = showOnlyPod ? '/api/receipt-files?podOnly=1' : '/api/receipt-files';
      const res = await fetch(url, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      setFiles(Array.isArray(data.files) ? data.files : []);
    } catch (err) {
      console.error('failed to load receipt files', err);
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, [showOnlyPod]);

  useEffect(() => {
    void load();
  }, [load]);

  const remove = async (id: string) => {
    if (!confirm('Delete this receipt file?')) return;
    const res = await fetch(`/api/receipt-files/${id}`, { method: 'DELETE' });
    const j = await res.json().catch(() => ({}));
    if (j.ok) {
      void load();
    } else {
      alert(j.error || 'Failed');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Receipt Files</h2>
        <button
          onClick={() => load()}
          disabled={loading}
          className="text-sm text-sky-600 transition hover:text-sky-400 disabled:text-slate-500"
        >
          Refresh
        </button>
      </div>
      <div className="mt-2 mb-3 flex items-center gap-2">
        <label className="text-sm">Show only POD receipts</label>
        <input
          type="checkbox"
          checked={showOnlyPod}
          onChange={(e) => setShowOnlyPod(e.target.checked)}
          className="h-4 w-4 rounded accent-emerald-500"
        />
      </div>
      {loading ? (
        <div>Loading...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-slate-400">
                <th className="py-2 pr-4">Receipt</th>
                <th className="py-2 pr-4">Link</th>
                <th className="py-2 pr-4">Uploaded At</th>
                <th className="py-2 pr-4">Expires At</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {files.map((f) => (
                <React.Fragment key={f.id}>
                  <tr className="border-t border-white/5 bg-slate-950/40">
                    <td className="py-3 align-top">
                      <div className="font-semibold text-slate-100">{f.receiptId}</div>
                      <div className="text-[11px] text-slate-400">
                        Type: {f.receiptDocType ?? 'unknown'}
                      </div>
                      {f.podDelivery ? (
                        <div className="text-[11px] text-amber-300">
                          POD: {String(f.podDelivery.status ?? 'pending')}
                        </div>
                      ) : (
                        <div className="text-[11px] text-slate-500">Not marked POD</div>
                      )}
                    </td>
                    <td className="py-3">
                      <a
                        className="text-emerald-400 underline-offset-2 hover:underline"
                        href={f.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        link
                      </a>
                    </td>
                    <td className="py-3">
                      {f.uploadedAt ? new Date(f.uploadedAt).toLocaleString() : '—'}
                    </td>
                    <td className="py-3">
                      {f.expiresAt ? new Date(f.expiresAt).toLocaleString() : '—'}
                    </td>
                    <td className="py-3">
                      <div className="flex flex-wrap gap-2">
                        <button className="text-red-600" onClick={() => remove(f.id)}>
                          Delete
                        </button>
                        <button
                          className="text-slate-300"
                          onClick={() =>
                            setExpanded((prev) => ({ ...prev, [f.id]: !prev[f.id] }))
                          }
                        >
                          {expanded[f.id] ? 'Hide' : 'Details'}
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expanded[f.id] && (
                    <tr>
                      <td colSpan={5} className="bg-slate-900/80 px-3 py-2">
                        <pre className="text-[11px] text-slate-200">
                          {JSON.stringify(
                            {
                              ...f,
                              receipt: f.receipt ? { ...f.receipt, data: f.receipt.data ?? null } : null,
                            },
                            null,
                            2,
                          )}
                        </pre>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
