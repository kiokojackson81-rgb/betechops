/**
 * Deterministic sizing used by the field-assessment workspace and the issued
 * report. AI may explain these results, but it must never change the maths.
 */
export type AssessmentLoadInput = {
  id?: number;
  kind?: string;
  name?: string;
  qty?: number | "" | null;
  watts?: number | "" | null;
  usageMode?: string;
  hours?: number | "" | null;
  uses?: number | "" | null;
  minutes?: number | "" | null;
  period?: string;
  simultaneous?: number | "" | null;
  essential?: boolean;
  design?: string;
  details?: Record<string, string>;
};

export type AssessmentProductInput = {
  productName?: string;
  productCategory?: string;
  shortDescription?: string | null;
  productUrl?: string;
};

export type AssessmentAnalysisInput = {
  loads?: AssessmentLoadInput[];
  electrical?: Record<string, unknown>;
  siteDetails?: Record<string, unknown>;
  evidenceNames?: Record<string, unknown>;
  selectedProduct?: AssessmentProductInput | null;
};

export const ASSESSMENT_DESIGN_ASSUMPTIONS = {
  peakSunHours: 4.5,
  pvPerformanceFactor: 0.78,
  inverterOperatingReserve: 0.25,
  batteryInverterEfficiency: 0.92,
  batteryDepthOfDischarge: 0.9,
  batteryReserve: 0.1,
  batteryOperatingMargin: 0.95,
  panelWatts: 600,
  dayShareForBoth: 0.5,
  nightShareForBoth: 0.5,
} as const;

const INVERTER_SIZES_KW = [1.5, 3, 5, 6, 8, 10, 12, 16, 20];
const BATTERY_SIZES_KWH = [2.56, 5.12, 7.68, 10, 15, 16];
const MOTOR_KINDS = new Set(["fridge", "freezer", "water-pump", "borehole-pump", "electric-gate", "ac"]);
const CRITICAL_EVIDENCE = ["Meter box", "Open main DB", "Earthing point", "Roof wide"];

const number = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};
const clean = (value: unknown) => typeof value === "string" ? value.trim() : "";
const roundUp = (value: number, sizes: number[]) => sizes.find((size) => size >= value) || Math.ceil(value / sizes[sizes.length - 1]) * sizes[sizes.length - 1];
const normalized = (value: unknown) => clean(value).toLowerCase();

function usageHoursPerDay(load: AssessmentLoadInput) {
  switch (load.usageMode) {
    case "ALWAYS_ON": return 24;
    case "EVENTS_DAILY": return number(load.uses) * number(load.minutes) / 60;
    case "EVENTS_WEEKLY": return number(load.uses) * number(load.minutes) / 60 / 7;
    default: return number(load.hours);
  }
}

function loadAdvice(load: AssessmentLoadInput, energyKwh: number) {
  const name = `${load.kind || ""} ${load.name || ""}`.toLowerCase();
  if (/(cooker|oven|kettle|iron|instant shower)/.test(name)) return "High-heat appliance: keep on grid where available and avoid running it with other heavy loads during an outage.";
  if (/(water.?pump|borehole|pump)/.test(name)) return "Motor load: confirm running current, start method and surge requirement before final inverter selection.";
  if (/(air conditioner|\bac\b)/.test(name)) return "Air-conditioning has a high energy and startup demand; confirm its exact rating and operating hours before final sizing.";
  if (/(cctv|wi-?fi|fibre|ont|router|electric fence)/.test(name)) return "Continuous security/connectivity load: retain on the backed-up circuit if uninterrupted operation is required.";
  if (energyKwh >= 3) return "This is a material energy consumer. Its operating schedule should be agreed before final PV and battery sizing.";
  return "Recorded usage is included in the energy assessment.";
}

function productCapabilities(product: AssessmentProductInput | null | undefined) {
  const source = `${product?.productName || ""} ${product?.shortDescription || ""}`;
  const inverter = source.match(/(\d+(?:\.\d+)?)\s*kW\s*(?:hybrid\s*)?inverter/i)?.[1];
  const battery = source.match(/(\d+(?:\.\d+)?)\s*kWh\s*(?:lithium\s*)?(?:battery|storage)/i)?.[1];
  const panelMatch = source.match(/(\d+)\s*[x×]\s*(\d+)\s*W(?:att)?/i);
  return {
    inverterKw: inverter ? Number(inverter) : null,
    batteryKwh: battery ? Number(battery) : null,
    pvKw: panelMatch ? Number(panelMatch[1]) * Number(panelMatch[2]) / 1000 : null,
    phase: /three[ -]?phase/i.test(source) ? "THREE_PHASE" : /single[ -]?phase/i.test(source) ? "SINGLE_PHASE" : null,
  };
}

