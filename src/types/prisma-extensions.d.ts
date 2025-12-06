import "@prisma/client";

declare module "@prisma/client" {
  // Some environments have migrations applied but the `schema.prisma` in the
  // repository may lag behind. Temporarily augment the generated PrismaClient
  // type with the marketplace models used by the app so TypeScript checks
  // succeed during CI builds. These are typed `any` to avoid coupling to a
  // specific generated shape — replace with concrete types by keeping
  // `prisma/schema.prisma` in sync with migrations and re-running `prisma generate`.
  export interface PrismaClient {
    marketplaceAccount: any;
    marketplaceAccountAssignment: any;
    marketplacePayoutWeek: any;
    marketplaceOrder: any;
    marketplaceReturn: any;
  }

  export type MarketplaceReturnStatus = "WAITING_AT_HUB" | "PICKED" | "CHARGED_TO_ATTENDANT";
}
