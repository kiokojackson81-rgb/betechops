jest.mock("server-only", () => ({}), { virtual: true });

import { summarizeMarketingProductActivityRows } from "@/lib/marketingProductActivity";

describe("marketing product activity", () => {
  it("counts each product once per Nairobi day and action", () => {
    const summary = summarizeMarketingProductActivityRows([
      { entityId: "product-1", action: "POS_PRODUCT_UPDATE", createdAt: new Date("2026-08-19T20:30:00.000Z") },
      { entityId: "product-1", action: "POS_PRODUCT_UPDATE", createdAt: new Date("2026-08-19T20:45:00.000Z") },
      { entityId: "product-1", action: "POS_PRODUCT_UPDATE", createdAt: new Date("2026-08-19T21:15:00.000Z") },
      { entityId: "product-2", action: "POS_PRODUCT_CREATE", createdAt: new Date("2026-08-19T21:30:00.000Z") },
      { entityId: "product-3", action: "POS_PRODUCT_COPY", createdAt: new Date("2026-08-19T22:00:00.000Z") },
    ]);

    expect(summary).toMatchObject({
      uploaded: 1,
      edited: 2,
      copied: 1,
    });
  });
});
