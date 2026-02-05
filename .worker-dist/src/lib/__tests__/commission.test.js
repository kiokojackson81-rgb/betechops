"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const commissionCommon_1 = require("@/lib/commissionCommon");
const commission_1 = require("../commission");
describe("computeSalesCommissionFromTiers - basic cases", () => {
    const tiers = [
        { minSales: 500000, maxSales: 1000000, payoutFlat: 10000 },
        { minSales: 2000000, maxSales: 2000000, payoutFlat: 15000 },
        { minSales: 3000000, maxSales: 3000000, payoutFlat: 20000 },
    ];
    test("below first tier uses fallback percent", () => {
        const res = (0, commission_1.computeSalesCommissionFromTiers)(300000, 40000, tiers, 0.05);
        expect(Math.round(res)).toBe(Math.round(0.05 * 40000));
    });
    test("inside 500k-1M band prorated", () => {
        // 750k -> progress 250k of 500k -> 0.5 * 10k = 5k
        const res = (0, commission_1.computeSalesCommissionFromTiers)(750000, 0, tiers, 0.05);
        expect(Math.round(res)).toBe(5000);
    });
    test("exactly 1M returns full band reward", () => {
        const res = (0, commission_1.computeSalesCommissionFromTiers)(1000000, 0, tiers, 0.05);
        expect(Math.round(res)).toBe(10000);
    });
    test("sales between 1M and 2M keep the first tier reward", () => {
        const res = (0, commission_1.computeSalesCommissionFromTiers)(1500000, 0, tiers, 0.05);
        expect(Math.round(res)).toBe(10000);
    });
    test("2M includes 10k + 15k step", () => {
        const res = (0, commission_1.computeSalesCommissionFromTiers)(2000000, 0, tiers, 0.05);
        expect(Math.round(res)).toBe(25000);
    });
    test("adds base commission when profit exists in sales above the first tier", () => {
        const res = (0, commission_1.computeSalesCommissionFromTiers)(1500000, 60000, tiers, 0.05);
        const totalSalesLicense = 1500000;
        const baseProfitShare = Math.min(totalSalesLicense, 500000) / totalSalesLicense;
        const baseCommission = 0.05 * 60000 * baseProfitShare;
        const expectedProgress = 10000 + 7500; // full first band + half of 2nd band
        expect(res).toBeCloseTo(baseCommission + expectedProgress);
    });
});
test("commission ladder basic checks", () => {
    expect((0, commissionCommon_1.calculateCumulativeCommission)(900000).commission).toBe(0);
    expect((0, commissionCommon_1.calculateCumulativeCommission)(1000000).commission).toBe(10000);
    expect((0, commissionCommon_1.calculateCumulativeCommission)(2000000).commission).toBe(25000);
    expect((0, commissionCommon_1.calculateCumulativeCommission)(3000000).commission).toBe(45000);
});
