import "server-only";

import fs from "fs/promises";
import path from "path";
import { launchChromiumBrowser } from "@/lib/pdf/chromium";
import {
  formatQuoteCurrency,
  getQuotePaymentMethodLabel,
  getQuotePaymentTermsLabel,
  PAYMENT_METHOD_DETAILS,
  type QuotePaymentMethod,
  type QuotePaymentTerms,
  type QuoteProposalSectionKey,
  type QuoteProposalVisibilityKey,
  type QuoteWarrantyMode,
  type StoredQuoteLineItem,
} from "@/lib/quoteProposal";
import { QUOTATION_COMPANY_DETAILS } from "@/lib/quoteProposalSections";

type QuotePdfInput = {
  quoteRef: string;
  quoteTitle?: string | null;
  customerName: string;
  customerPhone?: string | null;
  customerEmail?: string | null;
  customerLocation?: string | null;
  issuedAtLabel: string;
  items: StoredQuoteLineItem[];
  subtotal: number;
  total: number;
  paymentMethod?: QuotePaymentMethod | null;
  paymentTerms?: QuotePaymentTerms | null;
  depositAmount?: number | null;
  balanceAmount?: number | null;
  quoteMessage?: string | null;
  warrantyMode?: QuoteWarrantyMode | null;
  fullSystemWarranty?: string | null;
  customWarranty?: string | null;
  warrantyGeneralNotes?: string | null;
  aiWarrantySummary?: string | null;
  proposalSections?: Partial<Record<QuoteProposalSectionKey, string | null>>;
  proposalVisibility?: Partial<Record<QuoteProposalVisibilityKey, boolean>>;
};

type QuoteSummaryCard = {
  icon: string;
  label: string;
  value: string;
};

type WarrantyRow = {
  component: string;
  warranty: string;
  notes: string;
};

type CostBreakdownRow = {
  label: string;
  amount: number;
  percent: number;
  tone: "maroon" | "gold" | "ink" | "soft";
};

type TimelineStep = {
  title: string;
  detail: string;
  dayLabel: string;
};

type PowerBlock = {
  icon: string;
  label: string;
};

type ShortSolutionSummary = {
  systemSize: string;
  solarCapacity: string;
  batteryCapacity: string;
  inverterCapacity: string;
  panelCount: string;
  batteryType: string;
  inverterType: string;
  installationIncluded: string;
  transportIncluded: string;
  supportIncluded: string;
  totalLabel: string;
  paymentLabel: string;
  warrantyLabel: string;
};

type GeneratedQuotationAiSections = {
  executiveSummary: string;
  shortSolutionSummary: ShortSolutionSummary;
  whatSystemCanPower: string[];
  keyBenefits: string[];
  warrantySuggestion: string[];
  scopeExclusions: string[];
  customerNotes: string[];
};

type QuotePdfRenderData = {
  subject: string;
  quoteDate: string;
  validUntil: string;
  companyDetails: string[];
  preparedBy: string[];
  projectOverview: string | null;
  priceIncludes: string[];
  whatItCanPower: string[];
  deliveryLines: string[];
  installationLines: string[];
  afterSalesSupport: string[];
  importantNotes: string[];
  scopeExclusions: string[];
  termsAndConditions: string[];
  additionalNotes: string[];
  referenceLinks: string[];
  similarProjects: string[];
  paymentSections: Array<{ label: string; lines: string[] }>;
  warrantyRows: WarrantyRow[];
  warrantyNotes: string[];
  items: Array<
    StoredQuoteLineItem & {
      shortName: string;
      specsText: string | null;
    }
  >;
  summaryCards: QuoteSummaryCard[];
  ai: GeneratedQuotationAiSections;
  costBreakdown: CostBreakdownRow[];
  timeline: TimelineStep[];
  accessoriesIncluded: string[];
  boqTitle: string;
};

function escapeHtml(value: string | null | undefined) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function splitParagraphLines(value?: string | null) {
  return String(value || "")
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function compactLineItems(items: string[]) {
  return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));
}

function sanitizeMessageParagraphs(message?: string | null) {
  return splitParagraphLines(message);
}

function formatProposalSubject(title?: string | null) {
  const cleaned = String(title || "").trim();
  if (!cleaned) return "SUPPLY, DELIVERY, INSTALLATION, TESTING & COMMISSIONING PROPOSAL";
  const upper = cleaned.toUpperCase();
  if (upper.includes("SUPPLY") || upper.includes("QUOTATION") || upper.includes("PROPOSAL")) {
    return upper;
  }
  return `SUPPLY, DELIVERY, INSTALLATION, TESTING & COMMISSIONING OF ${upper}`;
}

