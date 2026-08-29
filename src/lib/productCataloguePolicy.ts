import { z } from "zod";

export const INSTALLATION_TYPES = [
  "INCLUDED",
  "OPTIONAL_AUTO",
  "LOCAL_RECOMMENDED",
  "NOT_REQUIRED",
  "SITE_ASSESSMENT",
] as const;

export const TRANSPORT_MODES = ["INCLUDED", "ZONE", "FREE", "CUSTOM", "PICKUP"] as const;
export const ACCESSORIES_MODES = ["INCLUDED", "NOT_INCLUDED", "PARTIAL"] as const;

const detailRowSchema = z.object({
  label: z.string().trim().max(120),
  value: z.string().trim().max(500),
});

export const productCatalogueConfigurationSchema = z.object({
  installationType: z.enum(INSTALLATION_TYPES),
  installationFeeMode: z.enum(["STANDARD", "CUSTOM", "INCLUDED", "UNAVAILABLE"]).default("STANDARD"),
  customInstallationFee: z.coerce.number().min(0).nullable().default(null),
  accessoriesMode: z.enum(ACCESSORIES_MODES).default("NOT_INCLUDED"),
  preliminaryAccessoriesFee: z.coerce.number().min(0).nullable().default(null),
  includedAccessories: z.string().trim().max(2000).default(""),
  installationNotes: z.string().trim().max(2000).default(""),
  transportMode: z.enum(TRANSPORT_MODES),
  useDefaultTransportRates: z.boolean().default(true),
  zone1TransportFee: z.coerce.number().min(0).nullable().default(null),
  zone2TransportFee: z.coerce.number().min(0).nullable().default(null),
  zone3TransportFee: z.coerce.number().min(0).nullable().default(null),
  priceIncludes: z.array(z.enum(["EQUIPMENT", "INSTALLATION", "ACCESSORIES", "TRANSPORT", "COMMISSIONING", "REMOTE_SUPPORT"])).default(["EQUIPMENT"]),
  allInclusive: z.boolean().default(false),
  allInclusiveItems: z.array(z.string().trim().max(120)).max(30).default([]),
  structuredSpecifications: z.array(detailRowSchema).max(40).default([]),
  componentWarranties: z.array(detailRowSchema).max(30).default([]),
  projectImageUrls: z.array(z.string().trim().max(500)).max(12).default([]),
  requiresSiteAssessment: z.boolean().default(false),
}).superRefine((value, ctx) => {
  if (value.installationFeeMode === "CUSTOM" && value.customInstallationFee == null) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["customInstallationFee"], message: "Enter the custom installation fee" });
  }
});

export type ProductCatalogueConfiguration = z.infer<typeof productCatalogueConfigurationSchema>;

export type ProductCatalogueSettings = {
  installationBand1Max: number;
  installationBand1Fee: number;
  installationBand2Max: number;
  installationBand2Fee: number;
  installationBand3Max: number;
  installationBand3Fee: number;
  installationBand4Max: number;
  installationBand4Fee: number;
  zone1TransportFee: number;
  zone2TransportFee: number;
  zone3TransportFee: number;
};

type LegacyCatalogueProduct = {
  name?: string | null;
  category?: string | null;
  shortDescription?: string | null;
  description?: string | null;
  specifications?: unknown;
  sellingPrice?: number | null;
};

