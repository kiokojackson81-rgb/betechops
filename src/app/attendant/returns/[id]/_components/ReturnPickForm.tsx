"use client";
import React, { useState } from 'react';
import toast from '@/lib/toast';

async function sha256File(file: File) {
  const buf = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2,'0')).join('');
}

export default function ReturnPickForm({ id, shopId }: { id: string; shopId: string }) {
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);

  async function handleUpload() {
  if (!files.length) return toast('Select files', 'error');
    setBusy(true);
    try {
      for (const f of files) {
        const contentType = f.type || 'application/octet-stream';
          const signRes = await fetch('/api/uploads/sign', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filename: f.name, contentType, shopId }) });
        const sign = await signRes.json();
        if (!signRes.ok) throw new Error(sign.error || 'sign failed');

        // upload to signed URL
        const put = await fetch(sign.url, { method: 'PUT', headers: { 'Content-Type': contentType }, body: f });
        if (!put.ok) throw new Error('upload failed');

        const sha = await sha256File(f);

        // record evidence
          const evRes = await fetch(`/api/returns/${id}/evidence`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'photo', uri: `s3://${sign.key}`, sha256: sha }) });
        const ev = await evRes.json();
        if (!evRes.ok) throw new Error(ev.error || 'evidence save failed');
      }
  toast('Uploaded', 'success');
    } catch (err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  toast(msg, 'error');
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-2">
      <input type="file" multiple onChange={e => setFiles(Array.from(e.target.files || []))} />
      <div>
        <button onClick={handleUpload} disabled={busy} className="px-3 py-1 bg-blue-600 text-white">Upload & Attach</button>
      </div>
    </div>
  );
}
