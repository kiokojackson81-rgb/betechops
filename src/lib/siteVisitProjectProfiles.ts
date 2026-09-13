import type { QuoteProjectType } from "@/lib/quoteRequests";
import type { SiteVisitReason } from "@/lib/siteVisitShared";

export const SITE_VISIT_PROJECT_OPTIONS: ReadonlyArray<{
  value: QuoteProjectType;
  label: string;
}> = [
  { value: "SOLAR_HOME_SYSTEM", label: "Solar home system" },
  { value: "SOLAR_WATER_PUMP", label: "Solar water pump" },
  { value: "SOLAR_WATER_HEATER", label: "Solar water heater" },
  { value: "BOREHOLE_SOLAR_SYSTEM", label: "Borehole solar system" },
  { value: "COMMERCIAL_SOLAR_SYSTEM", label: "Commercial solar system" },
  { value: "CCTV_PLUS_SOLAR", label: "CCTV and solar backup" },
  { value: "STREET_LIGHTS", label: "Solar street lights" },
  { value: "OTHER", label: "Other technical project" },
];

export const SITE_VISIT_REASON_OPTIONS: ReadonlyArray<{
  value: SiteVisitReason;
  label: string;
}> = [
  { value: "LOAD_ASSESSMENT", label: "Load assessment" },
  { value: "ROOF_INSPECTION", label: "Roof inspection" },
  { value: "PUMP_ASSESSMENT", label: "Pump assessment" },
  { value: "INSTALLATION_PLANNING", label: "Installation planning" },
  { value: "FAULT_DIAGNOSIS", label: "Fault diagnosis" },
  { value: "FINAL_MEASUREMENTS", label: "Final measurements" },
  { value: "QUOTATION_VERIFICATION", label: "Quotation verification" },
  { value: "MAINTENANCE_VISIT", label: "Maintenance visit" },
  { value: "CUSTOMER_CONSULTATION", label: "Customer consultation" },
  { value: "OTHER", label: "Other" },
];

export type ProjectAssessmentField = {
  key: string;
  label: string;
  placeholder?: string;
  type?: "text" | "number" | "textarea";
};

export type SiteVisitProjectProfile = {
  title: string;
  reportTitle: string;
  introduction: string;
  usesLoadSizing: boolean;
  fields: readonly ProjectAssessmentField[];
};

const commonSiteFields: readonly ProjectAssessmentField[] = [
  { key: "siteObjective", label: "Site objective / technician observations", type: "textarea", placeholder: "Record the requested work, site condition and important observations." },
  { key: "existingSystem", label: "Existing system or equipment", placeholder: "None, existing solar, pump brand/model, heater type, etc." },
];

