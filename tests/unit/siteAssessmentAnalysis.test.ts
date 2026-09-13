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

  it("uses duty cycle, separate motor surge and outage runtime for defensible sizing", () => {
    const result = analyseSiteAssessment({
      ...base,
      loads: [
        { id: 1, kind: "freezer", name: "Freezer", qty: 1, watts: 200, ratingKnown: true, usageMode: "ALWAYS_ON", period: "Both", essential: true, simultaneous: 1, details: { dutyCycle: "0.4", outageRuntimeHours: "8", surgeMultiplier: "3", ratingSource: "Nameplate photo confirmed" } },
        { id: 2, kind: "lights", name: "Lights", qty: 5, watts: 10, ratingKnown: true, usageMode: "DAILY_HOURS", hours: 5, period: "Night", essential: true, simultaneous: 5, details: { outageRuntimeHours: "5", ratingSource: "Technician-entered rating" } },
      ],
    });
    expect(result.dailyKwh).toBeCloseTo(2.17);
    expect(result.rawBackupEnergyKwh).toBeCloseTo(0.89);
    expect(result.surgeRequirementKw).toBeGreaterThan(result.simultaneousPeakKw);
  });

  it("marks major unverified loads and significant KPLC variance for review", () => {
    const result = analyseSiteAssessment({
      ...base,
      electrical: { ...base.electrical, monthlyKwh: "30" },
      loads: [{ id: 1, kind: "water-pump", name: "Water pump", qty: 1, watts: 1500, ratingKnown: false, usageMode: "DAILY_HOURS", hours: 4, period: "Day", essential: true, simultaneous: 1, details: { ratingSource: "Default appliance profile" } }],
    });
    expect(result.kplcAlignment).toBe("SIGNIFICANT_DISCREPANCY");
    expect(result.highImpactLowConfidenceLoads).toHaveLength(1);
    expect(result.assessmentResult).toBe("SIZING REVIEW REQUIRED");
  });

  it("uses battery restoration as a PV sizing guardrail and rounds to the selected panel wattage", () => {
    const result = analyseSiteAssessment({
      ...base,
      electrical: { ...base.electrical, panelWatts: "625" },
      loads: [
        { id: 1, kind: "water-pump", name: "Essential pump", qty: 1, watts: 500, ratingKnown: true, photo: true, usageMode: "DAILY_HOURS", hours: 8, period: "Night", essential: true, simultaneous: 1, details: { outageRuntimeHours: "8", surgeMultiplier: "3", ratingSource: "Nameplate confirmed" } },
      ],
    });
    expect(result.finalSizing.pvRechargeRequirement).toBeGreaterThan(result.finalSizing.pvDailyEnergyRequirement);
    expect(result.finalSizing.panelWattage).toBe(625);
    expect(result.finalSizing.installedPV).toBe(result.finalSizing.panelCount * 0.625);
    expect(result.finalSizing.pvRequired).toBe(result.pvRequiredKwp);
  });

  it("classifies an otherwise suitable package as adjusted when only PV or storage must change", () => {
    const result = analyseSiteAssessment({
      ...base,
      loads: [{ id: 1, name: "Essential load", qty: 1, watts: 500, ratingKnown: true, photo: true, usageMode: "DAILY_HOURS", hours: 8, period: "Night", essential: true, simultaneous: 1, details: { outageRuntimeHours: "8", ratingSource: "Nameplate confirmed" } }],
      selectedProduct: { productName: "3kW Hybrid Inverter, 2.56kWh Lithium Battery, 2 x 600W panels", shortDescription: "Single phase solar system" },
    });
    expect(result.productMatch.status).toBe("ADJUSTED");
    expect(result.recommendationOutcome).toBe("BETECH PACKAGE — ADJUSTED CONFIGURATION");
  });
});
