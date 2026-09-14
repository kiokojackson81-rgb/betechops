import { liveWarrantyStatus, technicalConfiguration, warrantyExpiry } from "@/lib/warrantyRules";

describe("warranty rules", () => {
  test("accepts only technical classifications, never package descriptions", () => {
    expect(technicalConfiguration("Hybrid")).toBe("Hybrid Solar PV System");
    expect(technicalConfiguration("off_grid")).toBe("Off-Grid Solar PV System");
    expect(technicalConfiguration("Grid-Tied Solar PV System")).toBe("Grid-Tied Solar PV System");
    expect(technicalConfiguration("10kW hybrid package including transport and installation")).toBe("Not recorded");
  });
  test.each([[5, "2031-09-13"], [10, "2036-09-13"], [25, "2051-09-13"]])("expires after %i years on the day before the anniversary", (years, expected) => {
    expect(warrantyExpiry(new Date("2026-09-14T00:00:00Z"), years).slice(0, 10)).toBe(expected);
  });
  test("live statuses preserve void and replacement state", () => {
    const equipment = [{ warrantyExpiryDate: "2031-09-13T23:59:59Z" }];
    expect(liveWarrantyStatus({ status: "ISSUED", coverageStatus: "VOID" }, equipment)).toBe("VOID");
    expect(liveWarrantyStatus({ status: "SUPERSEDED" }, equipment)).toBe("REPLACED");
    expect(liveWarrantyStatus({ status: "ISSUED" }, equipment, new Date("2032-01-01"))).toBe("EXPIRED");
    expect(liveWarrantyStatus({ status: "ISSUED", coverageStatus: "UNDER_CLAIM" }, equipment)).toBe("UNDER_CLAIM");
  });
});
