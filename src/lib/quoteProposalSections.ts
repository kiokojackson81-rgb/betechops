import type { QuoteProjectType } from "@/lib/quoteRequests";
import type { QuoteWarrantyMode, StoredQuoteLineItem } from "@/lib/quoteProposal";

export type QuoteSectionVisibility = {
  projectOverview: boolean;
  whatPriceIncludes: boolean;
  whatItCanPower: boolean;
  deliveryAndInstallation: boolean;
  warranty: boolean;
  afterSalesSupport: boolean;
  scopeExclusions: boolean;
  importantNotes: boolean;
  similarProjects: boolean;
  termsAndConditions: boolean;
};

export type QuoteProposalSections = {
  projectOverview: string;
  whatPriceIncludes: string;
  whatItCanPower: string;
  deliveryTimeline: string;
  installationTimeline: string;
  afterSalesSupport: string;
  importantNotes: string;
  scopeExclusions: string;
  similarProjects: string;
  termsAndConditions: string;
  preparedByDetails: string;
  companyLegalDetails: string;
  projectReferenceLinks: string;
  visibility: QuoteSectionVisibility;
};

const DEFAULT_VISIBILITY: QuoteSectionVisibility = {
  projectOverview: true,
  whatPriceIncludes: true,
  whatItCanPower: true,
  deliveryAndInstallation: true,
  warranty: true,
  afterSalesSupport: true,
  scopeExclusions: true,
  importantNotes: true,
  similarProjects: false,
  termsAndConditions: true,
};

export const QUOTATION_COMPANY_DETAILS = [
  "BETECH SOLAR SOLUTION LIMITED",
  "Business Registration No.: BN-X2CLZGP5",
  "KRA PIN: P052448598C",
  "Location: Pramukh Plaza, 3rd Floor, Shop No. 3, Nairobi CBD",
  "Phone: 0722 151 083 / 0705 663 175",
  "Email: info@betech.co.ke",
  "Website: www.betech.co.ke",
].join("\n");

const DEFAULT_DELIVERY_TIMELINE =
  [
    "Day 0 - Order confirmation and commercial approval",
    "Day 1 - Equipment preparation and dispatch planning",
    "Day 2 - Delivery to site or agreed collection point",
  ].join("\n");

const DEFAULT_INSTALLATION_TIMELINE =
  [
    "Day 2 - Site readiness confirmation and installation scheduling",
    "Day 3 - Professional installation and system setup",
    "Day 4 - Testing, commissioning, and customer handover",
  ].join("\n");

const DEFAULT_AFTER_SALES_SUPPORT = [
  "Telephone and WhatsApp technical support",
  "Remote troubleshooting assistance",
  "Warranty claim support",
  "User training and operating guidance",
  "Genuine spare parts support",
  "Professional maintenance advice",
  "Nationwide technical assistance",
].join("\n");

const DEFAULT_IMPORTANT_NOTES = [
  "Prices are subject to stock availability at the time of order confirmation.",
  "Any civil works, trenching, special fabrication, or extra accessories not listed in this quotation are billed separately if required.",
  "Delivery and installation timelines may change where site readiness or access conditions require additional work.",
].join("\n");

const DEFAULT_SCOPE_EXCLUSIONS = [
  "Major civil works unless expressly quoted",
  "Structural fabrication not specifically listed in the BOQ",
  "KPLC / utility approvals unless expressly quoted",
  "Any third-party equipment not supplied by Betech Solar Solutions",
].join("\n");

const DEFAULT_TERMS = [
  "Quotation validity is subject to confirmation at the time of order placement.",
  "Standard payment options are full payment before installation, 30% deposit with balance after installation, or full payment after installation where approved by management.",
  "Warranty applies under normal use, correct installation, and manufacturer operating conditions.",
].join("\n");

const DEFAULT_PREPARED_BY =
  "Prepared by Betech Solar Solutions Quotations Team\nTechnical sales: jackson@betech.co.ke\nSales desk: 0722 151 083";

const DEFAULT_SIMILAR_PROJECTS =
  "View a similar installation: Paste TikTok, YouTube, or website project link here.";

