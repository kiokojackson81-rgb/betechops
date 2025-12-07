import React from 'react';
import ReceiptsAdminClient from './ReceiptsAdminClient';

export const dynamic = 'force-dynamic';

export default async function AdminReceiptsPage() {
  const base = process.env.NEXT_PUBLIC_BASE_URL || '';
  try {
    const res = await fetch(`${base}/api/receipts/list?includeItems=true`, { cache: 'no-store' });
    const j = await res.json();
    const receipts = j.receipts || [];
    return (
      <div className="p-4 max-w-5xl mx-auto">
        <h1 className="text-2xl font-semibold mb-4">Admin — Receipts</h1>
        <ReceiptsAdminClient initial={receipts} />
      </div>
    );
  } catch (e) {
    console.error('Failed to load receipts for admin page', e);
    return (<div className="p-4">Failed to load receipts</div>);
  }
}
