This is our comission structure : Online Attendant Commission — Final Copilot Instructions (Copy-Paste Ready)

This is the source of truth for Online attendants’ commission. It defines two independent engines (Direct vs Marketplace), how to sum them for payroll, and how to display them on the front-end. Include exactly as written.

Policy Summary

Scope: Applies to Online attendants only.

Two commission paths (computed separately, then added):

Direct sales (receipts submitted via /receipts)

If sales < 500,000 KES: commission = 5% of profit, rounded, but never negative.

If sales ≥ 500,000 KES: use the progressive/prorated ladder described below.

Marketplace (Jumia + Kilimall)

Use the FY 2025/2026 ladder with no profit fallback.

Discretionary and may be withheld for: abandonment of duties, gross misconduct, resignation/termination (flags block payout).

Ladder (shared progressive logic for both paths when applicable):

500k-1M band → KES 10,000 (pro-rated within this band).

2M → KES 15,000 (step).

3M → KES 20,000 (step).

4M-10M → KES 20,000 each (steps).

Cumulative: add full rewards only when the corresponding step threshold is reached; the only prorated window is the first band (500k-1M), so sales between 1M and the next step do not earn additional commission until the next tier is hit.

Max cumulative around KES 185,000 at 10M+.

Payout rule: For each period/person, compute Direct and Marketplace separately, then commission_total = direct + marketplace.
Never add ladder + fallback for the same channel simultaneously.

Rounding: Math.round to nearest KES on each channel result and on the final total.

Zero sales: commission = 0 (unless Direct has profit fallback and sales <500k).

Negative profit: treated as 0 for fallback.

Overrides: These rules override any prior online rules for attendants.

Data Contract
type Money = number;           // integer KES (round all outputs)
type Channel = "DIRECT" | "MARKETPLACE";

export interface CommissionInput {
  channel: Channel;
  totalSales: Money;
  totalProfit?: Money;         // required for DIRECT (fallback); ignored for MARKETPLACE
  abandonedDuties?: boolean;   // MARKETPLACE withholding flags
  grossMisconduct?: boolean;
  resignedOrTerminated?: boolean;
}

export interface CommissionResult {
  amount: Money;               // rounded
  mode: "direct_fallback" | "direct_progressive" | "marketplace_progressive" | "withheld" | "none";
  reason?: string;             // e.g. "Withheld per memo policy."
}

export interface PeriodInputs {
  attendantId: string;
  periodStart: Date;
  periodEnd: Date;

  // DIRECT
  directSales: Money;
  directProfit: Money;

  // MARKETPLACE breakdown
  jumiaSales: Money;
  kilimallSales: Money;

  // memo policy flags (apply to marketplace)
  abandonedDuties?: boolean;
  grossMisconduct?: boolean;
  resignedOrTerminated?: boolean;
}

export interface ChannelLine {
  channel: "DIRECT" | "JUMIA" | "KILIMALL";
  sales: Money;
  profit?: Money;
  commission: Money;
  mode: CommissionResult["mode"];
  reason?: string;
}

export interface PeriodCommissionResult {
  lines: ChannelLine[];
  totalCommission: Money;      // sum of lines (rounded)
}

Engine (Drop-in Code)
// utils/commission.ts
type Money = number;

const STEP_POINTS = [2_000_000, 3_000_000, 4_000_000, 5_000_000, 6_000_000, 7_000_000, 8_000_000, 9_000_000, 10_000_000];
const STEP_REWARDS = [15_000,   20_000,   20_000,   20_000,   20_000,   20_000,   20_000,   20_000,   20_000];

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/** Shared progressive ladder: prorate 500k-1M band only, then add full steps for subsequent tiers. */
export function progressiveAmount(totalSales: Money): Money {
  // Band 500k-1M → 10k prorated
  if (totalSales <= 1_000_000) {
    const progress = (totalSales - 500_000) / 500_000;
    return Math.round(clamp01(progress) * 10_000);
  }

  let commission = 10_000;

  // Steps 2M..10M pay only when the threshold is hit.
  for (let i = 0; i < STEP_POINTS.length; i++) {
    const point = STEP_POINTS[i];
    const reward = STEP_REWARDS[i];
    if (totalSales >= point) {
      commission += reward;
      continue;
    }
    break;
  }

  return Math.round(commission);
}

/** DIRECT: 5% of profit below 500k; progressive ≥ 500k. */
export function computeDirectCommission(totalSales: Money, totalProfit: Money): CommissionResult {
  if (totalSales <= 0) return { amount: 0, mode: "none" };

  if (totalSales < 500_000) {
    const profit = Math.max(totalProfit || 0, 0);
    const amt = Math.round(profit * 0.05);
    return { amount: amt, mode: amt > 0 ? "direct_fallback" : "none" };
  }

  return { amount: progressiveAmount(totalSales), mode: "direct_progressive" };
}

/** MARKETPLACE: Memo ladder only; discretionary withholding. No profit fallback. */
export function computeMarketplaceCommission(totalSales: Money, flags?: {
  abandonedDuties?: boolean;
  grossMisconduct?: boolean;
  resignedOrTerminated?: boolean;
}): CommissionResult {
  if (flags?.abandonedDuties || flags?.grossMisconduct || flags?.resignedOrTerminated) {
    return { amount: 0, mode: "withheld", reason: "Withheld per memo policy." };
  }
  if (totalSales < 500_000) return { amount: 0, mode: "none" };
  return { amount: progressiveAmount(totalSales), mode: "marketplace_progressive" };
}

