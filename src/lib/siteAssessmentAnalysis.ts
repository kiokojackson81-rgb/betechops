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
  ratingKnown?: boolean;
  photo?: boolean;
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
  sizingConfig?: Record<string, unknown>;
  assessmentCompleted?: boolean;
};

export const ASSESSMENT_DESIGN_ASSUMPTIONS = {
  version: "2026-09-residential-v2",
  peakSunHours: 4.5,
  pvPerformanceFactor: 0.78,
  pvRechargeMargin: 1.1,
  pvRechargeWindowHours: 5,
  pvPracticalReserve: 1.05,
  moderateShadingAdjustment: 1.15,
  inverterOperatingReserve: 0.25,
  batteryInverterEfficiency: 0.92,
  batteryDepthOfDischarge: 0.9,
  batteryReserve: 0.1,
  batteryOperatingMargin: 0.95,
  panelWatts: 600,
  defaultMotorSurgeMultiplier: 3,
  defaultCompressorDutyCycle: 0.35,
  defaultAcDutyCycle: 0.6,
  kplcAlignedVariancePercent: 20,
  kplcReviewVariancePercent: 50,
  dayShareForBoth: 0.5,
  nightShareForBoth: 0.5,
} as const;

const INVERTER_SIZES_KW = [1.5, 3, 5, 6, 8, 10, 12, 16, 20];
const BATTERY_SIZES_KWH = [2.56, 5.12, 7.68, 10, 15, 16];
const MOTOR_KINDS = new Set(["fridge", "freezer", "water-pump", "borehole-pump", "electric-gate", "ac"]);
const MAJOR_LOAD_KINDS = new Set(["water-pump", "borehole-pump", "fridge", "freezer", "ac", "cooker", "washing", "electric-gate"]);
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

type SizingConfig = {
  version: string;
  peakSunHours: number;
  pvPerformanceFactor: number;
  pvRechargeMargin: number;
  pvRechargeWindowHours: number;
  pvPracticalReserve: number;
  moderateShadingAdjustment: number;
  inverterOperatingReserve: number;
  batteryInverterEfficiency: number;
  batteryDepthOfDischarge: number;
  batteryReserve: number;
  batteryOperatingMargin: number;
  panelWatts: number;
  defaultMotorSurgeMultiplier: number;
  defaultCompressorDutyCycle: number;
  defaultAcDutyCycle: number;
  kplcAlignedVariancePercent: number;
  kplcReviewVariancePercent: number;
  dayShareForBoth: number;
  nightShareForBoth: number;
};
const configuredNumber = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};
function resolveSizingConfig(raw: Record<string, unknown> | undefined): SizingConfig {
  return {
    ...ASSESSMENT_DESIGN_ASSUMPTIONS,
    peakSunHours: configuredNumber(raw?.peakSunHours, ASSESSMENT_DESIGN_ASSUMPTIONS.peakSunHours),
    pvPerformanceFactor: configuredNumber(raw?.pvPerformanceFactor, ASSESSMENT_DESIGN_ASSUMPTIONS.pvPerformanceFactor),
    pvRechargeMargin: configuredNumber(raw?.pvRechargeMargin, ASSESSMENT_DESIGN_ASSUMPTIONS.pvRechargeMargin),
    pvRechargeWindowHours: configuredNumber(raw?.pvRechargeWindowHours, ASSESSMENT_DESIGN_ASSUMPTIONS.pvRechargeWindowHours),
    pvPracticalReserve: configuredNumber(raw?.pvPracticalReserve, ASSESSMENT_DESIGN_ASSUMPTIONS.pvPracticalReserve),
    moderateShadingAdjustment: configuredNumber(raw?.moderateShadingAdjustment, ASSESSMENT_DESIGN_ASSUMPTIONS.moderateShadingAdjustment),
    inverterOperatingReserve: configuredNumber(raw?.inverterOperatingReserve, ASSESSMENT_DESIGN_ASSUMPTIONS.inverterOperatingReserve),
    batteryInverterEfficiency: configuredNumber(raw?.batteryInverterEfficiency, ASSESSMENT_DESIGN_ASSUMPTIONS.batteryInverterEfficiency),
    batteryDepthOfDischarge: configuredNumber(raw?.batteryDepthOfDischarge, ASSESSMENT_DESIGN_ASSUMPTIONS.batteryDepthOfDischarge),
    batteryReserve: configuredNumber(raw?.batteryReserve, ASSESSMENT_DESIGN_ASSUMPTIONS.batteryReserve),
    batteryOperatingMargin: configuredNumber(raw?.batteryOperatingMargin, ASSESSMENT_DESIGN_ASSUMPTIONS.batteryOperatingMargin),
    panelWatts: configuredNumber(raw?.panelWatts, ASSESSMENT_DESIGN_ASSUMPTIONS.panelWatts),
    defaultMotorSurgeMultiplier: configuredNumber(raw?.defaultMotorSurgeMultiplier, ASSESSMENT_DESIGN_ASSUMPTIONS.defaultMotorSurgeMultiplier),
    defaultCompressorDutyCycle: configuredNumber(raw?.defaultCompressorDutyCycle, ASSESSMENT_DESIGN_ASSUMPTIONS.defaultCompressorDutyCycle),
    defaultAcDutyCycle: configuredNumber(raw?.defaultAcDutyCycle, ASSESSMENT_DESIGN_ASSUMPTIONS.defaultAcDutyCycle),
    kplcAlignedVariancePercent: configuredNumber(raw?.kplcAlignedVariancePercent, ASSESSMENT_DESIGN_ASSUMPTIONS.kplcAlignedVariancePercent),
    kplcReviewVariancePercent: configuredNumber(raw?.kplcReviewVariancePercent, ASSESSMENT_DESIGN_ASSUMPTIONS.kplcReviewVariancePercent),
  };
}

