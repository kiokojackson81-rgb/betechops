// Lightweight local shim for Prisma enums that may be missing from the generated
// `@prisma/client` when schema/migrations are temporarily out of sync.
// Keep this file minimal and mirror the enum values defined in migrations.

export const MarketplaceReturnStatusValues = {
  WAITING_AT_HUB: "WAITING_AT_HUB",
  PICKED: "PICKED",
  CHARGED_TO_ATTENDANT: "CHARGED_TO_ATTENDANT",
} as const;

export type MarketplaceReturnStatus = (typeof MarketplaceReturnStatusValues)[keyof typeof MarketplaceReturnStatusValues];

// Helper to get a runtime-safe list of keys/values
export const MarketplaceReturnStatusList: MarketplaceReturnStatus[] = [
  MarketplaceReturnStatusValues.WAITING_AT_HUB,
  MarketplaceReturnStatusValues.PICKED,
  MarketplaceReturnStatusValues.CHARGED_TO_ATTENDANT,
];

export default {
  MarketplaceReturnStatusValues,
  MarketplaceReturnStatusList,
};
