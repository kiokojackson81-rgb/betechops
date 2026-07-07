import type { QuotePaymentTerms, QuoteWarrantyMode, StoredQuoteLineItem } from "@/lib/quoteProposal";
import { getQuotePaymentTermsLabel } from "@/lib/quoteProposal";
import {
  buildItemDrivenPowerSummary,
  buildWarrantyAiSummary,
  getProjectTypeDefaultSections,
} from "@/lib/quoteProposalSections";

type QuoteProjectTypeForAi =
  | "SOLAR_HOME_SYSTEM"
  | "SOLAR_WATER_PUMP"
  | "SOLAR_WATER_HEATER"
  | "BOREHOLE_SOLAR_SYSTEM"
  | "COMMERCIAL_SOLAR_SYSTEM"
  | "CCTV_PLUS_SOLAR"
  | "STREET_LIGHTS"
  | "OTHER";

export type ShortSolutionSummary = {
  systemSize: string;
  solarCapacity: string;
  batteryCapacity: string;
  inverterCapacity: string;
  installationIncluded: string;
  transportIncluded: string;
  warrantySummary: string;
  supportIncluded: string;
};

export type GeneratedQuotationAiSections = {
  executiveSummary: string;
  projectOverview: string;
  shortSolutionSummary: ShortSolutionSummary;
  keyBenefits: string[];
  whatSystemCanPower: string[];
  scopeOfSupply: string[];
  accessoriesIncluded: string[];
  scopeExclusions: string[];
  deliveryTimeline: string[];
  installationTimeline: string[];
  warrantyRows: Array<{ component: string; warranty: string; notes: string }>;
  afterSalesSupport: string[];
  customerActionItems: string[];
  practicalUsageNote: string;
};

export type QuotationAiInput = {
  projectType?: string | null;
  quoteTitle?: string | null;
  items: StoredQuoteLineItem[];
  total: number;
  paymentTerms?: QuotePaymentTerms | null;
  warrantyMode?: QuoteWarrantyMode | null;
  fullSystemWarranty?: string | null;
  customWarranty?: string | null;
  quoteMessage?: string | null;
  customerNotes?: string | null;
  customerLocation?: string | null;
  projectOverview?: string | null;
  whatPriceIncludes?: string | null;
  whatItCanPower?: string | null;
  deliveryTimeline?: string | null;
  installationTimeline?: string | null;
  afterSalesSupport?: string | null;
  importantNotes?: string | null;
  scopeExclusions?: string | null;
  aiWarrantySummary?: string | null;
};

function splitParagraphLines(value?: string | null) {
  return String(value || "")
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function uniqueLines(items: string[]) {
  return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));
}

function compactNumber(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "";
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(1).replace(/\.0$/, "");
}

function parseLargestToken(value: string, unitPattern: RegExp) {
  const matches = [...String(value || "").matchAll(unitPattern)];
  if (!matches.length) return null;
  return matches
    .map((match) => Number(match[1]))
    .filter((amount) => Number.isFinite(amount))
    .sort((left, right) => right - left)[0] ?? null;
}

function parseWattValue(value: string) {
  return parseLargestToken(value, /\b(\d+(?:\.\d+)?)\s*w\b/gi);
}

function parseKwValue(value: string) {
  return parseLargestToken(value, /\b(\d+(?:\.\d+)?)\s*kw\b/gi) || parseLargestToken(value, /\b(\d+(?:\.\d+)?)\s*kva\b/gi);
}

function parseKwhValue(value: string) {
  return parseLargestToken(value, /\b(\d+(?:\.\d+)?)\s*kwh\b/gi);
}

function parseAhValue(value: string) {
  return parseLargestToken(value, /\b(\d+(?:\.\d+)?)\s*ah\b/gi);
}

function formatKw(valueInWatts: number) {
  if (!Number.isFinite(valueInWatts) || valueInWatts <= 0) return "";
  if (valueInWatts >= 1000) return `${compactNumber(valueInWatts / 1000)} kW`;
  return `${compactNumber(valueInWatts)} W`;
}

function formatKwh(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "";
  return `${compactNumber(value)} kWh`;
}

