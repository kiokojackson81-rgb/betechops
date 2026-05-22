import { deriveDefaultCommissionConfigFromUser } from "@/lib/userCommissionConfig";

describe("deriveDefaultCommissionConfigFromUser", () => {
  test("assigns Justus to 10% POS profit share", () => {
    expect(
      deriveDefaultCommissionConfigFromUser({
        email: "justus@betech.co.ke",
        attendantCategory: "SUPPORT_OPS",
      }),
    ).toEqual({
      posTotalsMode: "USER",
      salesCommissionMode: "POS_PROFIT_10",
    });
  });
});
