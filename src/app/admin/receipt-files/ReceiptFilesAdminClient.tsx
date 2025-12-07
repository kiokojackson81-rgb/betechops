"use client";

import React, { useEffect, useState } from 'react';

export default function ReceiptFilesAdminClient() {
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const res = await fetch('/api/receipt-files');
    const j = await res.json();
    setFiles(j.files || []);
    setLoading(false);
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
      {loading ? <div>Loading...</div> : (
        <table className="w-full border-collapse mt-2">
          <thead><tr><th>Receipt</th><th>URL</th><th>UploadedAt</th><th>ExpiresAt</th><th>Actions</th></tr></thead>
          <tbody>
            {files.map(f => (
              <tr key={f.id} className="border-t">
                <td>{f.receiptId}</td>
                <td><a href={f.url} target="_blank" rel="noreferrer">link</a></td>
                <td>{new Date(f.uploadedAt).toLocaleString()}</td>
                <td>{f.expiresAt ? new Date(f.expiresAt).toLocaleString() : ''}</td>
                <td><button className="text-red-600" onClick={() => remove(f.id)}>Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