function shortItemName(itemName: string) {
  const cleaned = String(itemName || "").replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  const beforeColon = cleaned.split(":")[0]?.trim() || cleaned;
  const beforeDash = beforeColon.split(" - ")[0]?.trim() || beforeColon;
  if (beforeDash.length <= 80) return beforeDash;
  return `${beforeDash.slice(0, 77).trimEnd()}...`;
}

function normalizeProjectType(projectType?: string | null): QuoteProjectTypeForAi {
  const normalized = String(projectType || "").trim().toUpperCase();
  switch (normalized) {
    case "SOLAR_HOME_SYSTEM":
    case "SOLAR_WATER_PUMP":
    case "SOLAR_WATER_HEATER":
    case "BOREHOLE_SOLAR_SYSTEM":
    case "COMMERCIAL_SOLAR_SYSTEM":
    case "CCTV_PLUS_SOLAR":
    case "STREET_LIGHTS":
      return normalized;
    default:
      return "OTHER";
  }
}

function classifySolutionKind(input: QuotationAiInput, projectType: QuoteProjectTypeForAi) {
  const names = input.items.map((item) => item.itemName.toLowerCase()).join(" ");
  if (projectType === "SOLAR_WATER_PUMP" || /\bpump\b/.test(names)) return "SOLAR_WATER_PUMP";
  if (projectType === "SOLAR_WATER_HEATER" || /\bwater heater|geyser\b/.test(names)) return "SOLAR_WATER_HEATER";
  if (/\b(full kit|solar kit|starter kit)\b/.test(names) || /\b(full kit|solar kit)\b/.test(String(input.quoteTitle || "").toLowerCase())) {
    const panelWatts = input.items.map((item) => parseWattValue(item.itemName) || 0).sort((a, b) => b - a)[0] || 0;
    if (panelWatts > 0 && panelWatts <= 600) return "SMALL_SOLAR_KIT";
  }
  if (/\bbattery\b/.test(names) && !/\bpanel\b/.test(names) && !/\binverter\b/.test(names)) return "BATTERY_BACKUP";
  if (/\binverter\b/.test(names) && !/\bpanel\b/.test(names) && !/\bbattery\b/.test(names)) return "INVERTER_ONLY";
  if (projectType === "COMMERCIAL_SOLAR_SYSTEM" || /\bcommercial|office|shop|business|school|hospital\b/.test(names)) return "COMMERCIAL_SOLAR_SYSTEM";
  if (projectType === "BOREHOLE_SOLAR_SYSTEM" || /\bborehole\b/.test(names)) return "BOREHOLE_SOLAR_SYSTEM";
  if (projectType === "CCTV_PLUS_SOLAR" || /\bcctv|camera|nvr|dvr\b/.test(names)) return "CCTV_PLUS_SOLAR";
  if (projectType === "STREET_LIGHTS" || /\bstreet light\b/.test(names)) return "STREET_LIGHTS";
  return "SOLAR_HOME_SYSTEM";
}

function buildWarrantyRows(input: QuotationAiInput) {
  const fallbackWarranty =
    input.warrantyMode === "FULL_SYSTEM"
      ? input.fullSystemWarranty || "Covered under full system warranty"
      : input.warrantyMode === "CUSTOM"
        ? input.customWarranty || "Custom warranty"
        : "Manufacturer warranty";

  return input.items.map((item) => ({
    component: shortItemName(item.itemName),
    warranty: item.warranty || item.defaultWarranty || fallbackWarranty,
    notes:
      item.warrantyNotes ||
      (/panel/i.test(item.itemName)
        ? "Manufacturer performance coverage"
        : /battery|lithium|gel|agm/i.test(item.itemName)
          ? "Manufacturer battery coverage"
          : /inverter|hybrid/i.test(item.itemName)
            ? "Manufacturer equipment coverage"
            : /install|commission|workmanship/i.test(item.itemName)
              ? "Installation workmanship"
              : "Standard equipment coverage"),
  }));
}

function parseSummaryMetric(value: string, pattern: RegExp) {
  const match = String(value || "").match(pattern);
  return match ? Number(match[1]) || 0 : 0;
}

