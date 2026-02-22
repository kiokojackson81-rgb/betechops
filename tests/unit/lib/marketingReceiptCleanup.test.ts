/**
 * @jest-environment node
 */

import { cleanupMarketingReceipts, cleanupSupportReceipts } from "@/lib/marketingReceiptCleanup";

describe("marketingReceiptCleanup", () => {
  describe("cleanupSupportReceipts", () => {
    it("matches by id + receiptKey + receiptNumber variants", async () => {
      const tx: any = {
        supportReceipt: {
          findMany: jest.fn().mockResolvedValue([{ id: "r1", dailyEntryId: null, items: [] }]),
          deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        supportReceiptItem: {
          deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
        supportDailyEntry: {
          update: jest.fn(),
        },
      };

      await cleanupSupportReceipts(tx, "Betech-20260212-35217", "r1");

      expect(tx.supportReceipt.findMany).toHaveBeenCalledTimes(1);
      const args = tx.supportReceipt.findMany.mock.calls[0][0];
      expect(args.where).toEqual({
        OR: [
          { id: "r1" },
          { receiptKey: "BETECH2026021235217" },
          { receiptNumber: "BETECH2026021235217" },
          { receiptNumber: "Betech-20260212-35217" },
        ],
      });
    });

    it("returns early when no receiptNumber or receiptId is provided", async () => {
      const tx: any = {
        supportReceipt: {
          findMany: jest.fn(),
        },
      };

      const res = await cleanupSupportReceipts(tx);

      expect(res).toEqual([]);
      expect(tx.supportReceipt.findMany).not.toHaveBeenCalled();
    });
  });

  describe("cleanupMarketingReceipts", () => {
    it("matches by id + receiptKey + receiptNumber variants", async () => {
      const tx: any = {
        marketingReceipt: {
          findMany: jest.fn().mockResolvedValue([{ id: "m1", dailyEntryId: null, items: [] }]),
          deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        marketingReceiptItem: {
          deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
        marketingDailyEntry: {
          findUnique: jest.fn().mockResolvedValue(null),
          update: jest.fn(),
        },
      };

      await cleanupMarketingReceipts(tx, "Betech-20260212-98732", "m1");

      expect(tx.marketingReceipt.findMany).toHaveBeenCalledTimes(1);
      const args = tx.marketingReceipt.findMany.mock.calls[0][0];
      expect(args.where).toEqual({
        OR: [
          { id: "m1" },
          { receiptKey: "BETECH2026021298732" },
          { receiptNumber: "BETECH2026021298732" },
          { receiptNumber: "Betech-20260212-98732" },
        ],
      });
    });
  });
});