function searchableLegacyProductText(product: LegacyCatalogueProduct) {
  const specifications = Array.isArray(product.specifications)
    ? product.specifications.join(" ")
    : typeof product.specifications === "string"
      ? product.specifications
      : product.specifications && typeof product.specifications === "object"
        ? JSON.stringify(product.specifications)
        : "";
  return [product.name, product.category, product.shortDescription, product.description, specifications]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function inferLegacyProductCataloguePolicy(product: LegacyCatalogueProduct): ProductCatalogueConfiguration | null {
  const text = searchableLegacyProductText(product);
  const isSolarSystem = /solar\s+(full\s+)?(kit|system)/.test(text);
  const mentionsInstallation = /installation|installed|commissioning/.test(text);
  const highValueSystem = isSolarSystem && Number(product.sellingPrice || 0) >= 100_000;
  if (!mentionsInstallation && !highValueSystem) return null;

  const allInclusive = /all[\s-]*inclusive|complete\s+(solar\s+)?package/.test(text);
  const installationIncluded = allInclusive
    || /installation\s+(is\s+)?included|includes?\s+(professional\s+)?installation|professional\s+installation/.test(text);
  const transportIncluded = allInclusive
    || /transport(ation)?\s+(is\s+)?included|includes?\s+(countrywide\s+)?transport|countrywide\s+(transport|delivery)/.test(text);
  const accessoriesIncluded = allInclusive
    || /all\s+installation\s+accessories|installation\s+accessories\s+included|includes?\s+installation\s+accessories/.test(text);
  const priceIncludes = [
    "EQUIPMENT",
    ...(installationIncluded ? ["INSTALLATION"] : []),
    ...(transportIncluded ? ["TRANSPORT"] : []),
    ...(accessoriesIncluded ? ["ACCESSORIES"] : []),
  ] as ProductCatalogueConfiguration["priceIncludes"];

  return productCatalogueConfigurationSchema.parse({
    installationType: installationIncluded ? "INCLUDED" : "LOCAL_RECOMMENDED",
    installationFeeMode: installationIncluded ? "INCLUDED" : "STANDARD",
    accessoriesMode: accessoriesIncluded ? "INCLUDED" : "NOT_INCLUDED",
    includedAccessories: accessoriesIncluded ? "Installation accessories included in the advertised package." : "",
    installationNotes: "Legacy catalogue details detected. Confirm the final installation scope before scheduling.",
    transportMode: transportIncluded ? "INCLUDED" : "ZONE",
    useDefaultTransportRates: true,
    priceIncludes,
    allInclusive,
    allInclusiveItems: [],
    structuredSpecifications: [],
    componentWarranties: [],
    projectImageUrls: [],
    requiresSiteAssessment: highValueSystem && !installationIncluded,
  });
}

export function calculateInstallationFee(price: number, policy: ProductCatalogueConfiguration, settings: ProductCatalogueSettings) {
  if (policy.installationType === "INCLUDED" || policy.installationFeeMode === "INCLUDED") return { status: "INCLUDED" as const, amount: 0 };
  if (policy.installationType === "NOT_REQUIRED" || policy.installationFeeMode === "UNAVAILABLE") return { status: "UNAVAILABLE" as const, amount: null };
  if (policy.installationType === "SITE_ASSESSMENT" || policy.requiresSiteAssessment || price > settings.installationBand4Max) return { status: "ASSESSMENT" as const, amount: null };
  if (policy.installationFeeMode === "CUSTOM") return { status: "PRICED" as const, amount: policy.customInstallationFee ?? 0 };
  if (price <= settings.installationBand1Max) return { status: "PRICED" as const, amount: settings.installationBand1Fee };
  if (price <= settings.installationBand2Max) return { status: "PRICED" as const, amount: settings.installationBand2Fee };
  if (price <= settings.installationBand3Max) return { status: "PRICED" as const, amount: settings.installationBand3Fee };
  return { status: "PRICED" as const, amount: settings.installationBand4Fee };
}

export function calculateTransportFee(zone: "ZONE_1" | "ZONE_2" | "ZONE_3", policy: ProductCatalogueConfiguration, settings: ProductCatalogueSettings) {
  if (policy.transportMode === "INCLUDED" || policy.transportMode === "FREE") return { status: "INCLUDED" as const, amount: 0 };
  if (policy.transportMode === "PICKUP") return { status: "PICKUP" as const, amount: null };
  if (policy.transportMode === "CUSTOM") return { status: "QUOTE" as const, amount: null };
  const key = zone === "ZONE_1" ? "zone1TransportFee" : zone === "ZONE_2" ? "zone2TransportFee" : "zone3TransportFee";
  const amount = policy.useDefaultTransportRates ? settings[key] : policy[key] ?? settings[key];
  return { status: "PRICED" as const, amount };
}

function roundEstimate(value: number) {
  return Math.max(0, Math.round(value / 500) * 500);
}

export function calculateAccessoriesEstimate(price: number, policy: ProductCatalogueConfiguration) {
  if (policy.accessoriesMode === "INCLUDED" || policy.priceIncludes.includes("ACCESSORIES")) {
    return { status: "INCLUDED" as const, amount: 0, minimum: 0, maximum: 0 };
  }
  if (policy.preliminaryAccessoriesFee != null) {
    return {
      status: "ESTIMATED" as const,
      amount: policy.preliminaryAccessoriesFee,
      minimum: policy.preliminaryAccessoriesFee,
      maximum: policy.preliminaryAccessoriesFee,
    };
  }
  const factor = policy.accessoriesMode === "PARTIAL" ? 0.5 : 1;
  const minimum = roundEstimate(Math.max(2_000, price * 0.03) * factor);
  const maximum = roundEstimate(Math.max(5_000, price * 0.07) * factor);
  return {
    status: "ESTIMATED" as const,
    amount: roundEstimate((minimum + maximum) / 2),
    minimum,
    maximum: Math.max(minimum, maximum),
  };
}