const DEFAULT_PROJECT_REFERENCES =
  [
    "View our recent projects here : https://www.tiktok.com/@betechsolarprojects",
    "View all our products here : https://www.betech.co.ke/",
    "Email : info@betech.co.ke",
    "Technical sales : jackson@betech.co.ke",
  ].join("\n");

function normalizeProjectTypeLabel(projectType: QuoteProjectType) {
  return projectType.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

export function getProjectTypeDefaultSections(projectType: QuoteProjectType): QuoteProposalSections {
  const label = normalizeProjectTypeLabel(projectType);

  if (projectType === "SOLAR_WATER_PUMP") {
    return {
      projectOverview:
        "This quotation covers the supply and setup of a solar water pumping solution sized for your stated water requirements, pumping head, and site conditions.",
      whatPriceIncludes:
        "The quoted price includes the listed pump equipment, solar components, standard electrical accessories, installation support, testing, commissioning, and handover guidance where applicable.",
      whatItCanPower:
        "This solution is intended to pump water for domestic, irrigation, livestock, borehole, or storage-tank applications based on the final approved sizing.",
      deliveryTimeline: DEFAULT_DELIVERY_TIMELINE,
      installationTimeline: DEFAULT_INSTALLATION_TIMELINE,
      afterSalesSupport: DEFAULT_AFTER_SALES_SUPPORT,
      importantNotes: DEFAULT_IMPORTANT_NOTES,
      scopeExclusions: DEFAULT_SCOPE_EXCLUSIONS,
      similarProjects: DEFAULT_SIMILAR_PROJECTS,
      termsAndConditions: DEFAULT_TERMS,
      preparedByDetails: DEFAULT_PREPARED_BY,
      companyLegalDetails: QUOTATION_COMPANY_DETAILS,
      projectReferenceLinks: DEFAULT_PROJECT_REFERENCES,
      visibility: { ...DEFAULT_VISIBILITY, similarProjects: true },
    };
  }

  if (projectType === "SOLAR_WATER_HEATER") {
    return {
      projectOverview:
        "This quotation covers the supply and installation of a solar water heating solution selected for your hot-water usage profile and site requirements.",
      whatPriceIncludes:
        "The quoted price includes the listed solar water heating equipment, standard accessories, installation, testing, and handover guidance.",
      whatItCanPower:
        "This solution is intended to provide reliable hot water for domestic or commercial use based on the selected capacity and installation environment.",
      deliveryTimeline: DEFAULT_DELIVERY_TIMELINE,
      installationTimeline: DEFAULT_INSTALLATION_TIMELINE,
      afterSalesSupport: DEFAULT_AFTER_SALES_SUPPORT,
      importantNotes: DEFAULT_IMPORTANT_NOTES,
      scopeExclusions: DEFAULT_SCOPE_EXCLUSIONS,
      similarProjects: DEFAULT_SIMILAR_PROJECTS,
      termsAndConditions: DEFAULT_TERMS,
      preparedByDetails: DEFAULT_PREPARED_BY,
      companyLegalDetails: QUOTATION_COMPANY_DETAILS,
      projectReferenceLinks: DEFAULT_PROJECT_REFERENCES,
      visibility: { ...DEFAULT_VISIBILITY, similarProjects: true },
    };
  }

  if (projectType === "BOREHOLE_SOLAR_SYSTEM") {
    return {
      projectOverview:
        "This quotation covers a borehole solar power solution intended to support pumping loads and related borehole operations using high-efficiency solar equipment.",
      whatPriceIncludes:
        "The quoted price includes the listed solar equipment, borehole-related electrical accessories, installation support, testing, commissioning, and operator briefing.",
      whatItCanPower:
        "This system is intended for borehole pumping and associated control loads, subject to final load confirmation and site conditions.",
      deliveryTimeline: DEFAULT_DELIVERY_TIMELINE,
      installationTimeline: DEFAULT_INSTALLATION_TIMELINE,
      afterSalesSupport: DEFAULT_AFTER_SALES_SUPPORT,
      importantNotes: DEFAULT_IMPORTANT_NOTES,
      scopeExclusions: DEFAULT_SCOPE_EXCLUSIONS,
      similarProjects: DEFAULT_SIMILAR_PROJECTS,
      termsAndConditions: DEFAULT_TERMS,
      preparedByDetails: DEFAULT_PREPARED_BY,
      companyLegalDetails: QUOTATION_COMPANY_DETAILS,
      projectReferenceLinks: DEFAULT_PROJECT_REFERENCES,
      visibility: { ...DEFAULT_VISIBILITY, similarProjects: true },
    };
  }

  if (projectType === "COMMERCIAL_SOLAR_SYSTEM") {
    return {
      projectOverview:
        "This quotation covers a commercial solar power solution sized to reduce operating costs and improve power reliability for your business loads.",
      whatPriceIncludes:
        "The quoted price includes the listed power equipment, standard accessories, installation works, testing, commissioning, and handover support.",
      whatItCanPower:
        "This system is intended for business loads such as lighting, refrigeration, office electronics, routers, security systems, POS equipment, and other approved commercial appliances.",
      deliveryTimeline: DEFAULT_DELIVERY_TIMELINE,
      installationTimeline: DEFAULT_INSTALLATION_TIMELINE,
      afterSalesSupport: DEFAULT_AFTER_SALES_SUPPORT,
      importantNotes: DEFAULT_IMPORTANT_NOTES,
      scopeExclusions: DEFAULT_SCOPE_EXCLUSIONS,
      similarProjects: DEFAULT_SIMILAR_PROJECTS,
      termsAndConditions: DEFAULT_TERMS,
      preparedByDetails: DEFAULT_PREPARED_BY,
      companyLegalDetails: QUOTATION_COMPANY_DETAILS,
      projectReferenceLinks: DEFAULT_PROJECT_REFERENCES,
      visibility: { ...DEFAULT_VISIBILITY, similarProjects: true },
    };
  }

  if (projectType === "CCTV_PLUS_SOLAR") {
    return {
      projectOverview:
        "This quotation covers a solar-backed CCTV and surveillance power solution designed to keep security systems operating reliably during grid interruptions.",
      whatPriceIncludes:
        "The quoted price includes the listed CCTV power components, energy storage, standard accessories, installation support, testing, and handover guidance.",
      whatItCanPower:
        "This system is intended to support cameras, recorder/NVR or DVR units, routers, basic lighting, and related low-power security equipment based on final sizing.",
      deliveryTimeline: DEFAULT_DELIVERY_TIMELINE,
      installationTimeline: DEFAULT_INSTALLATION_TIMELINE,
      afterSalesSupport: DEFAULT_AFTER_SALES_SUPPORT,
      importantNotes: DEFAULT_IMPORTANT_NOTES,
      scopeExclusions: DEFAULT_SCOPE_EXCLUSIONS,
      similarProjects: DEFAULT_SIMILAR_PROJECTS,
      termsAndConditions: DEFAULT_TERMS,
      preparedByDetails: DEFAULT_PREPARED_BY,
      companyLegalDetails: QUOTATION_COMPANY_DETAILS,
      projectReferenceLinks: DEFAULT_PROJECT_REFERENCES,
      visibility: { ...DEFAULT_VISIBILITY, similarProjects: true },
    };
  }

  if (projectType === "STREET_LIGHTS") {
    return {
      projectOverview:
        "This quotation covers solar street-lighting equipment selected to improve outdoor visibility, site safety, and nighttime operation.",
      whatPriceIncludes:
        "The quoted price includes the listed solar lighting equipment, standard accessories, installation support, testing, and handover guidance.",
      whatItCanPower:
        "This solution is intended for compound lighting, access roads, public walkways, institutions, farms, and security-focused outdoor areas.",
      deliveryTimeline: DEFAULT_DELIVERY_TIMELINE,
      installationTimeline: DEFAULT_INSTALLATION_TIMELINE,
      afterSalesSupport: DEFAULT_AFTER_SALES_SUPPORT,
      importantNotes: DEFAULT_IMPORTANT_NOTES,
      scopeExclusions: DEFAULT_SCOPE_EXCLUSIONS,
      similarProjects: DEFAULT_SIMILAR_PROJECTS,
      termsAndConditions: DEFAULT_TERMS,
      preparedByDetails: DEFAULT_PREPARED_BY,
      companyLegalDetails: QUOTATION_COMPANY_DETAILS,
      projectReferenceLinks: DEFAULT_PROJECT_REFERENCES,
      visibility: { ...DEFAULT_VISIBILITY, similarProjects: true },
    };
  }

  return {
    projectOverview: `This quotation covers the supply, delivery, installation, testing and commissioning of a ${label.toLowerCase()} solution based on your stated requirements.`,
    whatPriceIncludes:
      "The quoted price includes the listed core equipment, standard accessories, installation support where applicable, testing, commissioning, and customer handover guidance.",
    whatItCanPower:
      "This solution is intended to support the requested customer loads based on the final approved design and site conditions.",
    deliveryTimeline: DEFAULT_DELIVERY_TIMELINE,
    installationTimeline: DEFAULT_INSTALLATION_TIMELINE,
    afterSalesSupport: DEFAULT_AFTER_SALES_SUPPORT,
    importantNotes: DEFAULT_IMPORTANT_NOTES,
    scopeExclusions: DEFAULT_SCOPE_EXCLUSIONS,
    similarProjects: DEFAULT_SIMILAR_PROJECTS,
    termsAndConditions: DEFAULT_TERMS,
    preparedByDetails: DEFAULT_PREPARED_BY,
    companyLegalDetails: QUOTATION_COMPANY_DETAILS,
    projectReferenceLinks: DEFAULT_PROJECT_REFERENCES,
    visibility: { ...DEFAULT_VISIBILITY, similarProjects: false },
  };
}

export function buildItemDrivenPowerSummary(items: StoredQuoteLineItem[], projectType: QuoteProjectType) {
  const names = items.map((item) => item.itemName.toLowerCase()).join(" ");

  if (projectType === "SOLAR_WATER_PUMP" || /\bpump\b/.test(names)) {
    return "This solution is suitable for pumping water to storage tanks, farms, boreholes, livestock areas, or domestic use depending on the final pump sizing and site head.";
  }

  const bits: string[] = [];
  if (/\b(inverter|hybrid)\b/.test(names)) {
    bits.push("lighting");
    bits.push("TV");
    bits.push("WiFi router");
    bits.push("phone charging");
  }
  if (/\b(lithium|battery)\b/.test(names)) {
    bits.push("backup during power outages");
  }
  if (/\b(panel|solar)\b/.test(names)) {
    bits.push("daytime solar charging");
  }
  if (/\b6kw|5kw|10kw|620w|585w\b/.test(names)) {
    bits.push("refrigerators");
    bits.push("freezers");
    bits.push("washing machine");
    bits.push("microwave");
    bits.push("CCTV");
  }

  const unique = Array.from(new Set(bits));
  if (!unique.length) {
    return "This solution is selected to support the stated customer loads based on final sizing, site conditions, and approved operating requirements.";
  }

  return `This solution is suitable for ${unique.join(", ")} subject to final sizing, simultaneous load usage, and approved site conditions.`;
}

export function buildWarrantyAiSummary(items: StoredQuoteLineItem[], mode: QuoteWarrantyMode) {
  if (mode === "FULL_SYSTEM") {
    return "Full-system warranty mode selected. Staff should confirm the overall equipment, workmanship, and support coverage before issuing the quotation.";
  }
  if (mode === "CUSTOM") {
    return "Custom warranty mode selected. Staff should review the final custom wording before issuing the quotation.";
  }

  const lines = items
    .map((item) => {
    const name = item.itemName.toLowerCase();
    let suggestion = item.warranty?.trim() || "";
    if (!suggestion && typeof item.warrantyPeriod === "number" && Number.isFinite(item.warrantyPeriod) && item.warrantyPeriod > 0) {
      suggestion = `${item.warrantyPeriod} ${item.warrantyUnit === "MONTHS" ? "Months" : "Years"}`;
    }
    if (!suggestion) {
      if (/\bpanel|solar panel|jinko\b/.test(name)) suggestion = "25 Years performance warranty";
      else if (/\binverter|hybrid|srne\b/.test(name)) suggestion = "10 Years manufacturer warranty";
      else if (/\bbattery|lithium|lifepo4\b/.test(name)) suggestion = "10 Years manufacturer warranty";
      else if (/\binstallation|workmanship\b/.test(name)) suggestion = "12 months workmanship warranty";
    }
      return suggestion ? `${item.itemName}: ${suggestion}` : null;
    })
    .filter((line): line is string => Boolean(line));

  return lines.join("\n");
}
