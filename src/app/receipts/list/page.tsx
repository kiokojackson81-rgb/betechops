import React from 'react';
import { prisma } from '@/lib/prisma';
import ReceiptsAdminClient from './ReceiptsAdminClient';

export const dynamic = 'force-dynamic';

export default async function ReceiptsListPage() {
  // server-side fetch initial receipts
  const base = process.env.NEXT_PUBLIC_BASE_URL || '';
  try {
    const res = await fetch(`${base}/api/receipts/list?includeItems=true`, { cache: 'no-store' });
    const j = await res.json();
    const receipts = j.receipts || [];
    return (
      <div className="p-4">
        <h1 className="text-2xl font-semibold mb-4">Receipts (Admin)</h1>
        <ReceiptsAdminClient initial={receipts} />
      </div>
    );
  } catch (e) {
    return (<div className="p-4">Failed to load receipts</div>);
  }
}