export function analyseSiteAssessment(input: AssessmentAnalysisInput) {
  const loads = (input.loads || []).map((load) => {
    const watts = number(load.watts);
    const qty = number(load.qty);
    const connectedKw = watts * qty / 1000;
    const hours = usageHoursPerDay(load);
    const energyKwh = connectedKw * hours;
    const period = normalized(load.period);
    const dayShare = period === "night" ? 0 : period === "both" || load.usageMode === "ALWAYS_ON" ? ASSESSMENT_DESIGN_ASSUMPTIONS.dayShareForBoth : 1;
    const nightShare = period === "day" ? 0 : period === "both" || load.usageMode === "ALWAYS_ON" ? ASSESSMENT_DESIGN_ASSUMPTIONS.nightShareForBoth : 1;
    const requestedBackupHours = number(input.electrical?.backupHours) || 8;
    const outageRuntimeHours = Math.min(hours, requestedBackupHours);
    const essential = Boolean(load.essential) && !normalized(load.design).includes("leave on grid");
    return { ...load, watts, qty, connectedKw, hours, energyKwh, dayKwh: energyKwh * dayShare, nightKwh: energyKwh * nightShare, essential, outageRuntimeHours };
  });
  const included = loads.filter((load) => !normalized(load.design).includes("leave on grid"));
  const connectedKw = loads.reduce((total, load) => total + load.connectedKw, 0);
  const dailyKwh = loads.reduce((total, load) => total + load.energyKwh, 0);
  const dayKwh = loads.reduce((total, load) => total + load.dayKwh, 0);
  const nightKwh = loads.reduce((total, load) => total + load.nightKwh, 0);
  const continuousKw = included.filter((load) => load.usageMode === "ALWAYS_ON").reduce((total, load) => total + load.connectedKw, 0);
  const simultaneousPeakKw = included.reduce((total, load) => total + number(load.watts) * Math.min(number(load.qty), number(load.simultaneous) || number(load.qty)) / 1000, 0);
  const largestMotorKw = included.filter((load) => MOTOR_KINDS.has(load.kind || "") || /(pump|fridge|freezer|air conditioner)/i.test(load.name || "")).reduce((largest, load) => Math.max(largest, load.connectedKw), 0);
  const inverterRequiredKw = Math.max(simultaneousPeakKw * (1 + ASSESSMENT_DESIGN_ASSUMPTIONS.inverterOperatingReserve), continuousKw * (1 + ASSESSMENT_DESIGN_ASSUMPTIONS.inverterOperatingReserve), simultaneousPeakKw + largestMotorKw * 2);
  const inverterKw = roundUp(Math.max(1.5, inverterRequiredKw), INVERTER_SIZES_KW);
  const essentialLoads = included.filter((load) => load.essential);
  const rawBackupEnergyKwh = essentialLoads.reduce((total, load) => total + load.connectedKw * load.outageRuntimeHours, 0);
  const batteryDenominator = ASSESSMENT_DESIGN_ASSUMPTIONS.batteryInverterEfficiency * ASSESSMENT_DESIGN_ASSUMPTIONS.batteryDepthOfDischarge * (1 - ASSESSMENT_DESIGN_ASSUMPTIONS.batteryReserve) * ASSESSMENT_DESIGN_ASSUMPTIONS.batteryOperatingMargin;
  const calculatedBatteryKwh = rawBackupEnergyKwh ? rawBackupEnergyKwh / batteryDenominator : 0;
  const batteryKwh = calculatedBatteryKwh ? roundUp(Math.max(2.56, calculatedBatteryKwh), BATTERY_SIZES_KWH) : 0;
  const usableBatteryKwh = batteryKwh * ASSESSMENT_DESIGN_ASSUMPTIONS.batteryDepthOfDischarge * ASSESSMENT_DESIGN_ASSUMPTIONS.batteryInverterEfficiency * ASSESSMENT_DESIGN_ASSUMPTIONS.batteryOperatingMargin;
  const essentialAverageKw = rawBackupEnergyKwh && (number(input.electrical?.backupHours) || 8) ? rawBackupEnergyKwh / (number(input.electrical?.backupHours) || 8) : 0;
  const expectedBackupHours = essentialAverageKw ? usableBatteryKwh / essentialAverageKw : 0;
  const pvCalculatedKwp = dailyKwh / (ASSESSMENT_DESIGN_ASSUMPTIONS.peakSunHours * ASSESSMENT_DESIGN_ASSUMPTIONS.pvPerformanceFactor);
  const panelCount = pvCalculatedKwp ? Math.max(1, Math.ceil(pvCalculatedKwp * 1000 / ASSESSMENT_DESIGN_ASSUMPTIONS.panelWatts)) : 0;
  const pvPracticalKwp = panelCount * ASSESSMENT_DESIGN_ASSUMPTIONS.panelWatts / 1000;
  const expectedSolarProductionKwh = pvPracticalKwp * ASSESSMENT_DESIGN_ASSUMPTIONS.peakSunHours * ASSESSMENT_DESIGN_ASSUMPTIONS.pvPerformanceFactor;
  const solarCoveragePercent = dailyKwh ? expectedSolarProductionKwh / dailyKwh * 100 : 0;
  const evidenceLabels = Object.entries(input.evidenceNames || {}).filter(([, value]) => Boolean(clean(value))).map(([label]) => label);
  const missingCriticalEvidence = CRITICAL_EVIDENCE.filter((label) => !evidenceLabels.includes(label));
  const supply = normalized(input.siteDetails?.supplyType);
  const goal = normalized(input.electrical?.systemGoal);
  const hasMotor = largestMotorKw > 0;
  const technicalReviewReasons = [
    ...(missingCriticalEvidence.length ? [`Missing critical site evidence: ${missingCriticalEvidence.join(", ")}.`] : []),
    ...(supply.includes("three") ? ["Three-phase supply requires phase and protection review."] : []),
    ...(hasMotor ? ["Motor loads require surge/start-current confirmation."] : []),
    ...(goal.includes("off-grid") ? ["Off-grid operation requires seasonal autonomy and generator/grid contingency review."] : []),
  ];
  const capabilities = productCapabilities(input.selectedProduct);
  const phaseMismatch = capabilities.phase === "SINGLE_PHASE" && supply.includes("three");
  const knownUndersized = (capabilities.inverterKw !== null && capabilities.inverterKw < inverterKw) || (capabilities.batteryKwh !== null && capabilities.batteryKwh < batteryKwh) || (capabilities.pvKw !== null && capabilities.pvKw < pvPracticalKwp) || phaseMismatch;
  const allSpecificationsAvailable = Boolean(input.selectedProduct) && capabilities.inverterKw !== null && capabilities.batteryKwh !== null && capabilities.pvKw !== null && (!supply.includes("three") || capabilities.phase === "THREE_PHASE");
  const productStatus = !input.selectedProduct ? "CUSTOM" : knownUndersized ? "FAIL" : allSpecificationsAvailable ? "PASS" : "PARTIAL";
  const productReasons = [
    ...(capabilities.inverterKw !== null ? [`Inverter ${capabilities.inverterKw} kW vs required ${inverterKw} kW.`] : ["Inverter specification is not structured in the catalog record."]),
    ...(capabilities.batteryKwh !== null ? [`Battery ${capabilities.batteryKwh} kWh vs required ${batteryKwh} kWh nominal.`] : ["Battery specification is not structured in the catalog record."]),
    ...(capabilities.pvKw !== null ? [`PV ${capabilities.pvKw} kWp vs practical requirement ${pvPracticalKwp} kWp.`] : ["PV specification is not structured in the catalog record."]),
    ...(phaseMismatch ? ["Selected product is single-phase while the recorded supply is three-phase."] : []),
  ];
  return {
    loads,
    connectedKw, dailyKwh, dayKwh, nightKwh, continuousKw, simultaneousPeakKw, inverterRequiredKw, inverterKw,
    rawBackupEnergyKwh, calculatedBatteryKwh, batteryKwh, usableBatteryKwh, expectedBackupHours,
    pvCalculatedKwp, pvPracticalKwp, panelCount, expectedSolarProductionKwh, solarCoveragePercent,
    evidenceLabels, missingCriticalEvidence, technicalReviewRequired: technicalReviewReasons.length > 0,
    technicalReviewReasons, status: missingCriticalEvidence.length ? "ASSESSMENT COMPLETE — VERIFICATION REQUIRED" : "TECHNICALLY ASSESSED",
    productMatch: { status: productStatus, capabilities, reasons: productReasons },
    loadAdvice: loads.filter((load) => load.energyKwh > 0).map((load) => ({ name: load.name || "Recorded appliance", energyKwh: load.energyKwh, advice: loadAdvice(load, load.energyKwh) })),
  } as const;
}
