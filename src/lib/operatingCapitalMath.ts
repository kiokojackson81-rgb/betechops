import { Prisma } from "@prisma/client";
import type { PricingWeekSummary } from "@/lib/pricingWeekWhatsapp";

const MONEY_ROUNDING = Prisma.Decimal.ROUND_HALF_UP;

function decimal(value: Prisma.Decimal | number | string | null | undefined) {
  return new Prisma.Decimal(String(value ?? 0));
}

function roundKes(value: Prisma.Decimal | number | string | null | undefined) {
  return decimal(value).toDecimalPlaces(0, MONEY_ROUNDING);
}

export function buildOperatingCapitalCompletionSnapshot(summary: PricingWeekSummary) {
  const totalAccounts = Number(summary.accounts_total ?? 0);
  const accountsSubmitted = Number(summary.accounts_completed ?? 0);
  const missingPricing = Number(summary.missing_pricing ?? 0);
  const accountsNotSubmitted = Math.max(0, totalAccounts - accountsSubmitted);
  const accountsNotLoaded = summary.accounts.filter((account) => !account.markedZero && !account.hasDraft && !account.hasProfitEntries).length;
  const accountsMarkedZero = Number(summary.accounts_zero ?? 0);

  return {
    accountsSubmitted,
    totalAccounts,
    accountsNotSubmitted,
    accountsNotLoaded,
    missingPricing,
    accountsMarkedZero,
  };
}

export function isOperatingCapitalReadyToFinalize(summary: PricingWeekSummary) {
  const completion = buildOperatingCapitalCompletionSnapshot(summary);
  return (
    completion.totalAccounts > 0 &&
    completion.accountsSubmitted === completion.totalAccounts &&
    completion.accountsNotSubmitted === 0 &&
    completion.accountsNotLoaded === 0 &&
    completion.missingPricing === 0
  );
}

export function calculateOperatingCapitalFigures(input: { profit: number; currentNetPayout: number }) {
  const profit = roundKes(input.profit);
  const currentNetPayout = roundKes(input.currentNetPayout);
  const operatingCapital = profit.greaterThan(0)
    ? profit.div(2).toDecimalPlaces(0, MONEY_ROUNDING)
    : new Prisma.Decimal(0);
  const adjustedNetPayout = currentNetPayout.minus(operatingCapital).toDecimalPlaces(0, MONEY_ROUNDING);

  return {
    profit,
    currentNetPayout,
    operatingCapital,
    adjustedNetPayout,
  };
}