/** Period aggregator: compute lines & sum for payroll. */
export function computeOnlinePeriodCommission(i: PeriodInputs): PeriodCommissionResult {
  const direct = computeDirectCommission(i.directSales, i.directProfit);
  const jumia = computeMarketplaceCommission(i.jumiaSales, {
    abandonedDuties: i.abandonedDuties,
    grossMisconduct: i.grossMisconduct,
    resignedOrTerminated: i.resignedOrTerminated,
  });
  const kilimall = computeMarketplaceCommission(i.kilimallSales, {
    abandonedDuties: i.abandonedDuties,
    grossMisconduct: i.grossMisconduct,
    resignedOrTerminated: i.resignedOrTerminated,
  });

  const lines: ChannelLine[] = [
    { channel: "DIRECT", sales: i.directSales, profit: i.directProfit, commission: direct.amount, mode: direct.mode, reason: direct.reason },
    { channel: "JUMIA", sales: i.jumiaSales, commission: jumia.amount, mode: jumia.mode, reason: jumia.reason },
    { channel: "KILIMALL", sales: i.kilimallSales, commission: kilimall.amount, mode: kilimall.mode, reason: kilimall.reason },
  ];

  const totalCommission = Math.round(lines.reduce((s, r) => s + (r.commission || 0), 0));

  return { lines, totalCommission };
}

Persistence (Payroll)

Add/ensure period columns:

commission_direct (KES)

commission_marketplace_jumia (KES)

commission_marketplace_kilimall (KES)

commission_total (KES) = sum of above

commission_breakdown (JSON) — store lines for audit

On period close (or manual recompute):

call computeOnlinePeriodCommission(inputs),

write each channel figure and the sum to the payroll record.

Front-End Bindings

Quick stats / Commission card: show commission_total (not sales).
(Your screenshot mapping commission = totalSales is a bug — fix binding.)

Earnings this period → COMMISSION: use commission_total from payroll.

Progress bar “to next tier”:

For Marketplace panels, base on Jumia + Kilimall sales only.

Next target logic:

If < 500k: show “KES (500k − sales) to enter ladder”.

If 500k–1M: show remaining proportion of 10k band.

If ≥ 1M: find next million step in STEP_POINTS and show remaining amount.

Tooltips:

DIRECT: “5% of profit below 500k; progressive ladder from 500k upwards.”

MARKETPLACE: “Memo ladder only; discretionary and may be withheld.”

Examples (Sanity Matrix)
Channel	Sales	Profit	Result (KES)	Notes
DIRECT	80,000	10,000	500	5% fallback
DIRECT	300,000	40,000	2,000	5% fallback
DIRECT	300,000	-5,000	0
DIRECT	750,000	—	5,000	10k × (250k/500k)
DIRECT	1,000,000	—	10,000	Full 500k–1M band
DIRECT	3,200,000	—	49,000	10k + 15k + 20k + (0.2×20k)
MARKETPLACE	400,000	—	0	No fallback
MARKETPLACE	1,099,089	—	≈11,486	10k + ~1,486 prorated toward 2M
MARKETPLACE	2,000,000	—	25,000	10k + 15k
MARKETPLACE	3,200,000	—	49,000	Same progressive math
MARKETPLACE*	1,000,000	—	0	*Withheld flag true → 0

Period total = sum of channel results.
Example: Jumia 1,099,089 (≈11,486) + Direct 0 → ≈11,486 commission_total.

Jest Tests (Minimal)
// utils/commission.test.ts
import { computeDirectCommission, computeMarketplaceCommission, progressiveAmount, computeOnlinePeriodCommission } from "./commission";

test("direct fallback 5%", () => {
  expect(computeDirectCommission(80_000, 10_000).amount).toBe(500);
  expect(computeDirectCommission(300_000, 40_000).amount).toBe(2000);
  expect(computeDirectCommission(300_000, -5_000).amount).toBe(0);
});

test("direct progressive band", () => {
  expect(computeDirectCommission(750_000, 0).amount).toBe(5000);
  expect(computeDirectCommission(1_000_000, 0).amount).toBe(10000);
});

test("marketplace progressive no fallback", () => {
  expect(computeMarketplaceCommission(400_000).amount).toBe(0);
  expect(computeMarketplaceCommission(1_000_000).amount).toBe(10000);
  expect(computeMarketplaceCommission(2_000_000).amount).toBe(25000);
});

test("progressiveAmount 3.2M", () => {
  expect(progressiveAmount(3_200_000)).toBe(45_000);
});

test("withheld marketplace", () => {
  const r = computeMarketplaceCommission(1_000_000, { grossMisconduct: true });
  expect(r.amount).toBe(0);
  expect(r.mode).toBe("withheld");
});

test("period aggregator sums channels", () => {
  const res = computeOnlinePeriodCommission({
    attendantId: "x",
    periodStart: new Date(),
    periodEnd: new Date(),
    directSales: 300_000,
    directProfit: 40_000,      // 2,000
    jumiaSales: 1_099_089,     // ≈ 11,486
    kilimallSales: 0,
  });
  expect(res.totalCommission).toBe(12_000);
});

Integration Checklist

 Wire computeOnlinePeriodCommission into period close job or “Save payroll” action.

 Persist commission_direct, commission_marketplace_jumia, commission_marketplace_kilimall, commission_total, and commission_breakdown.

 Front-end cards read only commission_total for “Commission”.

 Fix binding that currently shows totalSales as “Commission”.

 Add UI note in Marketplace tab: “Memo ladder only; discretionary & may be withheld.”

 Ensure negative/NaN inputs are sanitized to 0 before compute.

One-Line Summary for Engineers

Online attendants’ commission = Direct (5% profit <500k; progressive ≥500k) + Marketplace (memo ladder only; prorated 500k–1M, fixed bonuses each million; discretionary withholding). Save both parts and the sum to payroll, and display the sum on the front-end. for online attendnands 

