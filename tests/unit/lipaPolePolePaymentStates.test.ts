import { deriveLppOperationalStatus } from "@/lib/lipaPolePole";

describe("Lipa Pole Pole M-Pesa reservation states", () => {
  it("does not activate a newly reserved plan before a successful settlement", () => {
    expect(deriveLppOperationalStatus({ currentStatus: "AWAITING_PAYMENT", agreedTotal: 20_000, payments: [] })).toBe("AWAITING_PAYMENT");
  });

  it("activates the same plan when the initial STK settlement succeeds", () => {
    expect(deriveLppOperationalStatus({ currentStatus: "AWAITING_PAYMENT", agreedTotal: 20_000, payments: [{ amount: 5_000, status: "SUCCESS" }] })).toBe("ACTIVE");
  });

  it("keeps a failed reservation retryable until a later settlement", () => {
    expect(deriveLppOperationalStatus({ currentStatus: "PAYMENT_FAILED", agreedTotal: 20_000, payments: [] })).toBe("PAYMENT_FAILED");
  });
});