function buildPracticalPowerLines(summary: ShortSolutionSummary, kind: string) {
  const inverterKw = parseSummaryMetric(summary.inverterCapacity, /(\d+(?:\.\d+)?)\s*kw/i);
  const solarKw = parseSummaryMetric(summary.solarCapacity, /(\d+(?:\.\d+)?)\s*kw/i);
  const solarW = parseSummaryMetric(summary.solarCapacity, /(\d+(?:\.\d+)?)\s*w\b/i);
  const batteryKwh = parseSummaryMetric(summary.batteryCapacity, /(\d+(?:\.\d+)?)\s*kwh/i);
  const batteryAh = parseSummaryMetric(summary.batteryCapacity, /(\d+(?:\.\d+)?)\s*ah/i);
  const effectiveLevel = Math.max(
    inverterKw,
    solarKw,
    solarW ? solarW / 1000 : 0,
    batteryKwh,
    batteryAh >= 200 ? 1.5 : batteryAh >= 100 ? 0.8 : 0,
  );

  if (kind === "SOLAR_WATER_PUMP") {
    return [
      "Water pumping to storage tank",
      "Farm or home water transfer",
      "Livestock watering",
      "Daytime irrigation support",
      "Borehole or shallow-well pumping subject to site conditions",
    ];
  }

  if (kind === "BATTERY_BACKUP") {
    return effectiveLevel >= 4
      ? [
          "House lighting",
          "TV and decoder",
          "Wi-Fi router",
          "Phone and laptop charging",
          "Fridge backup for selected hours",
          "CCTV and modem support",
        ]
      : [
          "Lights during blackout",
          "TV",
          "Wi-Fi router",
          "Phone charging",
          "Small decoder or radio",
        ];
  }

  if (kind === "INVERTER_ONLY") {
    return effectiveLevel >= 5
      ? [
          "Lighting circuits",
          "TVs and decoder",
          "Fridge",
          "Wi-Fi router",
          "Laptops and office devices",
          "Selected daytime socket loads",
        ]
      : [
          "Lights",
          "TV",
          "Wi-Fi router",
          "Phone charging",
          "Small home backup loads",
        ];
  }

  if (effectiveLevel >= 10) {
    return [
      "Full house lighting",
      "Multiple TVs and decoder",
      "Fridges and freezers",
      "Wi-Fi router and CCTV",
      "Washing machine",
      "Microwave in controlled daytime use",
      "Water pump where correctly sized",
      "Laptops, phones, and office equipment",
      "Small business daytime loads",
      "Electric fence and security systems",
    ];
  }

  if (effectiveLevel >= 5) {
    return [
      "Home lighting",
      "TV and decoder",
      "Fridge",
      "Wi-Fi router",
      "Phone and laptop charging",
      "CCTV",
      "Small water pump where correctly sized",
      "Moderate daily home backup use",
    ];
  }

  if (effectiveLevel >= 1.5) {
    return [
      "LED bulbs",
      "TV",
      "Wi-Fi router",
      "Phone charging",
      "Laptop charging",
      "Small fridge depending on usage pattern",
    ];
  }

  return [
    "LED bulbs",
    "Phone charging",
    "Wi-Fi router",
    "Small TV or decoder depending on kit rating",
    "Basic night lighting backup",
  ];
}

function buildStandardWarrantyNotes(input: QuotationAiInput) {
  const notes = [
    "Warranty applies under normal use, correct installation, and manufacturer operating conditions.",
    "Warranty does not cover misuse, accidental damage, unauthorized modification, or force majeure events.",
  ];

  if (input.warrantyMode === "FULL_SYSTEM") {
    notes.push("Full-system warranty is subject to the approved equipment, workmanship, and support scope in this quotation.");
  } else if (input.warrantyMode === "CUSTOM" && input.customWarranty?.trim()) {
    notes.push(input.customWarranty.trim());
  }

  return uniqueLines(notes);
}

