import React from 'react';

export const dynamic = 'force-dynamic';

export default async function ReceiptsPage() {
  const base = process.env.NEXT_PUBLIC_BASE_URL || '';
  const url = `${base}/api/receipts/list`;
  const res = await fetch(url, { cache: 'no-store' });
  let data: any = { receipts: [] };
  try {
    data = await res.json();
  } catch {}

  return (
    <div>
      <h1>Receipts</h1>
      <p>This page lists receipts (basic server-side view).</p>
      <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(data.receipts || [], null, 2)}</pre>
    </div>
  );
}
