import {
  computeBrendahDirectCommission,
  computeDirectCommission,
  computeMarketplaceCommission,
  computeOnlinePeriodCommission,
  progressiveAmount,
  resolveOnlinePosOwnershipMode,
} from "@/lib/onlineCommission";

describe("onlineCommission helpers", () => {
  test("direct fallback 5%", () => {
    expect(computeDirectCommission(80_000, 10_000).amount).toBe(500);
    expect(computeDirectCommission(300_000, 40_000).amount).toBe(2_000);
    expect(computeDirectCommission(300_000, -5_000).amount).toBe(0);
  });

  test("direct progressive band", () => {
    expect(computeDirectCommission(750_000, 0).amount).toBe(5_000);
    expect(computeDirectCommission(1_000_000, 0).amount).toBe(10_000);
  });

  test("brendah proration continues across every band", () => {
    expect(computeBrendahDirectCommission(1_000_000, 0).amount).toBe(10_000);
    expect(computeBrendahDirectCommission(1_500_000, 0).amount).toBe(17_500);
    expect(computeBrendahDirectCommission(2_000_000, 0).amount).toBe(25_000);
    expect(computeBrendahDirectCommission(2_700_000, 0).amount).toBe(39_000);
    expect(computeBrendahDirectCommission(3_500_000, 0).amount).toBe(55_000);
  });

  test("progressiveAmount 3.2M", () => {
    expect(progressiveAmount(3_200_000)).toBe(45_000);
  });

  test("marketplace progressive no fallback", () => {
    expect(computeMarketplaceCommission(400_000).amount).toBe(0);
    expect(computeMarketplaceCommission(1_000_000).amount).toBe(10_000);
    expect(computeMarketplaceCommission(2_000_000).amount).toBe(25_000);
  });

  test("online POS ownership is issuer-only for Stephen and Benjamin", () => {
    expect(resolveOnlinePosOwnershipMode("stephen@betech.co.ke")).toBe("issuerOnly");
    expect(resolveOnlinePosOwnershipMode("benjamin@betech.co.ke")).toBe("issuerOnly");
  });

  test("withheld marketplace", () => {
    const result = computeMarketplaceCommission(1_000_000, { grossMisconduct: true });
    expect(result.amount).toBe(0);
    expect(result.mode).toBe("withheld");
  });

  test("period aggregator sums channels", () => {
    const result = computeOnlinePeriodCommission({
      attendantId: "x",
      periodStart: new Date(),
      periodEnd: new Date(),
      directSales: 300_000,
      directProfit: 40_000,
      jumiaSales: 1_099_089,
      kilimallSales: 0,
    });

    expect(result.totalCommission).toBe(12_000);
  });

  test("period aggregator supports Brendah direct mode", () => {
    const result = computeOnlinePeriodCommission(
      {
        attendantId: "brendah",
        periodStart: new Date(),
        periodEnd: new Date(),
        directSales: 1_500_000,
        directProfit: 0,
        jumiaSales: 0,
        kilimallSales: 0,
      },
      { directCommissionMode: "BRENDAH" },
    );

    expect(result.totalCommission).toBe(17_500);
    expect(result.lines.find((l) => l.channel === "DIRECT")?.commission).toBe(17_500);
  });

  test("period aggregator uses continuous Brendah progress", () => {
    const result = computeOnlinePeriodCommission(
      {
        attendantId: "brendah",
        periodStart: new Date(),
        periodEnd: new Date(),
        directSales: 2_700_000,
        directProfit: 0,
        jumiaSales: 0,
        kilimallSales: 0,
      },
      { directCommissionMode: "BRENDAH" },
    );

    expect(result.totalCommission).toBe(39_000);
    expect(result.lines.find((l) => l.channel === "DIRECT")?.commission).toBe(39_000);
  });
});
