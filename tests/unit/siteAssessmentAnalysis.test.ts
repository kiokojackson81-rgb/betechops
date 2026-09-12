import { analyseSiteAssessment } from "@/lib/siteAssessmentAnalysis";

describe("deterministic site-assessment engineering analysis", () => {
  const base = {
    electrical: { backupHours: "8", systemGoal: "Backup during outages" },
    siteDetails: { supplyType: "Single phase" },
    evidenceNames: { "Meter box": "meter.jpg", "Open main DB": "db.jpg", "Earthing point": "earth.jpg", "Roof wide": "roof.jpg" },
  };

  it("allocates Both loads across day and night without counting their energy twice", () => {
    const result = analyseSiteAssessment({
      ...base,
      loads: [{ id: 1, name: "Lights", qty: 10, watts: 10, usageMode: "DAILY_HOURS", hours: 10, period: "Both", essential: true }],
    });
    expect(result.dailyKwh).toBeCloseTo(1);
    expect(result.dayKwh).toBeCloseTo(0.5);
    expect(result.nightKwh).toBeCloseTo(0.5);
    expect(result.dayKwh + result.nightKwh).toBeCloseTo(result.dailyKwh);
  });

  it("uses appliance backup runtime and real 600W panel increments", () => {
    const result = analyseSiteAssessment({
      ...base,
      loads: [
        { id: 1, name: "Wi-Fi", qty: 1, watts: 20, usageMode: "ALWAYS_ON", period: "Both", essential: true, simultaneous: 1 },
        { id: 2, name: "Lights", qty: 10, watts: 10, usageMode: "DAILY_HOURS", hours: 5, period: "Night", essential: true, simultaneous: 10 },
      ],
    });
    expect(result.rawBackupEnergyKwh).toBeCloseTo(0.66);
    expect(result.batteryKwh).toBeGreaterThanOrEqual(result.calculatedBatteryKwh);
    expect(result.pvPracticalKwp).toBe(result.panelCount * 0.6);
    expect(result.expectedSolarProductionKwh).toBeCloseTo(result.pvPracticalKwp * 4.5 * 0.78);
  });

  it("does not validate an undersized selected catalog system", () => {
    const result = analyseSiteAssessment({
      ...base,
      loads: [{ id: 1, name: "Water pump", kind: "water-pump", qty: 1, watts: 1500, usageMode: "DAILY_HOURS", hours: 2, period: "Day", essential: true, simultaneous: 1 }],
      selectedProduct: { productName: "1.5kW Hybrid Inverter, 2.56kWh Lithium Battery, 2 x 600W panels", shortDescription: "Single phase solar system" },
    });
    expect(result.productMatch.status).toBe("FAIL");
  });
});
