jest.mock("server-only", () => ({}), { virtual: true });

import {
  combineMarketingProductActivity,
  summarizeManualMarketplaceProductActivityEntries,
  summarizeMarketingProductActivityRows,
} from "@/lib/marketingProductActivity";

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

  it("keeps manual Jumia and Kilimall activity separate and provides a combined total", () => {
    const marketplace = summarizeManualMarketplaceProductActivityEntries([
      {
        payload: {
          numeric: {
            jumiaProductsUploaded: 4,
            jumiaProductsEdited: 2,
            kilimallProductsUploaded: 3,
            kilimallProductsCopied: 1,
          },
        },
      },
      {
        payload: {
          numeric: {
            jumiaProductsUploaded: 1,
            kilimallProductsEdited: 2,
          },
        },
      },
    ]);

    expect(marketplace.jumia).toMatchObject({ uploaded: 5, edited: 2, copied: 0 });
    expect(marketplace.kilimall).toMatchObject({ uploaded: 3, edited: 2, copied: 1 });
    expect(marketplace.total).toMatchObject({ uploaded: 8, edited: 4, copied: 1 });
  });

  it("combines automatic website and manual marketplace counts before commission", () => {
    const website = summarizeMarketingProductActivityRows([
      {
        entityId: "website-1",
        action: "POS_PRODUCT_CREATE",
        createdAt: new Date("2026-08-20T08:00:00.000Z"),
      },
    ]);
    const marketplace = summarizeManualMarketplaceProductActivityEntries([
      {
        payload: {
          numeric: {
            jumiaProductsUploaded: 2,
            kilimallProductsEdited: 1,
          },
        },
      },
    ]);

    expect(combineMarketingProductActivity(website, marketplace.total)).toMatchObject({
      uploaded: 3,
      edited: 1,
      copied: 0,
    });
  });
});
