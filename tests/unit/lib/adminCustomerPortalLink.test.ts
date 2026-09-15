import { buildAdminCustomerPortalLoginHref } from "@/lib/adminCustomerPortalLink";

test("builds an admin-authorised customer portal link with the account destination", () => {
  expect(buildAdminCustomerPortalLoginHref({
    customerUserId: "customer-1",
    customerName: "Word Of Life Church",
    customerPhone: "0725213288",
  })).toBe("/api/admin/customers/portal-login?userId=customer-1&name=Word+Of+Life+Church&phone=0725213288&callbackUrl=%2Faccount");
});

test("does not include missing customer identifiers", () => {
  expect(buildAdminCustomerPortalLoginHref({ customerName: "Walk-in customer" })).toBe("/api/admin/customers/portal-login?name=Walk-in+customer&callbackUrl=%2Faccount");
});