function loadType(load: AssessmentLoadInput) {
  const recorded = normalized(load.details?.loadType);
  if (recorded === "motor/compressor") return "MOTOR_COMPRESSOR";
  if (recorded === "resistive") return "RESISTIVE";
  if (recorded === "electronic") return "ELECTRONIC";
  return MOTOR_KINDS.has(load.kind || "") || /(pump|fridge|freezer|air conditioner|compressor|gate)/i.test(load.name || "")
    ? "MOTOR_COMPRESSOR"
    : "UNKNOWN";
}

export function analyseSiteAssessment(input: AssessmentAnalysisInput) {
  const assumptions = resolveSizingConfig(input.sizingConfig);
  const loads = (input.loads || []).map((load) => {
    const watts = number(load.watts);
    const qty = number(load.qty);
    const connectedKw = watts * qty / 1000;
    const hours = usageHoursPerDay(load);
    const type = loadType(load);
    const recordedDutyCycle = number(load.details?.dutyCycle);
    const dutyCycle = recordedDutyCycle || (type === "MOTOR_COMPRESSOR" && /air conditioner|\bac\b/i.test(load.name || "") ? assumptions.defaultAcDutyCycle : type === "MOTOR_COMPRESSOR" && /(fridge|freezer)/i.test(load.name || "") ? assumptions.defaultCompressorDutyCycle : 1);
    const dutyCycleEstimated = !recordedDutyCycle && dutyCycle !== 1;
    const energyKwh = connectedKw * hours * dutyCycle;
    const period = normalized(load.period);
    const dayShare = period === "night" ? 0 : period === "both" || load.usageMode === "ALWAYS_ON" ? ASSESSMENT_DESIGN_ASSUMPTIONS.dayShareForBoth : 1;
    const nightShare = period === "day" ? 0 : period === "both" || load.usageMode === "ALWAYS_ON" ? ASSESSMENT_DESIGN_ASSUMPTIONS.nightShareForBoth : 1;
    const requestedBackupHours = number(input.electrical?.backupHours) || 8;
    const recordedOutageRuntime = number(load.details?.outageRuntimeHours);
    const outageRuntimeHours = recordedOutageRuntime || Math.min(hours, requestedBackupHours);
    const essential = Boolean(load.essential) && !normalized(load.design).includes("leave on grid");
    const surgeMultiplier = type === "MOTOR_COMPRESSOR" ? number(load.details?.surgeMultiplier) || assumptions.defaultMotorSurgeMultiplier : 1;
    const surgeEstimated = type === "MOTOR_COMPRESSOR" && !number(load.details?.surgeMultiplier);
    const source = clean(load.details?.ratingSource) || (load.ratingKnown ? "Technician-entered rating" : "Default / unknown rating");
    const confidence = load.photo ? "HIGH" : /default|unknown|estimate/i.test(source) || !load.ratingKnown ? "LOW" : "MEDIUM";
    return { ...load, watts, qty, connectedKw, hours, dutyCycle, dutyCycleEstimated, energyKwh, dayKwh: energyKwh * dayShare, nightKwh: energyKwh * nightShare, essential, outageRuntimeHours, outageEnergyKwh: connectedKw * Math.min(outageRuntimeHours, requestedBackupHours) * dutyCycle, loadType: type, surgeMultiplier, surgeEstimated, surgeKw: connectedKw * surgeMultiplier, source, confidence };
  });
  const included = loads.filter((load) => !normalized(load.design).includes("leave on grid"));
  const connectedKw = loads.reduce((total, load) => total + load.connectedKw, 0);
  const dailyKwh = loads.reduce((total, load) => total + load.energyKwh, 0);
  const dayKwh = loads.reduce((total, load) => total + load.dayKwh, 0);
  const nightKwh = loads.reduce((total, load) => total + load.nightKwh, 0);
  const continuousKw = included.filter((load) => load.usageMode === "ALWAYS_ON").reduce((total, load) => total + load.connectedKw, 0);
  const simultaneousPeakKw = included.reduce((total, load) => total + number(load.watts) * Math.min(number(load.qty), number(load.simultaneous) || number(load.qty)) / 1000, 0);
  const motorLoads = included.filter((load) => load.loadType === "MOTOR_COMPRESSOR");
  const maximumMotorStartIncrementKw = motorLoads.reduce((largest, load) => Math.max(largest, load.connectedKw * Math.max(0, load.surgeMultiplier - 1)), 0);
  const surgeRequirementKw = simultaneousPeakKw + maximumMotorStartIncrementKw;
  const inverterRequiredKw = Math.max(simultaneousPeakKw * (1 + assumptions.inverterOperatingReserve), continuousKw * (1 + assumptions.inverterOperatingReserve), surgeRequirementKw);
  const inverterKw = roundUp(Math.max(1.5, inverterRequiredKw), INVERTER_SIZES_KW);
  const essentialLoads = included.filter((load) => load.essential);
  const rawBackupEnergyKwh = essentialLoads.reduce((total, load) => total + load.outageEnergyKwh, 0);
  const batteryDenominator = assumptions.batteryInverterEfficiency * assumptions.batteryDepthOfDischarge * (1 - assumptions.batteryReserve) * assumptions.batteryOperatingMargin;
  const calculatedBatteryKwh = rawBackupEnergyKwh ? rawBackupEnergyKwh / batteryDenominator : 0;
  const batteryKwh = calculatedBatteryKwh ? roundUp(Math.max(2.56, calculatedBatteryKwh), BATTERY_SIZES_KWH) : 0;
  const usableBatteryKwh = batteryKwh * assumptions.batteryDepthOfDischarge * assumptions.batteryInverterEfficiency * assumptions.batteryOperatingMargin;
  const essentialAverageKw = rawBackupEnergyKwh && (number(input.electrical?.backupHours) || 8) ? rawBackupEnergyKwh / (number(input.electrical?.backupHours) || 8) : 0;
  const expectedBackupHours = essentialAverageKw ? usableBatteryKwh / essentialAverageKw : 0;
  const objective = normalized(input.electrical?.systemGoal);
  const rechargeWindowHours = assumptions.pvRechargeWindowHours;
  const batteryEnergyToRestoreKwh = rawBackupEnergyKwh / assumptions.batteryInverterEfficiency;
  // Daytime demand is apportioned to the selected effective recharge window. This
  // prevents a small array from being recommended just because average daily load
  // is low while a battery still has to be restored after an outage.
  const daytimeEnergyDuringRechargeKwh = dayKwh * Math.min(1, rechargeWindowHours / 12);
  const pvDailyEnergyRequirementKwp = dailyKwh / (assumptions.peakSunHours * assumptions.pvPerformanceFactor);
  const pvRechargeRequirementKwp = rawBackupEnergyKwh
    ? (batteryEnergyToRestoreKwh + daytimeEnergyDuringRechargeKwh) * assumptions.pvRechargeMargin / (rechargeWindowHours * assumptions.pvPerformanceFactor)
    : 0;
  const explicitObjectiveKwp = number(input.electrical?.pvObjectiveKwp);
  const targetSolarOffset = Math.min(1, number(input.electrical?.targetSolarOffsetPercent) / 100);
  const pvObjectiveRequirementKwp = explicitObjectiveKwp || (objective.includes("off-grid")
    ? dailyKwh * assumptions.pvRechargeMargin / (assumptions.peakSunHours * assumptions.pvPerformanceFactor)
    : targetSolarOffset
      ? dailyKwh * targetSolarOffset / (assumptions.peakSunHours * assumptions.pvPerformanceFactor)
      : 0);
  const pvRequiredKwp = Math.max(pvDailyEnergyRequirementKwp, pvRechargeRequirementKwp, pvObjectiveRequirementKwp);
  const shadingAdjustment = normalized(input.siteDetails?.shading).includes("moderate") ? assumptions.moderateShadingAdjustment : 1;
  const pvCalculatedKwp = pvRequiredKwp;
  const pvDesignEnergyKwh = dailyKwh;
  const productPanelWatts = input.selectedProduct ? Number(`${input.selectedProduct.productName} ${input.selectedProduct.shortDescription || ""}`.match(/(?:×|x)\s*(\d+)\s*w/i)?.[1]) : 0;
  const panelWatts = productPanelWatts || configuredNumber(input.electrical?.panelWatts, assumptions.panelWatts);
  const practicalPvTargetKwp = pvRequiredKwp * assumptions.pvPracticalReserve * shadingAdjustment;
  const panelCount = pvRequiredKwp ? Math.max(1, Math.ceil(practicalPvTargetKwp * 1000 / panelWatts)) : 0;
  const pvPracticalKwp = panelCount * panelWatts / 1000;
  const expectedSolarProductionKwh = pvPracticalKwp * assumptions.peakSunHours * assumptions.pvPerformanceFactor;
  const solarCoveragePercent = dailyKwh ? expectedSolarProductionKwh / dailyKwh * 100 : 0;
  const evidenceLabels = Object.entries(input.evidenceNames || {}).filter(([, value]) => Boolean(clean(value))).map(([label]) => label);
  const missingCriticalEvidence = CRITICAL_EVIDENCE.filter((label) => !evidenceLabels.includes(label));
  const supply = normalized(input.siteDetails?.supplyType);
  const kplcMonthlyKwh = number(input.electrical?.monthlyKwh);
  const billingDays = number(input.electrical?.billingDays) || 30;
  const kplcDailyKwh = kplcMonthlyKwh / billingDays;
  const kplcVariancePercent = kplcDailyKwh && dailyKwh ? Math.abs(dailyKwh - kplcDailyKwh) / kplcDailyKwh * 100 : null;
  const kplcAlignment = !kplcDailyKwh || !dailyKwh
    ? "NOT_CONFIRMED"
    : (kplcVariancePercent || 0) <= assumptions.kplcAlignedVariancePercent
      ? "ALIGNED"
      : (kplcVariancePercent || 0) <= assumptions.kplcReviewVariancePercent
        ? "REVIEW_RECOMMENDED"
        : "SIGNIFICANT_DISCREPANCY";
  const unusualLoads = loads.flatMap((load) => {
    const notices: string[] = [];
    const name = `${load.kind || ""} ${load.name || ""}`.toLowerCase();
    if (/(cooker|oven)/.test(name) && load.hours > 5) notices.push(`${load.name}: cooker/oven usage above 5 hours/day is unusual — confirm.`);
    if (/microwave/.test(name) && load.hours > 1) notices.push(`${load.name}: microwave hours are unusually high — confirm cycles.`);
    if (/freezer|fridge/.test(name) && load.usageMode === "ALWAYS_ON" && load.dutyCycle >= 1) notices.push(`${load.name}: continuous 100% compressor duty must be verified.`);
    if (/pump/.test(name) && load.watts > 0 && load.watts < 250) notices.push(`${load.name}: recorded pump wattage is unusually low — confirm nameplate or HP.`);
    if (/\btv\b/.test(name) && load.watts > 1000) notices.push(`${load.name}: TV rating is unusually high — confirm nameplate.`);
    if (number(load.simultaneous) > number(load.qty)) notices.push(`${load.name}: simultaneous quantity cannot exceed installed quantity.`);
    return notices;
  });
  const highImpactLowConfidenceLoads = loads.filter((load) => load.confidence === "LOW" && (MAJOR_LOAD_KINDS.has(load.kind || "") || load.connectedKw >= 0.5));
  const roofReady = clean(input.siteDetails?.panelSpace) !== "No" && !normalized(input.siteDetails?.panelSpace).includes("unsure");
  const heavyShading = normalized(input.siteDetails?.shading).includes("heavy");
  const roofPanelCapacity = number(input.siteDetails?.maxPanelCount) || number(input.siteDetails?.panelCapacity);
  const mpptPvLimitKwp = number(input.electrical?.mpptMaxPvKw);
  const roofCapacityExceeded = roofPanelCapacity > 0 && panelCount > roofPanelCapacity;
  const mpptLimitExceeded = mpptPvLimitKwp > 0 && pvPracticalKwp > mpptPvLimitKwp;
  const siteAccessPending = /pending|not.?accessed/.test(normalized(input.siteDetails?.siteAccess) || normalized(input.electrical?.siteAccess));
  const siteAccessContradiction = Boolean(input.assessmentCompleted) && siteAccessPending;
  const electricalReady = !normalized(input.siteDetails?.supplyType).includes("not confirmed") && !normalized(input.siteDetails?.mainBreakerRating).includes("not confirmed") && !normalized(input.siteDetails?.solarBreakerSlots).includes("not confirmed") && normalized(input.siteDetails?.earthingAvailable) !== "no";
  const technicalReviewReasons = [
    ...(missingCriticalEvidence.length ? [`Missing critical site evidence: ${missingCriticalEvidence.join(", ")}.`] : []),
    ...(supply.includes("three") ? ["Three-phase supply requires phase and protection review."] : []),
    ...(motorLoads.some((load) => load.surgeEstimated) ? ["Motor/compressor surge estimated — technical verification recommended."] : []),
    ...(objective.includes("off-grid") ? ["Off-grid operation requires seasonal autonomy and generator/grid contingency review."] : []),
    ...(kplcAlignment === "SIGNIFICANT_DISCREPANCY" ? ["Appliance load assessment and historical KPLC consumption differ significantly; confirm high-energy loads, seasonal use and unrecorded appliances."] : []),
    ...(heavyShading ? ["Heavy shading invalidates the standard PV production assumption until a shading review is completed."] : []),
    ...(roofCapacityExceeded ? [`The recorded roof capacity (${roofPanelCapacity} panels) is below the required ${panelCount}-panel array.`] : []),
    ...(mpptLimitExceeded ? [`The recorded inverter MPPT PV limit (${mpptPvLimitKwp} kWp) is below the required ${pvPracticalKwp} kWp array.`] : []),
    ...unusualLoads,
  ];
  const capabilities = productCapabilities(input.selectedProduct);
  const phaseMismatch = capabilities.phase === "SINGLE_PHASE" && supply.includes("three");
  const inverterUndersized = capabilities.inverterKw !== null && capabilities.inverterKw < inverterKw;
  const storageOrPvAdjustment = (capabilities.batteryKwh !== null && capabilities.batteryKwh < batteryKwh) || (capabilities.pvKw !== null && capabilities.pvKw < pvPracticalKwp);
  const knownUndersized = inverterUndersized || phaseMismatch;
  const allSpecificationsAvailable = Boolean(input.selectedProduct) && capabilities.inverterKw !== null && capabilities.batteryKwh !== null && capabilities.pvKw !== null && (!supply.includes("three") || capabilities.phase === "THREE_PHASE");
  const productStatus = !input.selectedProduct ? "CUSTOM" : knownUndersized ? "FAIL" : storageOrPvAdjustment ? "ADJUSTED" : allSpecificationsAvailable ? "PASS" : "PARTIAL";
  const productReasons = [
    ...(capabilities.inverterKw !== null ? [`Inverter ${capabilities.inverterKw} kW vs required ${inverterKw} kW.`] : ["Inverter specification is not structured in the catalog record."]),
    ...(capabilities.batteryKwh !== null ? [`Battery ${capabilities.batteryKwh} kWh vs required ${batteryKwh} kWh nominal.`] : ["Battery specification is not structured in the catalog record."]),
    ...(capabilities.pvKw !== null ? [`PV ${capabilities.pvKw} kWp vs practical requirement ${pvPracticalKwp} kWp.`] : ["PV specification is not structured in the catalog record."]),
    ...(phaseMismatch ? ["Selected product is single-phase while the recorded supply is three-phase."] : []),
  ];
  const confidenceDeductions = [
    highImpactLowConfidenceLoads.length * 15,
    missingCriticalEvidence.length * 8,
    kplcAlignment === "SIGNIFICANT_DISCREPANCY" ? 20 : kplcAlignment === "NOT_CONFIRMED" ? 8 : kplcAlignment === "REVIEW_RECOMMENDED" ? 10 : 0,
    motorLoads.some((load) => load.surgeEstimated) ? 12 : 0,
    heavyShading ? 25 : normalized(input.siteDetails?.shading).includes("moderate") ? 12 : 0,
    !roofReady ? 20 : clean(input.siteDetails?.roofWidth) || clean(input.siteDetails?.roofLength) ? 0 : 5,
    !electricalReady ? 15 : 0,
  ].reduce((total, deduction) => total + deduction, 0);
  const confidenceScore = Math.max(0, 100 - confidenceDeductions);
  const sizingConfidence = confidenceScore >= 85 ? "HIGH CONFIDENCE" : confidenceScore >= 65 ? "MEDIUM CONFIDENCE" : "LOW CONFIDENCE — TECHNICAL REVIEW REQUIRED";
  const criticalReadinessIssues = [
    ...(!loads.length ? ["No appliance loads have been recorded."] : []),
    ...(heavyShading ? ["Heavy shading must be modelled before quotation."] : []),
    ...(!roofReady ? ["Panel installation space is not confirmed."] : []),
    ...(normalized(input.siteDetails?.supplyType).includes("not confirmed") ? ["Electrical supply phase is not confirmed."] : []),
    ...(highImpactLowConfidenceLoads.length ? [`High-impact load ratings need confirmation: ${highImpactLowConfidenceLoads.map((load) => load.name).join(", ")}.`] : []),
    ...(kplcAlignment === "SIGNIFICANT_DISCREPANCY" ? ["KPLC and appliance estimates require confirmation."] : []),
    ...(roofCapacityExceeded ? ["The recorded roof capacity cannot fit the required panel array."] : []),
    ...(mpptLimitExceeded ? ["The recorded inverter MPPT limit cannot accept the required PV array."] : []),
  ];
  const assessmentResult = !loads.length ? "NOT READY" : criticalReadinessIssues.length ? "SIZING REVIEW REQUIRED" : technicalReviewReasons.length ? "PRELIMINARY SIZING" : "READY FOR TECHNICAL QUOTATION";
  const customerAssessmentResult = !loads.length
    ? "NOT READY FOR QUOTATION"
    : criticalReadinessIssues.length
      ? "ADDITIONAL TECHNICAL REVIEW REQUIRED"
      : technicalReviewReasons.length
        ? "TECHNICALLY FEASIBLE — SUBJECT TO FINAL VERIFICATION"
        : "READY FOR QUOTATION";
  const recommendationOutcome = productStatus === "PASS"
    ? "STANDARD BETECH PACKAGE"
    : productStatus === "ADJUSTED" || productStatus === "PARTIAL"
      ? "BETECH PACKAGE — ADJUSTED CONFIGURATION"
      : "CUSTOM ENGINEERING QUOTATION REQUIRED";
  const customerOutstandingActions = [
    ...(!loads.length ? [{ category: "REQUIRED BEFORE QUOTATION", message: "Record the appliance loads required for the proposed system." }] : []),
    ...(heavyShading ? [{ category: "REQUIRED BEFORE QUOTATION", message: "Complete a shading review before confirming the final PV layout." }] : []),
    ...(!roofReady ? [{ category: "REQUIRED BEFORE INSTALLATION", message: "Confirm the available panel installation area before installation planning." }] : []),
    ...(missingCriticalEvidence.length ? [{ category: "REQUIRED BEFORE INSTALLATION", message: `Capture or confirm the required site evidence: ${missingCriticalEvidence.join(", ")}.` }] : []),
    ...(normalized(input.siteDetails?.solarBreakerSlots).includes("not confirmed") ? [{ category: "REQUIRED BEFORE INSTALLATION", message: "Confirm solar breaker space and protection design at the main distribution board." }] : []),
    ...(normalized(input.siteDetails?.earthingAvailable) === "no" ? [{ category: "REQUIRED BEFORE INSTALLATION", message: "Provide or improve protective earthing before installation." }] : []),
    ...(highImpactLowConfidenceLoads.length ? [{ category: "REQUIRED BEFORE QUOTATION", message: `Confirm the rating of: ${highImpactLowConfidenceLoads.map((load) => load.name || "recorded major load").join(", ")}.` }] : []),
    ...(kplcAlignment === "NOT_CONFIRMED" ? [{ category: "ADVISORY", message: "Historical KPLC usage has not been independently validated; confirm a bill or token before making energy-offset claims." }] : []),
    ...(kplcAlignment === "SIGNIFICANT_DISCREPANCY" ? [{ category: "REQUIRED BEFORE QUOTATION", message: "Reconcile the appliance assessment with historical KPLC usage before making energy-offset claims." }] : []),
    ...(roofCapacityExceeded ? [{ category: "REQUIRED BEFORE QUOTATION", message: "Revise the panel layout or system configuration because the recorded roof capacity is below the recommended array." }] : []),
    ...(mpptLimitExceeded ? [{ category: "REQUIRED BEFORE QUOTATION", message: "Confirm a compatible inverter MPPT configuration for the recommended PV array." }] : []),
  ];
  const finalSizing = {
    connectedLoad: connectedKw,
    simultaneousPeak: simultaneousPeakKw,
    surgeRequirement: surgeRequirementKw,
    dailyEnergy: dailyKwh,
    essentialBackupEnergy: rawBackupEnergyKwh,
    inverterMinimum: inverterRequiredKw,
    inverterSelected: inverterKw,
    batteryCalculated: calculatedBatteryKwh,
    batterySelected: batteryKwh,
    pvDailyEnergyRequirement: pvDailyEnergyRequirementKwp,
    pvRechargeRequirement: pvRechargeRequirementKwp,
    pvObjectiveRequirement: pvObjectiveRequirementKwp,
    pvRequired: pvRequiredKwp,
    panelWattage: panelWatts,
    panelCount,
    installedPV: pvPracticalKwp,
    expectedProduction: expectedSolarProductionKwh,
    estimatedBackup: expectedBackupHours,
    rechargeWindowHours,
    batteryEnergyToRestoreKwh,
    daytimeEnergyDuringRechargeKwh,
  } as const;
  const largestEnergyConsumers = [...loads].sort((a, b) => b.energyKwh - a.energyKwh).slice(0, 5).map((load) => ({ name: load.name || "Recorded appliance", energyKwh: load.energyKwh, percent: dailyKwh ? load.energyKwh / dailyKwh * 100 : 0 }));
  const largestPeakContributors = [...included].sort((a, b) => b.surgeKw - a.surgeKw).slice(0, 5).map((load) => ({ name: load.name || "Recorded appliance", peakKw: load.connectedKw, surgeKw: load.surgeKw }));
  return {
    assumptions, loads, connectedKw, dailyKwh, dayKwh, nightKwh, continuousKw, simultaneousPeakKw, surgeRequirementKw, inverterRequiredKw, inverterKw,
    rawBackupEnergyKwh, calculatedBatteryKwh, batteryKwh, usableBatteryKwh, expectedBackupHours,
    pvDesignEnergyKwh, pvCalculatedKwp, pvPracticalKwp, panelWatts, panelCount, expectedSolarProductionKwh, solarCoveragePercent,
    pvDailyEnergyRequirementKwp, pvRechargeRequirementKwp, pvObjectiveRequirementKwp, pvRequiredKwp, practicalPvTargetKwp, rechargeWindowHours, batteryEnergyToRestoreKwh, daytimeEnergyDuringRechargeKwh, roofPanelCapacity, mpptPvLimitKwp, roofCapacityExceeded, mpptLimitExceeded, siteAccessContradiction, finalSizing,
    kplcMonthlyKwh, billingDays, kplcDailyKwh, kplcVariancePercent, kplcAlignment,
    evidenceLabels, missingCriticalEvidence, highImpactLowConfidenceLoads, unusualLoads, largestEnergyConsumers, largestPeakContributors,
    sizingConfidence, confidenceScore, criticalReadinessIssues, assessmentResult, customerAssessmentResult, customerOutstandingActions, recommendationOutcome,
    technicalReviewRequired: technicalReviewReasons.length > 0,
    technicalReviewReasons, status: assessmentResult,
    productMatch: { status: productStatus, capabilities, reasons: productReasons },
    loadAdvice: loads.filter((load) => load.energyKwh > 0).map((load) => ({ name: load.name || "Recorded appliance", energyKwh: load.energyKwh, advice: loadAdvice(load, load.energyKwh) })),
  } as const;
}
