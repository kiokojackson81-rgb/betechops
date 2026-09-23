jest.mock("@/lib/prisma", () => ({ prisma: { userCommissionConfig: { findUnique: jest.fn(), update: jest.fn() }, user: { findUnique: jest.fn() } } }));
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

import { getUserCommissionConfigLike, getOrCreateUserCommissionConfig } from "@/lib/userCommissionConfig";
import { prisma } from "@/lib/prisma";
test("an explicitly configured mode is not overwritten by email defaults", async () => {
  const config = { userId: "staff", posTotalsMode: "USER", salesCommissionMode: "DEFAULT_TIERS" };
  (prisma.userCommissionConfig.findUnique as jest.Mock).mockResolvedValue(config);
  (prisma.user.findUnique as jest.Mock).mockResolvedValue({ email: "brendah@betech.co.ke" });
  expect(await getUserCommissionConfigLike("staff")).toEqual(config);
  expect(await getOrCreateUserCommissionConfig("staff")).toEqual(config);
  expect(prisma.userCommissionConfig.update).not.toHaveBeenCalled();
});
