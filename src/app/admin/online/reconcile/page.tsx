import React from 'react';
import { reconcileWeeks } from '@/lib/jobs/onlineReconcile';

export default async function Page() {
  const data = await reconcileWeeks(8);
  return (
    <div style={{ padding: 20 }}>
      <h1>Online Reconciliation (last 8 weeks)</h1>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th>Week</th>
            <th>Payout Rows</th>
            <th>Gross</th>
            <th>WeeklySale sum</th>
            <th>Duplicates</th>
            <th>Missing SIDs</th>
          </tr>
        </thead>
        <tbody>
          {data.map((r) => (
            <tr key={r.weekStart}>
              <td>{r.weekStart} → {r.weekEnd}</td>
              <td>{r.payoutRows}</td>
              <td>{r.totalGross.toFixed(2)}</td>
              <td>{r.weeklySum.toFixed(2)}</td>
              <td>{r.duplicates}</td>
              <td>{r.missingSids}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