export const SITE_VISIT_PROJECT_PROFILES: Record<QuoteProjectType, SiteVisitProjectProfile> = {
  SOLAR_HOME_SYSTEM: {
    title: "Residential solar assessment",
    reportTitle: "SOLAR PV SITE ASSESSMENT",
    introduction: "Record household loads, backup expectations, roof conditions and installation access.",
    usesLoadSizing: true,
    fields: commonSiteFields,
  },
  COMMERCIAL_SOLAR_SYSTEM: {
    title: "Commercial solar assessment",
    reportTitle: "COMMERCIAL SOLAR SITE ASSESSMENT",
    introduction: "Capture business operating patterns, energy records, critical operations and available installation space.",
    usesLoadSizing: true,
    fields: [
      { key: "businessType", label: "Business or facility type", placeholder: "Shop, hotel, school, workshop, office, factory..." },
      { key: "operatingHours", label: "Operating hours and days", placeholder: "Example: 8am–6pm, Monday–Saturday" },
      { key: "criticalOperations", label: "Critical loads and operations", type: "textarea", placeholder: "Equipment that must continue during an outage." },
      ...commonSiteFields,
    ],
  },
  SOLAR_WATER_HEATER: {
    title: "Solar water heating assessment",
    reportTitle: "SOLAR WATER HEATING SITE ASSESSMENT",
    introduction: "Capture hot-water demand, plumbing, roof position and practical tank or collector installation requirements.",
    usesLoadSizing: false,
    fields: [
      { key: "occupants", label: "People using hot water", type: "number", placeholder: "Example: 6" },
      { key: "dailyHotWaterUse", label: "Estimated daily hot-water use (litres)", type: "number", placeholder: "If known" },
      { key: "existingWaterHeating", label: "Existing water heating", placeholder: "Electric shower, boiler, none..." },
      { key: "tankLocation", label: "Proposed tank location", placeholder: "Roof, utility area, elevated stand..." },
      { key: "plumbingCondition", label: "Plumbing and pressure observations", type: "textarea", placeholder: "Pipework, pressure, mixing valves, drainage and issues found." },
      ...commonSiteFields,
    ],
  },
  SOLAR_WATER_PUMP: {
    title: "Solar water pump assessment",
    reportTitle: "SOLAR WATER PUMP SITE ASSESSMENT",
    introduction: "Capture the water source, pump duty, delivery height, storage and seasonal water requirement.",
    usesLoadSizing: false,
    fields: [
      { key: "waterSource", label: "Water source", placeholder: "River, borehole, well, tank, dam..." },
      { key: "pumpType", label: "Pump type / make / model", placeholder: "Surface, submersible, existing model..." },
      { key: "deliveryHead", label: "Estimated delivery head (m)", type: "number", placeholder: "Vertical lift if known" },
      { key: "dailyWaterNeed", label: "Daily water requirement (litres)", type: "number", placeholder: "If known" },
      { key: "storageAndUse", label: "Storage, irrigation or water-use notes", type: "textarea", placeholder: "Tank size, irrigation area, livestock, household use..." },
      ...commonSiteFields,
    ],
  },
  BOREHOLE_SOLAR_SYSTEM: {
    title: "Borehole solar assessment",
    reportTitle: "BOREHOLE SOLAR SITE ASSESSMENT",
    introduction: "Capture borehole depth, pump information, water demand, storage and delivery requirements.",
    usesLoadSizing: false,
    fields: [
      { key: "boreholeDepth", label: "Borehole depth (m)", type: "number", placeholder: "If known" },
      { key: "staticWaterLevel", label: "Static water level (m)", type: "number", placeholder: "If known" },
      { key: "pumpType", label: "Pump make / model / rating", placeholder: "Submersible pump details" },
      { key: "dailyWaterNeed", label: "Daily water requirement (litres)", type: "number", placeholder: "If known" },
      { key: "storageAndUse", label: "Storage and delivery notes", type: "textarea", placeholder: "Tank size, pipeline, irrigation or livestock use." },
      ...commonSiteFields,
    ],
  },
  CCTV_PLUS_SOLAR: {
    title: "CCTV and solar backup assessment",
    reportTitle: "CCTV AND SOLAR BACKUP ASSESSMENT",
    introduction: "Capture cameras, recording equipment, network devices, desired backup hours and cable routes.",
    usesLoadSizing: true,
    fields: [
      { key: "cameraCount", label: "Number of cameras", type: "number", placeholder: "Example: 16" },
      { key: "recordingEquipment", label: "DVR / NVR and network equipment", placeholder: "Model, channel count, PoE switches..." },
      { key: "backupRequirement", label: "Required backup hours", type: "number", placeholder: "Example: 12" },
      { key: "securityCoverage", label: "Coverage and cable-route notes", type: "textarea", placeholder: "Areas to cover, distances and mounting constraints." },
      ...commonSiteFields,
    ],
  },
  STREET_LIGHTS: {
    title: "Solar street-light assessment",
    reportTitle: "SOLAR STREET-LIGHT SITE ASSESSMENT",
    introduction: "Capture quantities, pole locations, lighting coverage, access and maintenance requirements.",
    usesLoadSizing: false,
    fields: [
      { key: "lightCount", label: "Number of lights / poles", type: "number", placeholder: "Example: 24" },
      { key: "coverageArea", label: "Road, compound or coverage area", placeholder: "Estate road, car park, farm road..." },
      { key: "poleCondition", label: "Existing pole condition / mounting", placeholder: "New poles, existing poles, wall mounts..." },
      { key: "lightingSchedule", label: "Lighting schedule and security needs", type: "textarea", placeholder: "Dusk-to-dawn, motion sensing, priority zones." },
      ...commonSiteFields,
    ],
  },
  OTHER: {
    title: "Technical site assessment",
    reportTitle: "TECHNICAL SITE ASSESSMENT",
    introduction: "Record the equipment, technical issue and field observations so Betech can prepare the appropriate next step.",
    usesLoadSizing: false,
    fields: [
      { key: "projectDescription", label: "Project or technical issue", type: "textarea", placeholder: "Describe what the technician must inspect or diagnose." },
      { key: "requiredOutcome", label: "Required outcome", placeholder: "Repair, quotation, installation plan, advice..." },
      ...commonSiteFields,
    ],
  },
};

export function formatSiteVisitProjectType(value: QuoteProjectType | string | null | undefined) {
  return SITE_VISIT_PROJECT_OPTIONS.find((item) => item.value === value)?.label || "Technical project";
}

export function formatSiteVisitReason(value: SiteVisitReason | string | null | undefined) {
  return SITE_VISIT_REASON_OPTIONS.find((item) => item.value === value)?.label || "Site assessment";
}

export function getSiteVisitProjectProfile(value: QuoteProjectType | string | null | undefined) {
  return SITE_VISIT_PROJECT_PROFILES[(value || "OTHER") as QuoteProjectType] || SITE_VISIT_PROJECT_PROFILES.OTHER;
}
