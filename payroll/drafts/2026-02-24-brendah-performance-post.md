Subject: Performance summary — Brendah (brendah@betech.co.ke)
To: Payroll

Hi Payroll team,

Please publish the performance summary for Brendah (Marketing Ops, Active) for the current period.

Period: 2026-01-25 → 2026-02-24

Summary metrics (authoritative upsert):
- Direct / support total sales: KES 1,550,573
- Direct / support total profit: KES 413,333
- Direct / support total receipts: 79
- Marketing: 102 items reported (no marketing sales commission applied)
- Products commission (copied): 4
- Commission (direct/progressive + products): KES 24,926
  - Direct/progressive portion: KES 24,922
  - Commission total / gross: KES 24,926

Notes:
- Direct commission computed using `computeBrendahDirectCommission` in `src/lib/onlineCommission.ts` (special prorated 1M→2M step plus 5% profit on first band).
- Source for these numbers: authoritative upsert in `scripts/apply-brendah-24926.js` and related upsert output.

Reference files:
- `scripts/apply-brendah-24926.js` — upserts ledger for period with totals and commission.
- `src/lib/onlineCommission.ts` — commission rules (`computeBrendahDirectCommission`).

Actions (choose one):
- Post this summary to Payroll now.
- Send this directly to Brendah.
- Open payroll dashboard for `brendah@betech.co.ke`.
- Disable (deactivate) Brendah.

Please confirm which action to take.

Regards,
Payroll Ops

Adjusted calculation (using SupportReceipt.buying totals):
- Total selling: KES 2,135,468
- Total buying (from SupportReceipt): KES 1,557,626
- Total profit (selling − buying): KES 577,842
- Commission (computeBrendahDirectCommission): KES 31,765
  - Mode: direct_progressive
  - Reason: progressive_brendah + 5% profit (first band KES 6,765)
- 10% share of profit (informational): KES 57,784

Notes:
- Buying totals were sourced from `SupportReceipt.buyingTotal` where present (47 receipts); where absent, receipt/order item fields were used as fallback.
- This adjusted computation supersedes the draft's earlier authoritative upsert for the purpose of payroll allocation; confirm if you want to use these adjusted numbers for posting.
