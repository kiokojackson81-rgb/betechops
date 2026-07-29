import { calculateOperatingCapitalFigures, isOperatingCapitalReadyToFinalize } from "@/lib/operatingCapitalMath";
import type { PricingWeekSummary } from "@/lib/pricingWeekWhatsapp";

function makeSummary(overrides: Partial<PricingWeekSummary> = {}): PricingWeekSummary {
  return {
    week_start: "2026-07-20",
    week_end: "2026-07-26",
    accounts_total: 4,
    accounts_completed: 4,
    accounts_zero: 1,
    missing_pricing: 0,
    total_net_payout: 120000,
    gross_profit: 100000,
    net_profit: 100000,
    returns: 0,
    loss_entries: 0,
    avg_commission_pct: 8,
    priced_entries: 10,
    completed_accounts_list: "A, B, C, D",
    zero_accounts_list: "D",
    reference: "OPS-2026-07-26",
    eligible: true,
    accounts: [
      {
        accountId: "a",
        displayName: "A",
        platform: "JUMIA",
        shopIds: ["s1"],
        markedZero: false,
        hasDraft: true,
        requiredRowCount: 2,
        submittedCount: 2,
        draftComplete: true,
        hasProfitEntries: true,
        missingPricing: 0,
        complete: true,
      },
      {
        accountId: "b",
        displayName: "B",
        platform: "JUMIA",
        shopIds: ["s2"],
        markedZero: false,
        hasDraft: true,
        requiredRowCount: 1,
        submittedCount: 1,
        draftComplete: true,
        hasProfitEntries: true,
        missingPricing: 0,
        complete: true,
      },
      {
        accountId: "c",
        displayName: "C",
        platform: "JUMIA",
        shopIds: ["s3"],
        markedZero: false,
        hasDraft: false,
        requiredRowCount: 0,
        submittedCount: 0,
        draftComplete: false,
        hasProfitEntries: true,
        missingPricing: 0,
        complete: true,
      },
      {
        accountId: "d",
        displayName: "D",
        platform: "JUMIA",
        shopIds: ["s4"],
        markedZero: true,
        hasDraft: true,
        requiredRowCount: 0,
        submittedCount: 0,
        draftComplete: true,
        hasProfitEntries: false,
        missingPricing: 0,
        complete: true,
      },
    ],
    ...overrides,
  };
}

describe("operating capital", () => {
  it("calculates half-profit and adjusted payout using whole KES rounding", () => {
    const figures = calculateOperatingCapitalFigures({ profit: 100000, currentNetPayout: 120000 });
    expect(Number(figures.operatingCapital.toString())).toBe(50000);
    expect(Number(figures.adjustedNetPayout.toString())).toBe(70000);
  });

  it("does not deduct negative operating capital when profit is below zero", () => {
    const figures = calculateOperatingCapitalFigures({ profit: -501, currentNetPayout: 120000 });
    expect(Number(figures.operatingCapital.toString())).toBe(0);
    expect(Number(figures.adjustedNetPayout.toString())).toBe(120000);
  });

  it("requires all week-completion conditions before finalization", () => {
    expect(isOperatingCapitalReadyToFinalize(makeSummary())).toBe(true);
    expect(isOperatingCapitalReadyToFinalize(makeSummary({ missing_pricing: 1 }))).toBe(false);
    expect(
      isOperatingCapitalReadyToFinalize(
        makeSummary({
          accounts_completed: 3,
          accounts: [
            ...makeSummary().accounts.slice(0, 3),
            {
              ...makeSummary().accounts[3],
              markedZero: false,
              hasDraft: false,
              hasProfitEntries: false,
              complete: false,
            },
          ],
        }),
      ),
    ).toBe(false);
  });
});