function buildSummary(input: QuotationAiInput, kind: string) {
  const panelItems = input.items.filter((item) => /panel/i.test(item.itemName));
  const batteryItems = input.items.filter((item) => /battery|lithium|lifepo4|gel|agm|kwh|ah/i.test(item.itemName));
  const inverterItems = input.items.filter((item) => /inverter|hybrid/i.test(item.itemName));
  const panelCount = panelItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const solarCapacityWatts = panelItems.reduce((sum, item) => {
    const watts = parseWattValue(item.itemName);
    return watts ? sum + watts * Number(item.quantity || 0) : sum;
  }, 0);
  const topPanelWatt = panelItems.map((item) => parseWattValue(item.itemName) || 0).sort((a, b) => b - a)[0] || 0;
  const inverterKw = inverterItems.map((item) => parseKwValue(item.itemName) || 0).sort((a, b) => b - a)[0] || parseKwValue(input.quoteTitle || "") || 0;
  const batteryKwh = batteryItems.reduce((sum, item) => {
    const kwh = parseKwhValue(item.itemName);
    return kwh ? sum + kwh * Number(item.quantity || 0) : sum;
  }, 0);
  const batteryAh = batteryItems.map((item) => parseAhValue(item.itemName) || 0).sort((a, b) => b - a)[0] || 0;
  const batteryType =
    batteryItems[0]?.itemName && /lithium/i.test(batteryItems[0].itemName)
      ? "Lithium"
      : batteryItems[0]?.itemName && /gel|agm/i.test(batteryItems[0].itemName)
        ? "Deep cycle"
        : batteryItems.length
          ? "Included in package"
          : "Selected separately";
  const installationIncluded =
    input.items.some((item) => /install|commission|workmanship|fitting|programming/i.test(item.itemName)) ||
    Boolean(splitParagraphLines(input.installationTimeline).length)
      ? "Included"
      : "Available on request";
  const transportIncluded =
    input.items.some((item) => /transport|delivery|freight|logistics/i.test(item.itemName)) ||
    Boolean(splitParagraphLines(input.deliveryTimeline).length)
      ? "Included"
      : "Delivery arranged as agreed";

  const systemSizeValue = parseKwValue(input.quoteTitle || "");
  let systemSize = systemSizeValue ? `${compactNumber(systemSizeValue)} kW Solar System` : "";
  if (!systemSize && kind === "SMALL_SOLAR_KIT") {
    if (topPanelWatt) systemSize = `${compactNumber(topPanelWatt)}W Solar Kit`;
    else systemSize = "Starter solar kit";
  }
  if (!systemSize && kind === "BATTERY_BACKUP") systemSize = "Battery backup package";
  if (!systemSize && kind === "INVERTER_ONLY") systemSize = "Inverter power solution";
  if (!systemSize && kind === "SOLAR_WATER_PUMP") systemSize = "Solar water pumping solution";
  if (!systemSize && kind === "SOLAR_WATER_HEATER") systemSize = "Solar water heating solution";
  if (!systemSize) systemSize = "Engineered solar solution";

  let solarCapacity = "";
  if (solarCapacityWatts > 0) solarCapacity = `${formatKw(solarCapacityWatts)}${panelCount ? ` (${panelCount} x panels)` : ""}`;
  else if (kind === "SMALL_SOLAR_KIT" && topPanelWatt > 0) solarCapacity = `${compactNumber(topPanelWatt)}W Solar Panel`;
  else if (panelItems.length) solarCapacity = "Included in selected kit";
  else if (kind === "BATTERY_BACKUP" || kind === "INVERTER_ONLY") solarCapacity = "Solar panel not included in this option";
  else solarCapacity = "Solar components included in final package";

  let batteryCapacity = "";
  if (batteryKwh > 0) batteryCapacity = `${formatKwh(batteryKwh)} ${batteryType}`.trim();
  else if (batteryAh > 0) batteryCapacity = `${compactNumber(batteryAh)}Ah ${batteryType}`.trim();
  else if (batteryItems.length) batteryCapacity = "Battery included in kit package";
  else if (kind === "INVERTER_ONLY" || kind === "SOLAR_WATER_PUMP" || kind === "SOLAR_WATER_HEATER") batteryCapacity = "Not part of this configuration";
  else batteryCapacity = "Battery optional depending on backup requirement";

  let inverterCapacity = "";
  if (inverterKw > 0) inverterCapacity = `${compactNumber(inverterKw)}kW ${/hybrid/i.test(inverterItems[0]?.itemName || "") ? "Hybrid Inverter" : "Inverter"}`.trim();
  else if (inverterItems.length) inverterCapacity = "Included in selected package";
  else if (kind === "SMALL_SOLAR_KIT") inverterCapacity = "Included where applicable";
  else if (kind === "BATTERY_BACKUP") inverterCapacity = "Use with existing inverter or backup setup";
  else inverterCapacity = "Matched to final load profile";

  return {
    systemSize,
    solarCapacity,
    batteryCapacity,
    inverterCapacity,
    installationIncluded,
    transportIncluded,
    warrantySummary:
      input.warrantyMode === "FULL_SYSTEM"
        ? "Full system warranty"
        : input.warrantyMode === "CUSTOM"
          ? "Custom warranty"
          : "Per-item manufacturer warranty",
    supportIncluded: "Technical support included",
  } satisfies ShortSolutionSummary;
}

