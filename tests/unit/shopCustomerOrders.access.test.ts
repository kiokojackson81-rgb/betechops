jest.mock("server-only", () => ({}), { virtual: true });

import { canCustomerAccessAccountOrder } from "@/lib/shopCustomerOrders";

describe("customer account order access", () => {
  const customer = {
    userId: "customer-a",
    phoneVariants: ["254700000001"],
    normalizedEmails: ["customer@example.com"],
  };

  it("allows the customer explicitly assigned to an order", () => {
    expect(
      canCustomerAccessAccountOrder({
        ...customer,
        customerUserId: "customer-a",
        customerPhone: "254700000099",
        customerEmail: "another@example.com",
      }),
    ).toBe(true);
  });

  it("never exposes another account's order through a matching legacy contact", () => {
    expect(
      canCustomerAccessAccountOrder({
        ...customer,
        customerUserId: "customer-b",
        customerPhone: "254700000001",
        customerEmail: "customer@example.com",
      }),
    ).toBe(false);
  });

  it("allows a legacy unassigned order only when its phone or email matches", () => {
    expect(
      canCustomerAccessAccountOrder({
        ...customer,
        customerUserId: null,
        customerPhone: "0700000001",
        customerEmail: null,
      }),
    ).toBe(true);
    expect(
      canCustomerAccessAccountOrder({
        ...customer,
        customerUserId: null,
        customerPhone: null,
        customerEmail: "customer@example.com",
      }),
    ).toBe(true);
  });
});
