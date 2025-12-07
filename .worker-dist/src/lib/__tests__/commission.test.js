"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const commissionCommon_1 = require("@/lib/commissionCommon");
test("commission ladder basic checks", () => {
    expect((0, commissionCommon_1.calculateCumulativeCommission)(900000).commission).toBe(0);
    expect((0, commissionCommon_1.calculateCumulativeCommission)(1000000).commission).toBe(10000);
    expect((0, commissionCommon_1.calculateCumulativeCommission)(2000000).commission).toBe(25000);
    expect((0, commissionCommon_1.calculateCumulativeCommission)(3000000).commission).toBe(45000);
});
