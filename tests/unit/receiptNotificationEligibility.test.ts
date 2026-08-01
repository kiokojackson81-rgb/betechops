import { shouldUseGenericReceiptNotifications } from "@/lib/receiptNotificationEligibility";

describe("shouldUseGenericReceiptNotifications", () => {
  it("allows normal receipt customer types", () => {
    expect(shouldUseGenericReceiptNotifications({ customerType: "walk-in" })).toBe(true);
    expect(shouldUseGenericReceiptNotifications({ customerType: "online" })).toBe(true);
    expect(shouldUseGenericReceiptNotifications({ customerType: "delivery" })).toBe(true);
    expect(shouldUseGenericReceiptNotifications({ customerType: "pod" })).toBe(true);
  });

  it("blocks project customer types", () => {
    expect(shouldUseGenericReceiptNotifications({ customerType: "project" })).toBe(false);
    expect(shouldUseGenericReceiptNotifications({ customerType: " Project " })).toBe(false);
  });

  it("blocks explicit project completion sources", () => {
    expect(shouldUseGenericReceiptNotifications({ source: "PROJECT_COMPLETION" })).toBe(false);
  });

  it("blocks explicit suppression flags", () => {
    expect(
      shouldUseGenericReceiptNotifications({
        customerType: "walk-in",
        suppressGenericCustomerNotifications: true,
      }),
    ).toBe(false);
  });
});