function linesForKind(kind: string, input: QuotationAiInput) {
  switch (kind) {
    case "SMALL_SOLAR_KIT":
      return {
        power: [
          "DC bulbs",
          "Phone charging",
          "Small radio",
          "Small TV depending on kit rating",
          "Wi-Fi router",
          "Basic lighting backup",
        ],
        benefits: [
          "Affordable starter solar solution",
          "Suitable for basic lighting and charging",
          "Simple setup and easy to use",
          "Low-maintenance daily backup option",
          "Good for rural homes, kiosks, shops, or backup lighting",
        ],
        scope: [
          "Supply of listed kit components",
          "Basic setup guidance and handover support",
          "Delivery arrangement as agreed",
          "Warranty support on included items",
        ],
        usage: "Best suited for light loads, charging, and essential backup rather than heavy household appliances.",
      };
    case "SOLAR_WATER_PUMP":
      return {
        power: [
          "Water pumping to storage tanks",
          "Irrigation use depending on pump rating",
          "Livestock water supply",
          "Domestic water transfer",
          "Borehole or shallow well pumping subject to site head",
        ],
        benefits: [
          "Reduces fuel and grid running cost",
          "Reliable daytime water pumping",
          "Suitable for farms, homes, and institutions",
          "Low operating maintenance",
        ],
        scope: [
          "Supply of solar pump equipment",
          "Pump controller and solar components",
          "Testing and commissioning support",
          "Basic operator guidance",
        ],
        usage: "Final pumping performance depends on borehole depth, static water level, discharge head, and pipe run.",
      };
    case "BATTERY_BACKUP":
      return {
        power: [
          "Backup during power outages",
          "Lighting circuits",
          "TV and router support",
          "Phone and laptop charging",
          "Support for approved inverter-connected loads",
        ],
        benefits: [
          "Improves backup autonomy",
          "Supports cleaner and quieter backup power",
          "Suitable for homes, shops, and offices",
          "Expandable depending on inverter compatibility",
        ],
        scope: [
          "Supply of selected battery bank",
          "Battery integration guidance",
          "Testing and commissioning support where included",
          "Warranty documentation on supplied units",
        ],
        usage: "Backup duration depends on total connected load, inverter efficiency, and battery operating condition.",
      };
    case "INVERTER_ONLY":
      return {
        power: [
          "Lighting and socket loads",
          "TV and entertainment devices",
          "Fridge depending on inverter rating",
          "Office devices and router",
          "Use with approved battery or solar input configuration",
        ],
        benefits: [
          "Improves power quality and control",
          "Supports future battery or solar expansion",
          "Suitable for backup and hybrid upgrades",
          "Good for home and business applications",
        ],
        scope: [
          "Supply of selected inverter",
          "Basic installation guidance or installation works where included",
          "Testing and commissioning support",
          "Warranty support",
        ],
        usage: "Actual supported appliances depend on inverter size, surge requirement, and connected battery or solar source.",
      };
    case "COMMERCIAL_SOLAR_SYSTEM":
    case "BOREHOLE_SOLAR_SYSTEM":
      return {
        power: [
          "Full business lighting",
          "Fridges and freezers",
          "Office equipment",
          "CCTV and router",
          "Water pump subject to rating",
          "Phones, laptops, and daily business loads",
          "Critical backup circuits",
        ],
        benefits: [
          "Reduces electricity operating cost",
          "Improves power reliability for business continuity",
          "Scalable for growing commercial demand",
          "Supports daytime solar savings and outage backup",
        ],
        scope: [
          "Supply of all listed commercial solar components",
          "Transport, installation, testing, and commissioning where included",
          "Customer handover and operating guidance",
          "Warranty and after-sales support framework",
        ],
        usage: "System performance depends on appliance diversity, simultaneous loading, and approved operational priority.",
      };
    default:
      return {
        power: [
          "Full house lighting",
          "TVs",
          "Fridges and freezers",
          "Washing machine",
          "Water pump",
          "CCTV",
          "Wi-Fi / router",
          "Microwave",
          "Electric fence",
          "Office equipment",
          "Phones and laptops",
          "Small business loads",
        ],
        benefits: [
          "Reliable solar backup and daytime support",
          "Supports essential residential and mixed-use loads",
          "Designed for long-term energy savings",
          "Professional installation and support structure",
        ],
        scope: [
          "Supply of all listed solar components",
          "Transport and professional installation where included",
          "Testing, commissioning, and customer handover",
          "Warranty documentation and after-sales support",
        ],
        usage: buildItemDrivenPowerSummary(input.items, normalizeProjectType(input.projectType)),
      };
  }
}

