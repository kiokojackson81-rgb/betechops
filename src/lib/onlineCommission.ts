type Money = number;

const STEP_POINTS = [
  2_000_000,
  3_000_000,
  4_000_000,
  5_000_000,
  6_000_000,
  7_000_000,
  8_000_000,
  9_000_000,
  10_000_000,
];
const STEP_REWARDS = [15_000, 20_000, 20_000, 20_000, 20_000, 20_000, 20_000, 20_000, 20_000];

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export type Channel = "DIRECT" | "MARKETPLACE";

export interface CommissionResult {
  amount: Money;
  mode: "direct_fallback" | "direct_progressive" | "marketplace_progressive" | "withheld" | "none";
  reason?: string;
}

export interface CommissionInput {
  channel: Channel;
  totalSales: Money;
  totalProfit?: Money;
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

export interface PeriodInputs {
  attendantId: string;
  periodStart: Date;
  periodEnd: Date;
  directSales: Money;
  directProfit: Money;
  jumiaSales: Money;
  kilimallSales: Money;
  abandonedDuties?: boolean;
  grossMisconduct?: boolean;
  resignedOrTerminated?: boolean;
}

export interface PeriodCommissionResult {
  lines: ChannelLine[];
  totalCommission: Money;
}

export function progressiveAmount(totalSales: Money): Money {
  // Band 500k-1M produces up to KES 10k (prorated).
  if (totalSales <= 1_000_000) {
    const progress = (totalSales - 500_000) / 500_000;
    return Math.round(clamp01(progress) * 10_000);
  }

  let commission = 10_000;

  // Steps 2M..10M pay out the flat amount only once the threshold is reached.
  for (let i = 0; i < STEP_POINTS.length; i += 1) {
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

export function computeDirectCommission(totalSales: Money, totalProfit: Money): CommissionResult {
  if (totalSales <= 0) {
    return { amount: 0, mode: "none" };
  }
  if (totalSales < 500_000) {
    const profit = Math.max(totalProfit ?? 0, 0);
    const amount = Math.round(profit * 0.05);
    return { amount, mode: amount > 0 ? "direct_fallback" : "none" };
  }
  const progressive = progressiveAmount(totalSales);
  // Apply 5% of profit only for the portion of sales within the first band
  // (up to KES 500,000). This ensures we don't double-count 5% on the
  // full profit when progressive payouts apply.
  const profitWithinFirstBand = totalSales > 0 ? (Math.min(totalSales, 500_000) / totalSales) * Math.max(totalProfit ?? 0, 0) : 0;
  const profitPart = Math.round(profitWithinFirstBand * 0.05);
  const amount = progressive + profitPart;
  const reason = profitPart > 0 ? `progressive + 5% profit (first band ${profitPart})` : undefined;
  return { amount, mode: "direct_progressive", reason };
}

export function computeMarketplaceCommission(
  totalSales: Money,
  flags?: {
    abandonedDuties?: boolean;
    grossMisconduct?: boolean;
    resignedOrTerminated?: boolean;
  },
): CommissionResult {
  if (flags?.abandonedDuties || flags?.grossMisconduct || flags?.resignedOrTerminated) {
    return { amount: 0, mode: "withheld", reason: "Withheld per memo policy." };
  }
  if (totalSales < 500_000) {
    return { amount: 0, mode: "none" };
  }
  return { amount: progressiveAmount(totalSales), mode: "marketplace_progressive" };
}

export function computeOnlinePeriodCommission(inputs: PeriodInputs): PeriodCommissionResult {
  const direct = computeDirectCommission(inputs.directSales, inputs.directProfit);
  const jumia = computeMarketplaceCommission(inputs.jumiaSales, {
    abandonedDuties: inputs.abandonedDuties,
    grossMisconduct: inputs.grossMisconduct,
    resignedOrTerminated: inputs.resignedOrTerminated,
  });
  const kilimall = computeMarketplaceCommission(inputs.kilimallSales, {
    abandonedDuties: inputs.abandonedDuties,
    grossMisconduct: inputs.grossMisconduct,
    resignedOrTerminated: inputs.resignedOrTerminated,
  });

  const lines: ChannelLine[] = [
    {
      channel: "DIRECT",
      sales: inputs.directSales,
      profit: inputs.directProfit,
      commission: direct.amount,
      mode: direct.mode,
      reason: direct.reason,
    },
    {
      channel: "JUMIA",
      sales: inputs.jumiaSales,
      commission: jumia.amount,
      mode: jumia.mode,
      reason: jumia.reason,
    },
    {
      channel: "KILIMALL",
      sales: inputs.kilimallSales,
      commission: kilimall.amount,
      mode: kilimall.mode,
      reason: kilimall.reason,
    },
  ];

  const totalCommission = Math.round(lines.reduce((acc, line) => acc + (line.commission || 0), 0));
  return { lines, totalCommission };
}
