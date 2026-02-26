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
  mode:
    | "direct_fallback"
    | "direct_progressive"
    | "direct_profit_share"
    | "marketplace_progressive"
    | "withheld"
    | "none";
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

function splitMarketplaceCommission(jumiaSales: Money, kilimallSales: Money, totalCommission: Money) {
  const totalSales = Math.max(0, jumiaSales) + Math.max(0, kilimallSales);
  if (totalCommission <= 0 || totalSales <= 0) {
    return { jumiaCommission: 0, kilimallCommission: 0 };
  }
  if (jumiaSales <= 0) {
    return { jumiaCommission: 0, kilimallCommission: Math.round(totalCommission) };
  }
  if (kilimallSales <= 0) {
    return { jumiaCommission: Math.round(totalCommission), kilimallCommission: 0 };
  }

  const jumiaCommission = Math.round((Math.max(0, jumiaSales) / totalSales) * totalCommission);
  return {
    jumiaCommission,
    kilimallCommission: Math.round(totalCommission) - jumiaCommission,
  };
}

export type DirectCommissionMode = "DEFAULT" | "BRENDAH" | "PROFIT_10";
export type OnlinePosOwnershipMode = "issuerOnly" | "staffOnly" | "staffDisplay";

export function resolveDirectCommissionMode(email?: string | null): DirectCommissionMode {
  const normalized = (email ?? "").toLowerCase().trim();
  if (normalized === "brendah@betech.co.ke") return "BRENDAH";
  if (normalized === "stephen@betech.co.ke" || normalized === "benjamin@betech.co.ke") return "PROFIT_10";
  return "DEFAULT";
}

export function resolveOnlinePosOwnershipMode(email?: string | null): OnlinePosOwnershipMode {
  return resolveDirectCommissionMode(email) === "PROFIT_10" ? "staffDisplay" : "issuerOnly";
}

export function progressiveAmount(totalSales: Money): Money {
  if (totalSales <= 1_000_000) {
    const progress = (totalSales - 500_000) / 500_000;
    return Math.round(clamp01(progress) * 10_000);
  }

  let commission = 10_000;
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
  const profitWithinFirstBand =
    totalSales > 0 ? (Math.min(totalSales, 500_000) / totalSales) * Math.max(totalProfit ?? 0, 0) : 0;
  const profitPart = Math.round(profitWithinFirstBand * 0.05);
  const amount = progressive + profitPart;
  const reason = profitPart > 0 ? `progressive + 5% profit (first band ${profitPart})` : undefined;
  return { amount, mode: "direct_progressive", reason };
}

export function computeBrendahDirectCommission(totalSales: Money, totalProfit: Money): CommissionResult {
  if (totalSales <= 0) return { amount: 0, mode: "none" };
  if (totalSales < 500_000) {
    const profit = Math.max(totalProfit ?? 0, 0);
    const amount = Math.round(profit * 0.05);
    return { amount, mode: amount > 0 ? "direct_fallback" : "none" };
  }

  let commission = 0;
  if (totalSales <= 1_000_000) {
    const progress = (totalSales - 500_000) / 500_000;
    commission = Math.round(clamp01(progress) * 10_000);
  } else {
    commission = 10_000;
    if (totalSales < 2_000_000) {
      const frac = (totalSales - 1_000_000) / 1_000_000;
      const prorated = Math.round(clamp01(frac) * STEP_REWARDS[0]);
      commission += prorated;
    } else {
      commission += STEP_REWARDS[0];
      for (let i = 1; i < STEP_POINTS.length; i += 1) {
        const point = STEP_POINTS[i];
        const reward = STEP_REWARDS[i];
        if (totalSales >= point) commission += reward;
        else break;
      }
    }
  }

  const profitWithinFirstBand =
    totalSales > 0 ? (Math.min(totalSales, 500_000) / totalSales) * Math.max(totalProfit ?? 0, 0) : 0;
  const profitPart = Math.round(profitWithinFirstBand * 0.05);
  const amount = commission + profitPart;
  const reason = profitPart > 0 ? `progressive_brendah + 5% profit (first band ${profitPart})` : undefined;
  return { amount, mode: "direct_progressive", reason };
}

export function computeDirectProfitShareCommission(
  totalSales: Money,
  totalProfit: Money,
  percent: number,
): CommissionResult {
  if (totalSales <= 0) return { amount: 0, mode: "none" };
  const profit = Math.max(totalProfit ?? 0, 0);
  const amount = Math.round(profit * percent);
  return {
    amount,
    mode: amount > 0 ? "direct_profit_share" : "none",
    reason: `${Math.round(percent * 100)}% profit share`,
  };
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

export function computeOnlinePeriodCommission(
  inputs: PeriodInputs,
  options?: { directCommissionMode?: DirectCommissionMode },
): PeriodCommissionResult {
  const directCommissionMode = options?.directCommissionMode ?? "DEFAULT";
  const direct =
    directCommissionMode === "BRENDAH"
      ? computeBrendahDirectCommission(inputs.directSales, inputs.directProfit)
      : directCommissionMode === "PROFIT_10"
        ? computeDirectProfitShareCommission(inputs.directSales, inputs.directProfit, 0.1)
        : computeDirectCommission(inputs.directSales, inputs.directProfit);
  const sharedFlags = {
    abandonedDuties: inputs.abandonedDuties,
    grossMisconduct: inputs.grossMisconduct,
    resignedOrTerminated: inputs.resignedOrTerminated,
  };

  const combinedMarketplaceMode = directCommissionMode === "PROFIT_10";
  const combinedMarketplaceSales = Math.max(0, inputs.jumiaSales) + Math.max(0, inputs.kilimallSales);
  const combinedMarketplace = combinedMarketplaceMode
    ? computeMarketplaceCommission(combinedMarketplaceSales, sharedFlags)
    : null;
  const combinedSplit = combinedMarketplace
    ? splitMarketplaceCommission(inputs.jumiaSales, inputs.kilimallSales, combinedMarketplace.amount)
    : null;

  const jumia = combinedMarketplaceMode
    ? {
        amount: combinedSplit?.jumiaCommission ?? 0,
        mode: combinedMarketplace?.mode ?? "none",
        reason: combinedMarketplace?.amount
          ? `Combined marketplace ladder on ${Math.round(combinedMarketplaceSales).toLocaleString("en-KE")} sales`
          : combinedMarketplace?.reason,
      }
    : computeMarketplaceCommission(inputs.jumiaSales, sharedFlags);
  const kilimall = combinedMarketplaceMode
    ? {
        amount: combinedSplit?.kilimallCommission ?? 0,
        mode: combinedMarketplace?.mode ?? "none",
        reason: combinedMarketplace?.amount
          ? `Combined marketplace ladder on ${Math.round(combinedMarketplaceSales).toLocaleString("en-KE")} sales`
          : combinedMarketplace?.reason,
      }
    : computeMarketplaceCommission(inputs.kilimallSales, sharedFlags);

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