function formatValidUntil() {
  return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString("en-KE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function toSentenceCase(value: string) {
  const text = String(value || "").trim();
  if (!text) return "";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function formatCompactNumber(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "";
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(1).replace(/\.0$/, "");
}

function formatKw(valueInWatts: number) {
  if (!Number.isFinite(valueInWatts) || valueInWatts <= 0) return "";
  if (valueInWatts >= 1000) return `${formatCompactNumber(valueInWatts / 1000)} kW`;
  return `${formatCompactNumber(valueInWatts)} W`;
}

function formatKwh(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "";
  return `${formatCompactNumber(value)} kWh`;
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
  const amount = parseLargestToken(value, /\b(\d+(?:\.\d+)?)\s*w\b/gi);
  return amount ? amount : null;
}

function parseKwValue(value: string) {
  const kw = parseLargestToken(value, /\b(\d+(?:\.\d+)?)\s*kw\b/gi);
  if (kw) return kw;
  const kva = parseLargestToken(value, /\b(\d+(?:\.\d+)?)\s*kva\b/gi);
  return kva ? kva : null;
}

function parseKwhValue(value: string) {
  return parseLargestToken(value, /\b(\d+(?:\.\d+)?)\s*kwh\b/gi);
}

function parseAhValue(value: string) {
  return parseLargestToken(value, /\b(\d+(?:\.\d+)?)\s*ah\b/gi);
}

function shortItemName(itemName: string) {
  const cleaned = String(itemName || "").replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  const beforeColon = cleaned.split(":")[0]?.trim() || cleaned;
  const beforeDash = beforeColon.split(" - ")[0]?.trim() || beforeColon;
  if (beforeDash.length <= 72) return beforeDash;
  return `${beforeDash.slice(0, 69).trimEnd()}...`;
}

function specsSnippet(itemName: string) {
  const cleaned = String(itemName || "").replace(/\s+/g, " ").trim();
  if (!cleaned) return null;
  if (cleaned.includes(":")) {
    const remainder = cleaned.split(":").slice(1).join(":").trim();
    return remainder || null;
  }
  const parts = cleaned.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length > 1) {
    return parts.slice(1).join(", ");
  }
  return null;
}

function buildDefaultCommercialNotes(input: QuotePdfInput) {
  const notes = [
    "Prices are in Kenya Shillings and cover only the approved scope in this proposal.",
    "Final site positioning, cable runs, and mounting details are confirmed during implementation planning.",
    "Additional civil works, structural fabrication, or extra accessories outside this BOQ are billed separately if required.",
  ];

  if (input.paymentTerms === "DEPOSIT_AND_BALANCE") {
    notes.unshift(
      `Payment structure: ${getQuotePaymentTermsLabel(input.paymentTerms)}${typeof input.depositAmount === "number" ? ` with deposit ${formatQuoteCurrency(input.depositAmount)}` : ""}${typeof input.balanceAmount === "number" ? ` and balance ${formatQuoteCurrency(input.balanceAmount)}` : ""}.`,
    );
  } else {
    notes.unshift(`Payment structure: ${getQuotePaymentTermsLabel(input.paymentTerms)}.`);
  }

  return notes;
}

function buildWarrantyRows(input: QuotePdfInput): WarrantyRow[] {
  const fallbackWarranty =
    input.warrantyMode === "FULL_SYSTEM"
      ? input.fullSystemWarranty || "Covered under full system warranty"
      : input.warrantyMode === "CUSTOM"
        ? input.customWarranty || "Custom warranty"
        : "Manufacturer warranty";

  return input.items
    .map((item) => ({
      component: shortItemName(item.itemName),
      warranty: item.warranty || item.defaultWarranty || fallbackWarranty,
      notes: item.warrantyNotes || "Standard coverage",
    }))
    .filter((row) => row.component && row.warranty);
}

function classifyItemGroup(itemName: string) {
  const text = String(itemName || "").toLowerCase();
  if (/(transport|delivery|freight|logistics)/i.test(text)) return "transport";
  if (/(install|commission|labou?r|workmanship|mounting|fitting|programming|configuration)/i.test(text)) return "installation";
  if (/(mc4|lug|rail|breaker|cable|trunking|conduit|connector|clip|tie|label|ac protection|dc protection|fuse)/i.test(text)) return "accessory";
  return "equipment";
}

function parseTimelineSteps(deliveryLines: string[], installationLines: string[]): TimelineStep[] {
  const raw = [
    ...deliveryLines.map((line) => ({ kind: "Delivery", line })),
    ...installationLines.map((line) => ({ kind: "Installation", line })),
  ].filter((entry) => entry.line.trim());

  if (!raw.length) {
    return [
      { title: "Order confirmation", detail: "Final scope review and customer approval.", dayLabel: "Day 0" },
      { title: "Equipment preparation", detail: "Procurement, testing, and staging of all major components.", dayLabel: "Day 1 - 2" },
      { title: "Delivery to site", detail: "Transport and controlled offloading at the customer location.", dayLabel: "Day 2 - 3" },
      { title: "Installation and commissioning", detail: "Professional installation, testing, handover, and user orientation.", dayLabel: "Day 3 - 4" },
    ];
  }

  return raw.map((entry, index) => {
    const parts = entry.line.split(/[:.-]\s+/);
    const lead = parts[0]?.trim() || entry.kind;
    const detail = parts.slice(1).join(" - ").trim() || entry.line.trim();
    const explicitDay = entry.line.match(/\bday\s*\d+(?:\s*-\s*\d+)?\b/i)?.[0];
    return {
      title: /^\d+$/.test(lead) ? entry.kind : lead,
      detail,
      dayLabel: explicitDay ? toSentenceCase(explicitDay) : `Step ${index + 1}`,
    };
  });
}

function inferPowerBlocks(summary: ShortSolutionSummary, providedLines: string[]): PowerBlock[] {
  const provided = compactLineItems(providedLines);
  if (provided.length) {
    return provided.slice(0, 12).map((line) => ({
      icon: "⚡",
      label: line,
    }));
  }

  const batteryKwh = Number(summary.batteryCapacity.match(/(\d+(?:\.\d+)?)/)?.[1] || 0);
  const inverterKw = Number(summary.inverterCapacity.match(/(\d+(?:\.\d+)?)/)?.[1] || 0);
  const solarKw = Number(summary.solarCapacity.match(/(\d+(?:\.\d+)?)/)?.[1] || 0);
  const systemLevel = Math.max(batteryKwh, inverterKw, solarKw);

  const loads =
    systemLevel >= 10
      ? [
          ["💡", "Full house lighting"],
          ["📺", "Multiple TVs"],
          ["🧊", "Fridges and freezers"],
          ["🧺", "Washing machine"],
          ["🚰", "Water pump"],
          ["📶", "Wi-Fi / router"],
          ["📹", "CCTV system"],
          ["🍽️", "Microwave"],
          ["💼", "Office equipment"],
          ["💻", "Laptops and phones"],
          ["🛡️", "Electric fence"],
          ["🏪", "Small business daytime loads"],
        ]
      : systemLevel >= 5
        ? [
            ["💡", "House lighting"],
            ["📺", "TV and decoder"],
            ["🧊", "Fridge"],
            ["📶", "Wi-Fi / router"],
            ["📹", "CCTV"],
            ["💻", "Laptops and phones"],
            ["🚰", "Small water pump"],
            ["🖨️", "Office devices"],
          ]
        : [
            ["💡", "Lighting points"],
            ["📺", "TV"],
            ["📶", "Router"],
            ["📱", "Phone charging"],
            ["🧊", "Small fridge"],
            ["🔊", "Woofer / entertainment"],
          ];

  return loads.map(([icon, label]) => ({ icon, label }));
}

function buildCostBreakdown(input: QuotePdfInput): CostBreakdownRow[] {
  let installation = 0;
  let transport = 0;
  let accessories = 0;

  for (const item of input.items) {
    const lineTotal = Number(item.lineTotal || item.quantity * item.unitPrice || 0);
    const group = classifyItemGroup(item.itemName);
    if (group === "installation") installation += lineTotal;
    else if (group === "transport") transport += lineTotal;
    else if (group === "accessory") accessories += lineTotal;
  }

  const equipment = Math.max(input.total - installation - transport, 0);
  const base = Math.max(input.total, 1);
  const rows: CostBreakdownRow[] = [
    { label: "Equipment", amount: equipment, percent: Math.round((equipment / base) * 100), tone: "maroon" },
    { label: "Installation", amount: installation, percent: Math.round((installation / base) * 100), tone: "gold" },
    { label: "Transport", amount: transport, percent: Math.round((transport / base) * 100), tone: "ink" },
    { label: "Accessories", amount: accessories, percent: Math.round((accessories / base) * 100), tone: "soft" },
  ];
  return rows.filter((row) => row.amount > 0 || row.label === "Equipment");
}

function deriveShortSolutionSummary(input: QuotePdfInput) {
  const panelItems = input.items.filter((item) => /panel/i.test(item.itemName));
  const batteryItems = input.items.filter((item) => /battery|lithium|lifepo4|gel|agm|kwh|ah/i.test(item.itemName));
  const inverterItems = input.items.filter((item) => /inverter|hybrid/i.test(item.itemName));

  const panelCount = panelItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const solarCapacityWatts = panelItems.reduce((sum, item) => {
    const watts = parseWattValue(item.itemName);
    return watts ? sum + watts * Number(item.quantity || 0) : sum;
  }, 0);

  const inverterKw =
    inverterItems
      .map((item) => parseKwValue(item.itemName))
      .filter((value): value is number => Boolean(value))
      .sort((left, right) => right - left)[0] || parseKwValue(input.quoteTitle || "") || 0;

  const batteryKwh = batteryItems.reduce((sum, item) => {
    const kwh = parseKwhValue(item.itemName);
    if (kwh) return sum + kwh * Number(item.quantity || 0);
    return sum;
  }, 0);

  const batteryAh =
    batteryItems
      .map((item) => parseAhValue(item.itemName))
      .filter((value): value is number => Boolean(value))
      .sort((left, right) => right - left)[0] || 0;

  const systemSize =
    parseKwValue(input.quoteTitle || "") ||
    inverterKw ||
    (solarCapacityWatts >= 1000 ? Number((solarCapacityWatts / 1000).toFixed(1)) : 0);

  const batteryLead =
    batteryItems[0]?.itemName && /lithium/i.test(batteryItems[0].itemName)
      ? "Lithium"
    : batteryItems[0]?.itemName && /gel|agm/i.test(batteryItems[0].itemName)
        ? "Deep cycle"
        : shortItemName(batteryItems[0]?.itemName || "");

  const inverterLead =
    inverterItems[0]?.itemName && /hybrid/i.test(inverterItems[0].itemName)
      ? "Hybrid inverter"
      : shortItemName(inverterItems[0]?.itemName || "");

  const installationIncluded =
    input.items.some((item) => classifyItemGroup(item.itemName) === "installation") ||
    Boolean(input.proposalSections?.installationTimeline)
      ? "Included"
      : "As quoted";
  const transportIncluded =
    input.items.some((item) => classifyItemGroup(item.itemName) === "transport") ||
    Boolean(input.proposalSections?.deliveryTimeline)
      ? "Included"
      : "As quoted";
  const supportIncluded =
    input.proposalSections?.afterSalesSupport || input.quoteMessage ? "Included" : "Standard support";

  return {
    systemSize: systemSize ? `${formatCompactNumber(systemSize)} kW` : "Custom engineered",
    solarCapacity:
      solarCapacityWatts > 0
        ? `${formatKw(solarCapacityWatts)}${panelCount ? ` (${panelCount} x panels)` : ""}`
        : panelCount
          ? `${panelCount} x solar panels`
          : "As quoted",
    batteryCapacity:
      batteryKwh > 0
        ? `${formatKwh(batteryKwh)} ${batteryLead}`.trim()
        : batteryAh > 0
          ? `${formatCompactNumber(batteryAh)} Ah ${batteryLead}`.trim()
          : batteryLead || "Battery included as quoted",
    inverterCapacity:
      inverterKw > 0
        ? `${formatCompactNumber(inverterKw)} kW ${inverterLead}`.trim()
        : inverterLead || "Inverter included as quoted",
    panelCount: panelCount ? String(panelCount) : panelItems.length ? String(panelItems.length) : "As quoted",
    batteryType: batteryLead || "As quoted",
    inverterType: inverterLead || "As quoted",
    installationIncluded,
    transportIncluded,
    supportIncluded,
    totalLabel: formatQuoteCurrency(input.total),
    paymentLabel: getQuotePaymentTermsLabel(input.paymentTerms || null),
    warrantyLabel:
      input.warrantyMode === "FULL_SYSTEM"
        ? "Full system"
        : input.warrantyMode === "CUSTOM"
          ? "Custom warranty"
          : "Per item",
  } satisfies ShortSolutionSummary;
}

export function generateQuotationAiSections(input: QuotePdfInput): GeneratedQuotationAiSections {
  const shortSolutionSummary = deriveShortSolutionSummary(input);
  const quoteLead = String(input.quoteTitle || "").trim() || "the proposed solar solution";
  const executiveSummary =
    input.proposalSections?.projectOverview?.trim() ||
    `Based on the reviewed customer requirement, we are pleased to submit a professional proposal for ${quoteLead}. This solution is structured to deliver reliable performance, practical installation, and clear commercial terms for approval.`;

  const keyBenefits = compactLineItems([
    shortSolutionSummary.installationIncluded === "Included"
      ? "Professional installation, testing, and commissioning included."
      : "Installation scope structured clearly inside the quotation.",
    shortSolutionSummary.transportIncluded === "Included"
      ? "Transport and delivery planning included in the project flow."
      : "Transport arranged as stated in the BOQ.",
    shortSolutionSummary.supportIncluded === "Included"
      ? "After-sales support and technical follow-up are included."
      : "Support terms are defined in the proposal.",
    shortSolutionSummary.warrantyLabel === "Per item"
      ? "Each major component carries its own warranty coverage."
      : `Warranty handled under ${shortSolutionSummary.warrantyLabel.toLowerCase()} mode.`,
  ]);

  const warrantySuggestion = compactLineItems([
    ...buildWarrantyRows(input).map((row) => `${row.component}: ${row.warranty}${row.notes ? ` (${row.notes})` : ""}`),
    "Warranty applies under normal use, correct installation, and manufacturer operating conditions.",
  ]);

  const scopeExclusions = compactLineItems([
    ...splitParagraphLines(input.proposalSections?.scopeExclusions),
    "Major civil works, roofing modifications, and structural repairs unless expressly listed.",
    "Additional accessories, extended cable runs, and extra protection devices not itemized in this BOQ.",
  ]);

  const customerNotes = compactLineItems([
    ...sanitizeMessageParagraphs(input.quoteMessage).slice(1),
    ...splitParagraphLines(input.proposalSections?.importantNotes).slice(0, 3),
  ]);

  return {
    executiveSummary,
    shortSolutionSummary,
    whatSystemCanPower: inferPowerBlocks(shortSolutionSummary, splitParagraphLines(input.proposalSections?.whatItCanPower)).map(
      (item) => item.label,
    ),
    keyBenefits,
    warrantySuggestion,
    scopeExclusions,
    customerNotes,
  };
}

function buildSummaryCards(summary: ShortSolutionSummary): QuoteSummaryCard[] {
  return [
    { icon: "⚡", label: "System Size", value: summary.systemSize },
    { icon: "☀️", label: "Solar Capacity", value: summary.solarCapacity },
    { icon: "🔋", label: "Battery Capacity", value: summary.batteryCapacity },
    { icon: "🔌", label: "Inverter", value: summary.inverterCapacity },
    { icon: "🛠️", label: "Installation", value: summary.installationIncluded },
    { icon: "🚚", label: "Transport", value: summary.transportIncluded },
    { icon: "🛡️", label: "Warranty", value: summary.warrantyLabel },
    { icon: "🤝", label: "Support", value: summary.supportIncluded },
  ];
}

function normalizeQuotePdfData(input: QuotePdfInput): QuotePdfRenderData {
  const ai = generateQuotationAiSections(input);
  const companyDetails = splitParagraphLines(input.proposalSections?.companyLegalDetails);
  const preparedBy = splitParagraphLines(input.proposalSections?.preparedByDetails);
  const priceIncludes =
    input.proposalVisibility?.whatPriceIncludes === false
      ? []
      : compactLineItems(splitParagraphLines(input.proposalSections?.whatPriceIncludes));
  const deliveryLines =
    input.proposalVisibility?.deliveryAndInstallation === false
      ? []
      : compactLineItems(splitParagraphLines(input.proposalSections?.deliveryTimeline));
  const installationLines =
    input.proposalVisibility?.deliveryAndInstallation === false
      ? []
      : compactLineItems(splitParagraphLines(input.proposalSections?.installationTimeline));
  const afterSalesSupport =
    input.proposalVisibility?.afterSalesSupport === false
      ? []
      : compactLineItems(splitParagraphLines(input.proposalSections?.afterSalesSupport));
  const importantNotes =
    input.proposalVisibility?.importantNotes === false
      ? []
      : compactLineItems([...buildDefaultCommercialNotes(input), ...splitParagraphLines(input.proposalSections?.importantNotes)]);
  const scopeExclusions =
    input.proposalVisibility?.scopeExclusions === false
      ? []
      : compactLineItems(ai.scopeExclusions);
  const termsAndConditions =
    input.proposalVisibility?.termsAndConditions === false
      ? []
      : compactLineItems(splitParagraphLines(input.proposalSections?.termsAndConditions));
  const additionalNotes = compactLineItems(sanitizeMessageParagraphs(input.quoteMessage).slice(1));
  const referenceLinks = compactLineItems([
    ...splitParagraphLines(input.proposalSections?.projectReferenceLinks),
    "https://www.betech.co.ke/all-products",
    "https://wa.me/254722151083?text=Hello%20Betech%20Solar%20Solutions",
  ]);
  const similarProjects =
    input.proposalVisibility?.similarProjects === false
      ? []
      : compactLineItems([
          ...splitParagraphLines(input.proposalSections?.similarProjects),
          "https://www.tiktok.com/@betechsolarprojects",
        ]);
  const paymentSections = input.paymentMethod
    ? [PAYMENT_METHOD_DETAILS[input.paymentMethod]]
    : Object.values(PAYMENT_METHOD_DETAILS);
  const warrantyRows =
    input.proposalVisibility?.warranty === false ? [] : buildWarrantyRows(input);
  const warrantyNotes = compactLineItems([
    ...splitParagraphLines(input.warrantyGeneralNotes),
    ...splitParagraphLines(input.aiWarrantySummary),
    ...ai.warrantySuggestion,
  ]);
  const projectOverview =
    input.proposalVisibility?.projectOverview === false
      ? null
      : input.proposalSections?.projectOverview?.trim() || ai.executiveSummary;

  const accessoriesIncluded = compactLineItems(
    input.items
      .filter((item) => classifyItemGroup(item.itemName) === "accessory")
      .map((item) => shortItemName(item.itemName)),
  );

  return {
    subject: formatProposalSubject(input.quoteTitle),
    quoteDate: input.issuedAtLabel,
    validUntil: formatValidUntil(),
    companyDetails: companyDetails.length ? companyDetails : splitParagraphLines(QUOTATION_COMPANY_DETAILS),
    preparedBy: preparedBy.length ? preparedBy : ["Betech Solar Solutions", "Quotations Team", "0722 151 083"],
    projectOverview,
    priceIncludes,
    whatItCanPower:
      input.proposalVisibility?.whatItCanPower === false
        ? []
        : ai.whatSystemCanPower,
    deliveryLines,
    installationLines,
    afterSalesSupport,
    importantNotes,
    scopeExclusions,
    termsAndConditions,
    additionalNotes,
    referenceLinks,
    similarProjects,
    paymentSections,
    warrantyRows,
    warrantyNotes,
    items: input.items.map((item) => ({
      ...item,
      shortName: shortItemName(item.itemName),
      specsText: specsSnippet(item.itemName),
    })),
    summaryCards: buildSummaryCards(ai.shortSolutionSummary),
    ai,
    costBreakdown: buildCostBreakdown(input),
    timeline: parseTimelineSteps(deliveryLines, installationLines),
    accessoriesIncluded,
    boqTitle: String(input.quoteTitle || "Detailed bill of quantities").trim(),
  };
}

function renderInfoGrid(rows: Array<{ label: string; value: string }>) {
  return rows
    .filter((row) => row.value.trim())
    .map(
      (row) => `
        <div class="info-row">
          <div class="info-label">${escapeHtml(row.label)}</div>
          <div class="info-value">${escapeHtml(row.value)}</div>
        </div>
      `,
    )
    .join("");
}

function renderList(items: string[], variant: "default" | "soft" = "default") {
  if (!items.length) return "";
  return `
    <div class="list ${variant === "soft" ? "list-soft" : ""}">
      ${items
        .map(
          (item) => `
            <div class="list-row break-inside-avoid">
              <span class="list-icon">✓</span>
              <span>${escapeHtml(item)}</span>
            </div>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderSection(title: string, body: string, extraClass = "") {
  if (!body.trim()) return "";
  return `
    <section class="section break-inside-avoid ${extraClass}">
      <div class="section-title">${escapeHtml(title)}</div>
      ${body}
    </section>
  `;
}

function renderPowerGrid(blocks: PowerBlock[]) {
  if (!blocks.length) return "";
  return `
    <div class="power-grid">
      ${blocks
        .map(
          (item) => `
            <div class="power-card break-inside-avoid">
              <div class="power-icon">${escapeHtml(item.icon)}</div>
              <div class="power-label">${escapeHtml(item.label)}</div>
            </div>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderTimeline(timeline: TimelineStep[]) {
  if (!timeline.length) return "";
  return `
    <div class="timeline">
      ${timeline
        .map(
          (step, index) => `
            <div class="timeline-step break-inside-avoid">
              <div class="timeline-marker">${index + 1}</div>
              <div class="timeline-content">
                <div class="timeline-day">${escapeHtml(step.dayLabel)}</div>
                <div class="timeline-title">${escapeHtml(step.title)}</div>
                <div class="timeline-detail">${escapeHtml(step.detail)}</div>
              </div>
            </div>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderCostBars(rows: CostBreakdownRow[]) {
  return `
    <div class="cost-bars">
      ${rows
        .map(
          (row) => `
            <div class="cost-row break-inside-avoid">
              <div class="cost-head">
                <span>${escapeHtml(row.label)}</span>
                <span>${escapeHtml(formatQuoteCurrency(row.amount))}</span>
              </div>
              <div class="cost-track">
                <div class="cost-fill tone-${row.tone}" style="width:${Math.max(row.percent, row.amount > 0 ? 4 : 0)}%"></div>
              </div>
              <div class="cost-caption">${row.percent}% of project value</div>
            </div>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderWarrantyTable(rows: WarrantyRow[]) {
  if (!rows.length) return "";
  return `
    <table class="boq-table">
      <thead>
        <tr>
          <th>Component</th>
          <th style="width:140px;">Warranty Period</th>
          <th style="width:180px;">Coverage</th>
        </tr>
      </thead>
      <tbody>
        ${rows
          .map(
            (row) => `
              <tr>
                <td>${escapeHtml(row.component)}</td>
                <td>${escapeHtml(row.warranty)}</td>
                <td>${escapeHtml(row.notes)}</td>
              </tr>
            `,
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function buildQuotationHtml(input: QuotePdfInput, assets: { letterheadUrl: string | null; logoUrl: string | null }) {
  const data = normalizeQuotePdfData(input);
  const powerBlocks = inferPowerBlocks(data.ai.shortSolutionSummary, data.whatItCanPower);
  const customerRows = renderInfoGrid([
    { label: "Prepared For", value: input.customerName },
    { label: "Phone", value: input.customerPhone || "-" },
    { label: "Email", value: input.customerEmail || "-" },
    { label: "Location", value: input.customerLocation || "-" },
    { label: "Quote Ref", value: input.quoteRef },
    { label: "Quotation Date", value: data.quoteDate },
    { label: "Valid Until", value: data.validUntil },
  ]);
  const companyRows = renderInfoGrid(
    data.companyDetails.map((line, index) => ({
      label: index === 0 ? "Company" : index === 1 ? "Registration" : index === 2 ? "Tax Detail" : "Detail",
      value: line,
    })),
  );
  const preparedByRows = renderInfoGrid(
    data.preparedBy.map((line, index) => ({
      label: index === 0 ? "Prepared By" : index === 1 ? "Role" : "Contact",
      value: line,
    })),
  );

  const commercialRows = [
    { label: "Subtotal", value: formatQuoteCurrency(input.subtotal) },
    { label: "Grand Total", value: formatQuoteCurrency(input.total) },
    { label: "Payment Terms", value: getQuotePaymentTermsLabel(input.paymentTerms || null) },
    { label: "Payment Method", value: getQuotePaymentMethodLabel(input.paymentMethod || null) },
    ...(input.paymentTerms === "DEPOSIT_AND_BALANCE" && typeof input.depositAmount === "number"
      ? [{ label: "Deposit", value: formatQuoteCurrency(input.depositAmount) }]
      : []),
    ...(input.paymentTerms === "DEPOSIT_AND_BALANCE" && typeof input.balanceAmount === "number"
      ? [{ label: "Balance", value: formatQuoteCurrency(input.balanceAmount) }]
      : []),
  ];

  const pages: Array<{ title: string; body: string }> = [];

  pages.push({
    title: "Cover",
    body: `
      <div class="cover-grid">
        <div class="cover-left">
          ${
            assets.letterheadUrl
              ? `<img class="letterhead" src="${assets.letterheadUrl}" alt="Betech letterhead" />`
              : `<div class="brand-kicker">Betech Solar Solutions</div>`
          }
          <div class="brand-kicker">Official Customer Quotation</div>
          <h1 class="cover-title">Quotation</h1>
          <div class="cover-subject">${escapeHtml(data.subject)}</div>
          <div class="meta-panel">
            ${customerRows}
            ${preparedByRows}
          </div>
        </div>
        <div class="cover-right">
          ${assets.logoUrl ? `<img class="cover-logo" src="${assets.logoUrl}" alt="Betech logo" />` : ""}
          <div class="hero-card break-inside-avoid">
            <div class="section-title">Executive Summary</div>
            <p class="body-copy">${escapeHtml(data.ai.executiveSummary)}</p>
          </div>
          <div class="summary-grid">
            ${data.summaryCards
              .map(
                (card) => `
                  <div class="summary-card break-inside-avoid">
                    <div class="summary-icon">${escapeHtml(card.icon)}</div>
                    <div class="summary-label">${escapeHtml(card.label)}</div>
                    <div class="summary-value">${escapeHtml(card.value)}</div>
                  </div>
                `,
              )
              .join("")}
          </div>
          <div class="cost-panel break-inside-avoid">
            <div class="section-title">Commercial Snapshot</div>
            ${renderCostBars(data.costBreakdown)}
          </div>
        </div>
      </div>
    `,
  });

  pages.push({
    title: "Summary",
    body: `
      <div class="two-column">
        <div>
          ${renderSection("Customer Information", `<div class="panel">${customerRows}</div>`)}
          ${renderSection("Executive Summary", `<p class="body-copy">${escapeHtml(data.projectOverview || data.ai.executiveSummary)}</p>`)}
          ${renderSection("Key Benefits", renderList(data.ai.keyBenefits, "soft"))}
        </div>
        <div>
          ${renderSection("Company Information", `<div class="panel">${companyRows}</div>`)}
          ${renderSection("Prepared Solution", `<div class="kpi-grid">
            <div class="kpi-card"><div class="kpi-label">System Size</div><div class="kpi-value">${escapeHtml(data.ai.shortSolutionSummary.systemSize)}</div></div>
            <div class="kpi-card"><div class="kpi-label">Solar Capacity</div><div class="kpi-value">${escapeHtml(data.ai.shortSolutionSummary.solarCapacity)}</div></div>
            <div class="kpi-card"><div class="kpi-label">Battery</div><div class="kpi-value">${escapeHtml(data.ai.shortSolutionSummary.batteryCapacity)}</div></div>
            <div class="kpi-card"><div class="kpi-label">Inverter</div><div class="kpi-value">${escapeHtml(data.ai.shortSolutionSummary.inverterCapacity)}</div></div>
            <div class="kpi-card"><div class="kpi-label">Total</div><div class="kpi-value">${escapeHtml(data.ai.shortSolutionSummary.totalLabel)}</div></div>
            <div class="kpi-card"><div class="kpi-label">Warranty</div><div class="kpi-value">${escapeHtml(data.ai.shortSolutionSummary.warrantyLabel)}</div></div>
          </div>`)}
        </div>
      </div>
    `,
  });

  pages.push({
    title: "BOQ",
    body: `
      ${renderSection("Detailed Bill Of Quantities", `
        <div class="boq-subtitle">${escapeHtml(data.boqTitle)}</div>
        <table class="boq-table">
          <thead>
            <tr>
              <th style="width:34px;">#</th>
              <th>Description</th>
              <th style="width:48px;">Qty</th>
              <th style="width:95px;">Unit Price</th>
              <th style="width:95px;">Amount</th>
              <th style="width:92px;">Warranty</th>
            </tr>
          </thead>
          <tbody>
            ${data.items
              .map(
                (item, index) => `
                  <tr>
                    <td>${index + 1}</td>
                    <td>
                      <div class="boq-name">${escapeHtml(item.shortName)}</div>
                      ${item.specsText ? `<div class="boq-spec">${escapeHtml(item.specsText)}</div>` : ""}
                    </td>
                    <td>${escapeHtml(String(item.quantity))}</td>
                    <td class="cell-right">${escapeHtml(formatQuoteCurrency(item.unitPrice))}</td>
                    <td class="cell-right">${escapeHtml(formatQuoteCurrency(item.lineTotal))}</td>
                    <td>${escapeHtml(item.warranty || item.defaultWarranty || "-")}</td>
                  </tr>
                `,
              )
              .join("")}
          </tbody>
        </table>
      `)}
      ${renderSection("Commercial Summary", `<div class="panel">${renderInfoGrid(commercialRows)}</div>`)}
    `,
  });

  pages.push({
    title: "Cost",
    body: `
      <div class="two-column">
        <div>
          ${renderSection("Cost Breakdown", renderCostBars(data.costBreakdown))}
          ${renderSection("Scope Of Supply", renderList(data.priceIncludes.length ? data.priceIncludes : ["Supply of quoted equipment as per BOQ.", "Professional delivery, installation, testing, and commissioning.", "System orientation and handover after completion."], "soft"))}
        </div>
        <div>
          ${renderSection("Project Commercial Notes", renderList(data.importantNotes, "soft"))}
          ${renderSection("Scope Exclusions", renderList(data.scopeExclusions))}
        </div>
      </div>
    `,
  });

  if (data.accessoriesIncluded.length || data.additionalNotes.length) {
    pages.push({
      title: "Accessories",
      body: `
        <div class="two-column">
          <div>
            ${renderSection("Accessories Included", renderList(data.accessoriesIncluded.length ? data.accessoriesIncluded : ["Accessories are included only where listed in the BOQ."], "soft"))}
          </div>
          <div>
            ${renderSection("Customer Requirement Notes", renderList(data.ai.customerNotes.length ? data.ai.customerNotes : data.additionalNotes, "soft"))}
          </div>
        </div>
      `,
    });
  }

  pages.push({
    title: "Power",
    body: `
      ${renderSection("What This System Can Power", renderPowerGrid(powerBlocks))}
      ${renderSection("Practical Usage Note", `<div class="note-box">Actual performance depends on appliance loading pattern, starting surge, solar production conditions, and battery reserve management.</div>`)}
    `,
  });

  pages.push({
    title: "Timeline",
    body: `
      ${renderSection("Delivery And Installation Timeline", renderTimeline(data.timeline))}
    `,
  });

  if (data.warrantyRows.length || data.warrantyNotes.length) {
    pages.push({
      title: "Warranty",
      body: `
        ${renderSection("Warranty Coverage", renderWarrantyTable(data.warrantyRows))}
        ${renderSection("Warranty Notes", renderList(data.warrantyNotes.length ? data.warrantyNotes : ["Warranty applies under normal use, correct installation, and manufacturer operating conditions."], "soft"))}
      `,
    });
  }

  if (data.afterSalesSupport.length || data.termsAndConditions.length) {
    pages.push({
      title: "Support",
      body: `
        <div class="two-column">
          <div>
            ${renderSection("After-Sales Support", renderList(data.afterSalesSupport.length ? data.afterSalesSupport : ["Remote technical guidance after commissioning.", "Support escalation through the Betech customer care desk."], "soft"))}
          </div>
          <div>
            ${renderSection("Terms And Conditions", renderList(data.termsAndConditions))}
          </div>
        </div>
      `,
    });
  }

  pages.push({
    title: "Payment",
    body: `
      <div class="two-column">
        <div>
          ${renderSection("Payment Terms", `
            <div class="payment-cards">
              <div class="payment-card break-inside-avoid">
                <div class="payment-title">Terms</div>
                <div class="payment-value">${escapeHtml(getQuotePaymentTermsLabel(input.paymentTerms || null))}</div>
              </div>
              <div class="payment-card break-inside-avoid">
                <div class="payment-title">Method</div>
                <div class="payment-value">${escapeHtml(getQuotePaymentMethodLabel(input.paymentMethod || null))}</div>
              </div>
              ${
                typeof input.depositAmount === "number"
                  ? `<div class="payment-card break-inside-avoid"><div class="payment-title">Deposit</div><div class="payment-value">${escapeHtml(formatQuoteCurrency(input.depositAmount))}</div></div>`
                  : ""
              }
              ${
                typeof input.balanceAmount === "number"
                  ? `<div class="payment-card break-inside-avoid"><div class="payment-title">Balance</div><div class="payment-value">${escapeHtml(formatQuoteCurrency(input.balanceAmount))}</div></div>`
                  : ""
              }
            </div>
          `)}
        </div>
        <div>
          ${renderSection("Payment Methods", `
            <div class="payment-methods">
              ${data.paymentSections
                .map(
                  (section) => `
                    <div class="method-card break-inside-avoid">
                      <div class="method-title">${escapeHtml(section.label)}</div>
                      <div class="method-lines">${section.lines.map((line) => `<div>${escapeHtml(line)}</div>`).join("")}</div>
                    </div>
                  `,
                )
                .join("")}
            </div>
          `)}
        </div>
      </div>
    `,
  });

  if (data.similarProjects.length || data.referenceLinks.length) {
    pages.push({
      title: "Projects",
      body: `
        <div class="two-column">
          <div>
            ${renderSection("Similar Projects", `
              <div class="project-links">
                ${data.similarProjects
                  .map((link) => `<div class="project-card break-inside-avoid"><div class="project-label">Reference</div><div class="project-link">${escapeHtml(link)}</div></div>`)
                  .join("")}
              </div>
            `)}
          </div>
          <div>
            ${renderSection("Useful Links", `
              <div class="project-links">
                ${data.referenceLinks
                  .map((link) => `<div class="project-card break-inside-avoid"><div class="project-label">Open</div><div class="project-link">${escapeHtml(link)}</div></div>`)
                  .join("")}
              </div>
            `)}
          </div>
        </div>
      `,
    });
  }

  pages.push({
    title: "Approval",
    body: `
      <div class="two-column">
        <div>
          ${renderSection("Approval And Next Steps", `
            <div class="panel">
              <div class="approval-line"><strong>1.</strong> Review the proposal scope, pricing, and warranty coverage.</div>
              <div class="approval-line"><strong>2.</strong> Confirm any item adjustments, preferred payment method, or project timing.</div>
              <div class="approval-line"><strong>3.</strong> Share approval through phone, email, or WhatsApp so implementation planning can begin.</div>
            </div>
          `)}
          ${renderSection("Prepared By", `<div class="panel">${preparedByRows}</div>`)}
        </div>
        <div>
          ${renderSection("Customer Action Items", renderList([
            "Confirm the final product scope and commercial approval.",
            "Share exact site location and preferred installation date.",
            "Arrange site access and any required pre-installation readiness.",
          ], "soft"))}
          ${renderSection("Contact Betech", `
            <div class="panel">
              ${renderInfoGrid([
                { label: "Sales Desk", value: "0722 151 083" },
                { label: "Email", value: "info@betech.co.ke" },
                { label: "Website", value: "www.betech.co.ke" },
                { label: "Office", value: "Pramukh Plaza, 3rd Floor, Mombasa" },
              ])}
            </div>
          `)}
        </div>
      </div>
    `,
  });

  const pageHtml = pages
    .map(
      (page, index) => `
        <section class="page">
          <div class="sheet ${page.title === "Cover" ? "sheet-cover" : ""}">
            ${page.body}
            <div class="page-footer">
              <span>${escapeHtml(input.quoteRef)}</span>
              <span>Betech Solar Solutions</span>
              <span>Page ${index + 1} of ${pages.length}</span>
            </div>
          </div>
        </section>
      `,
    )
    .join("");

  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <title>${escapeHtml(input.quoteRef)}</title>
        <style>
          @page { size: A4; margin: 0; }
          * { box-sizing: border-box; }
          html, body {
            margin: 0;
            padding: 0;
            color: #1f2933;
            background: #f8f4ef;
            font-family: Arial, Helvetica, sans-serif;
          }
          body { font-size: 11px; line-height: 1.45; }
          .page {
            width: 210mm;
            min-height: 297mm;
            page-break-after: always;
          }
          .page:last-child { page-break-after: auto; }
          .sheet {
            width: 210mm;
            min-height: 297mm;
            padding: 12mm 12mm 10mm;
            background:
              linear-gradient(180deg, rgba(255,248,239,0.85), rgba(255,255,255,0.94)),
              #ffffff;
            position: relative;
          }
          .sheet::before {
            content: "";
            position: absolute;
            inset: 0 0 auto 0;
            height: 8mm;
            background: linear-gradient(90deg, #7a0f0f, #8b1212 60%, #d89a25);
          }
          .sheet-cover {
            background:
              radial-gradient(circle at top right, rgba(216,154,37,0.14), transparent 28%),
              linear-gradient(180deg, #fffaf4, #fffdfb);
          }
          .cover-grid {
            display: grid;
            grid-template-columns: 1.05fr 0.95fr;
            gap: 10mm;
            padding-top: 10mm;
          }
          .letterhead {
            max-height: 44px;
            width: 100%;
            object-fit: contain;
            object-position: left center;
            margin-bottom: 5mm;
          }
          .brand-kicker {
            color: #8b1212;
            font-size: 12px;
            font-weight: 800;
            letter-spacing: 0.18em;
            text-transform: uppercase;
          }
          .cover-title {
            margin: 4mm 0 1mm;
            font-size: 32px;
            line-height: 0.96;
            color: #7a0f0f;
            text-transform: uppercase;
          }
          .cover-subject {
            font-size: 15px;
            font-weight: 800;
            color: #1f2933;
            margin-bottom: 5mm;
          }
          .cover-right {
            position: relative;
            display: grid;
            gap: 8px;
            align-content: start;
          }
          .cover-logo {
            position: absolute;
            right: 0;
            top: -2mm;
            width: 115px;
            opacity: 0.12;
          }
          .hero-card,
          .summary-card,
          .kpi-card,
          .payment-card,
          .method-card,
          .project-card,
          .power-card,
          .panel,
          .note-box {
            border: 1px solid #ead8c2;
            border-radius: 10px;
            background: rgba(255,255,255,0.95);
          }
          .hero-card,
          .panel,
          .note-box { padding: 10px 12px; }
          .summary-grid,
          .kpi-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 8px;
          }
          .summary-card {
            padding: 9px 10px;
            min-height: 70px;
          }
          .summary-icon {
            font-size: 14px;
            margin-bottom: 4px;
          }
          .summary-label,
          .kpi-label,
          .payment-title,
          .method-title,
          .project-label {
            color: #8b1212;
            font-size: 9px;
            font-weight: 800;
            letter-spacing: 0.08em;
            text-transform: uppercase;
          }
          .summary-value,
          .kpi-value,
          .payment-value {
            margin-top: 5px;
            font-size: 11px;
            font-weight: 700;
            color: #1f2933;
          }
          .section {
            margin-bottom: 10px;
          }
          .section-title {
            color: #8b1212;
            font-size: 12px;
            font-weight: 800;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            margin-bottom: 7px;
            padding-bottom: 4px;
            border-bottom: 1px solid rgba(216,154,37,0.65);
          }
          .body-copy {
            margin: 0;
            white-space: pre-wrap;
            color: #334155;
          }
          .meta-panel {
            border: 1px solid #ead8c2;
            border-radius: 10px;
            background: #fffdfa;
            padding: 10px 12px;
          }
          .info-row {
            display: grid;
            grid-template-columns: 102px 1fr;
            gap: 10px;
            padding: 5px 0;
            border-bottom: 1px solid #f2e7da;
          }
          .info-row:last-child { border-bottom: 0; }
          .info-label {
            color: #8b1212;
            font-size: 9px;
            font-weight: 800;
            letter-spacing: 0.08em;
            text-transform: uppercase;
          }
          .info-value {
            color: #1f2933;
            font-size: 10.5px;
            white-space: pre-wrap;
          }
          .two-column {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            padding-top: 8mm;
          }
          .list {
            display: grid;
            gap: 6px;
          }
          .list-soft {
            padding: 10px 12px;
            border: 1px solid #ead8c2;
            border-radius: 10px;
            background: #fff8ef;
          }
          .list-row {
            display: grid;
            grid-template-columns: 16px 1fr;
            gap: 8px;
            align-items: start;
          }
          .list-icon {
            color: #15803d;
            font-weight: 800;
          }
          .boq-subtitle {
            margin-bottom: 8px;
            color: #475569;
            font-size: 11px;
          }
          .boq-table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
            background: #ffffff;
          }
          .boq-table th {
            background: #7a0f0f;
            color: #ffffff;
            padding: 8px 6px;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            font-size: 9px;
            text-align: left;
          }
          .boq-table td {
            border: 1px solid #ead8c2;
            padding: 7px 6px;
            vertical-align: top;
            font-size: 10px;
          }
          .boq-name {
            font-weight: 700;
            color: #1f2933;
          }
          .boq-spec {
            color: #64748b;
            font-size: 9.3px;
            margin-top: 2px;
            line-height: 1.35;
          }
          .cell-right { text-align: right; }
          .kpi-grid { margin-top: 4px; }
          .kpi-card { padding: 9px 10px; }
          .cost-bars { display: grid; gap: 8px; }
          .cost-head {
            display: flex;
            justify-content: space-between;
            gap: 10px;
            margin-bottom: 4px;
            font-size: 10px;
            font-weight: 700;
            color: #1f2933;
          }
          .cost-track {
            height: 9px;
            background: #f3e9db;
            border-radius: 999px;
            overflow: hidden;
          }
          .cost-fill { height: 100%; border-radius: 999px; }
          .tone-maroon { background: linear-gradient(90deg, #7a0f0f, #9a1c1c); }
          .tone-gold { background: linear-gradient(90deg, #d89a25, #e8b95b); }
          .tone-ink { background: linear-gradient(90deg, #1f2933, #334155); }
          .tone-soft { background: linear-gradient(90deg, #8b5e3c, #c58f54); }
          .cost-caption {
            margin-top: 3px;
            font-size: 9px;
            color: #64748b;
          }
          .power-grid {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 8px;
          }
          .power-card {
            padding: 10px 8px;
            text-align: center;
            min-height: 72px;
          }
          .power-icon {
            font-size: 15px;
            margin-bottom: 5px;
          }
          .power-label {
            font-size: 10px;
            color: #334155;
            font-weight: 700;
          }
          .timeline {
            display: grid;
            gap: 8px;
          }
          .timeline-step {
            display: grid;
            grid-template-columns: 30px 1fr;
            gap: 10px;
            padding: 8px 10px;
            border: 1px solid #ead8c2;
            border-radius: 10px;
            background: #fffdfa;
          }
          .timeline-marker {
            width: 30px;
            height: 30px;
            border-radius: 999px;
            background: #7a0f0f;
            color: #ffffff;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 800;
          }
          .timeline-day {
            color: #d89a25;
            font-size: 9px;
            font-weight: 800;
            letter-spacing: 0.08em;
            text-transform: uppercase;
          }
          .timeline-title {
            color: #1f2933;
            font-size: 11px;
            font-weight: 800;
            margin-top: 2px;
          }
          .timeline-detail {
            color: #475569;
            margin-top: 3px;
            font-size: 10px;
          }
          .payment-cards,
          .payment-methods,
          .project-links {
            display: grid;
            gap: 8px;
          }
          .payment-cards {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .payment-card,
          .method-card,
          .project-card {
            padding: 10px 11px;
          }
          .method-lines,
          .project-link {
            margin-top: 5px;
            color: #334155;
            font-size: 10px;
            line-height: 1.45;
            word-break: break-word;
          }
          .approval-line {
            padding: 5px 0;
            color: #334155;
            font-size: 10.5px;
          }
          .note-box {
            background: #fff8ef;
            color: #475569;
          }
          .page-footer {
            position: absolute;
            left: 12mm;
            right: 12mm;
            bottom: 7mm;
            display: flex;
            justify-content: space-between;
            gap: 10px;
            border-top: 1px solid #ead8c2;
            padding-top: 4px;
            color: #6b7280;
            font-size: 9px;
          }
          .break-inside-avoid {
            break-inside: avoid;
            page-break-inside: avoid;
          }
        </style>
      </head>
      <body>
        ${pageHtml}
      </body>
    </html>
  `;
}

async function loadImageAsDataUrl(relativePath: string) {
  try {
    const assetPath = path.join(process.cwd(), relativePath);
    const buffer = await fs.readFile(assetPath);
    const ext = path.extname(relativePath).toLowerCase();
    const mime =
      ext === ".png" ? "image/png" : ext === ".svg" ? "image/svg+xml" : "image/jpeg";
    return `data:${mime};base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}

export async function buildQuoteProposalPdfBuffer(input: QuotePdfInput) {
  const [letterheadUrl, logoUrl] = await Promise.all([
    loadImageAsDataUrl(path.join("public", "letterhead.jpg")),
    loadImageAsDataUrl(path.join("public", "agents", "betech-logo-crop.png")),
  ]);

  const browser = await launchChromiumBrowser();
  try {
    const page = await browser.newPage();
    const html = buildQuotationHtml(input, { letterheadUrl, logoUrl });
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });
    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close().catch(() => undefined);
  }
}