export function generateQuotationAiSections(input: QuotationAiInput): GeneratedQuotationAiSections {
  const projectType = normalizeProjectType(input.projectType);
  const defaults = getProjectTypeDefaultSections(projectType);
  const kind = classifySolutionKind(input, projectType);
  const summary = buildSummary(input, kind);
  const kindLines = linesForKind(kind, input);
  const practicalPowerLines = buildPracticalPowerLines(summary, kind);
  const warrantyRows = buildWarrantyRows(input);

  const executiveSummary =
    `Based on the reviewed customer requirement, we are pleased to submit a professional proposal for ${String(input.quoteTitle || summary.systemSize).trim()}. This solution is structured to provide practical performance, clear installation scope, and dependable after-sales support.`;

  const projectOverview =
    input.projectOverview?.trim() ||
    defaults.projectOverview ||
    executiveSummary;

  const scopeOfSupply = uniqueLines([
    ...splitParagraphLines(input.whatPriceIncludes),
    ...kindLines.scope,
    ...splitParagraphLines(defaults.whatPriceIncludes),
  ]).slice(0, 6);

  const accessoriesIncluded = uniqueLines(
    input.items
      .filter((item) => /mc4|lug|rail|breaker|cable|trunking|conduit|connector|clip|tie|label|protection/i.test(item.itemName))
      .map((item) => shortItemName(item.itemName)),
  ).slice(0, 8);

  const whatSystemCanPower = uniqueLines([
    ...splitParagraphLines(input.whatItCanPower),
    ...practicalPowerLines,
    ...kindLines.power,
  ]).slice(0, 10);

  const keyBenefits = uniqueLines(kindLines.benefits).slice(0, 6);

  const deliveryTimeline = uniqueLines([
    ...splitParagraphLines(input.deliveryTimeline),
    "Day 0 - Order confirmation and scope review",
    "Day 1 - Equipment preparation and dispatch planning",
    "Day 2 - Delivery to site or pickup arrangement",
  ]).slice(0, 4);

  const installationTimeline = uniqueLines([
    ...splitParagraphLines(input.installationTimeline),
    ...(summary.installationIncluded === "Included"
      ? [
          "Day 3 - Installation works and system setup",
          "Day 4 - Testing, commissioning, and customer handover",
        ]
      : ["Installation support arranged based on customer requirement"]),
  ]).slice(0, 4);

  const scopeExclusions = uniqueLines([
    ...splitParagraphLines(input.scopeExclusions),
    "Major civil works unless expressly listed",
    "Unplanned structural modifications",
    "Extra accessories outside the approved BOQ",
  ]).slice(0, 5);

  const afterSalesSupport = uniqueLines([
    ...splitParagraphLines(input.afterSalesSupport),
    ...splitParagraphLines(defaults.afterSalesSupport),
  ]).slice(0, 7);

  const customerActionItems = uniqueLines([
    "Confirm the final product scope and commercial approval.",
    "Share exact site location and preferred installation date.",
    "Arrange site access and any required pre-installation readiness.",
    `Confirm the preferred payment structure: ${getQuotePaymentTermsLabel(input.paymentTerms)}.`,
  ]).slice(0, 5);

  return {
    executiveSummary,
    projectOverview,
    shortSolutionSummary: summary,
    keyBenefits,
    whatSystemCanPower,
    scopeOfSupply,
    accessoriesIncluded,
    scopeExclusions,
    deliveryTimeline,
    installationTimeline,
    warrantyRows,
    afterSalesSupport,
    customerActionItems,
    practicalUsageNote:
      kind === "SOLAR_HOME_SYSTEM" || kind === "COMMERCIAL_SOLAR_SYSTEM"
        ? "Actual supported appliances depend on simultaneous usage, inverter surge handling, solar production, and battery reserve discipline."
        : kindLines.usage,
  };
}

