jest.mock("@/lib/prisma", () => ({ prisma: { commissionPeriod: { findFirst: jest.fn(), create: jest.fn() }, commissionTier: { findMany: jest.fn(), deleteMany: jest.fn(), createMany: jest.fn() } } }));
import { prisma } from "@/lib/prisma";
import { getOrCreateCommissionPeriod } from "@/lib/commission";
test("reading a legacy period preserves customized commission tiers", async () => {
  const tiers = [{ minSales: 500000, maxSales: 1000000, payoutFlat: 12345 }];
  (prisma.commissionPeriod.findFirst as jest.Mock).mockResolvedValue({ id: "existing" });
  (prisma.commissionTier.findMany as jest.Mock).mockResolvedValue(tiers);
  expect((await getOrCreateCommissionPeriod(new Date("2026-08-24T21:00:00Z"))).tiers).toEqual(tiers);
  expect(prisma.commissionTier.deleteMany).not.toHaveBeenCalled();
  expect(prisma.commissionTier.createMany).not.toHaveBeenCalled();
  expect(prisma.commissionPeriod.create).not.toHaveBeenCalled();
  const candidates = (prisma.commissionPeriod.findFirst as jest.Mock).mock.calls[0][0].where.OR;
  expect(candidates[1].startDate.toISOString()).toBe("2026-08-25T00:00:00.000Z");
});
