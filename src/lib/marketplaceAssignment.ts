export const MarketplaceAssignmentRole = {
  JUMIA_KILIMALL_OPS: "JUMIA_KILIMALL_OPS",
  SUPERVISOR: "SUPERVISOR",
} as const;

export type MarketplaceAssignmentRole = (typeof MarketplaceAssignmentRole)[keyof typeof MarketplaceAssignmentRole];

export const MarketplaceAssignmentRoleValues = Object.values(MarketplaceAssignmentRole) as MarketplaceAssignmentRole[];

export function isMarketplaceAssignmentRole(v: unknown): v is MarketplaceAssignmentRole {
  return typeof v === "string" && (MarketplaceAssignmentRoleValues as string[]).includes(v as string);
}

export default MarketplaceAssignmentRole;