function looksWeak(value?: string | null) {
  const text = String(value || "").trim().toLowerCase();
  if (!text) return true;
  return [
    "as quoted",
    "custom engineered",
    "battery included as quoted",
    "this solution is intended to support the requested customer loads",
    "this solution is selected to support the stated customer loads",
  ].some((needle) => text.includes(needle));
}

export function applyQuotationAiEnrichment(input: QuotationAiInput) {
  const generated = generateQuotationAiSections(input);
  const defaults = getProjectTypeDefaultSections(normalizeProjectType(input.projectType));
  const aiWarrantySummary = uniqueLines([
    ...splitParagraphLines(input.aiWarrantySummary),
    ...splitParagraphLines(buildWarrantyAiSummary(input.items, (input.warrantyMode || "PER_ITEM") as QuoteWarrantyMode)),
    ...buildStandardWarrantyNotes(input),
  ]).join("\n");

  return {
    generated,
    projectOverview: looksWeak(input.projectOverview) ? generated.projectOverview : input.projectOverview?.trim() || generated.projectOverview,
    whatPriceIncludes:
      looksWeak(input.whatPriceIncludes) ? generated.scopeOfSupply.join("\n") : input.whatPriceIncludes?.trim() || generated.scopeOfSupply.join("\n") || defaults.whatPriceIncludes,
    whatItCanPower:
      looksWeak(input.whatItCanPower) ? generated.whatSystemCanPower.join("\n") : input.whatItCanPower?.trim() || generated.whatSystemCanPower.join("\n") || defaults.whatItCanPower,
    deliveryTimeline:
      looksWeak(input.deliveryTimeline) ? generated.deliveryTimeline.join("\n") : input.deliveryTimeline?.trim() || generated.deliveryTimeline.join("\n") || defaults.deliveryTimeline,
    installationTimeline:
      looksWeak(input.installationTimeline) ? generated.installationTimeline.join("\n") : input.installationTimeline?.trim() || generated.installationTimeline.join("\n") || defaults.installationTimeline,
    afterSalesSupport:
      looksWeak(input.afterSalesSupport) ? generated.afterSalesSupport.join("\n") : input.afterSalesSupport?.trim() || generated.afterSalesSupport.join("\n") || defaults.afterSalesSupport,
    importantNotes: uniqueLines([
      ...splitParagraphLines(input.importantNotes),
      generated.practicalUsageNote,
      ...generated.customerActionItems,
    ]).join("\n"),
    scopeExclusions:
      looksWeak(input.scopeExclusions) ? generated.scopeExclusions.join("\n") : input.scopeExclusions?.trim() || generated.scopeExclusions.join("\n") || defaults.scopeExclusions,
    aiWarrantySummary,
  };
}
