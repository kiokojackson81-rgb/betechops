jest.mock("@/lib/prisma", () => ({ prisma: { receipt: { findUnique: jest.fn(), updateMany: jest.fn() } } }));
import { prisma } from "@/lib/prisma";
import { ensureReceiptPublicToken, getPublicReceiptDocumentsUrl } from "@/lib/publicReceiptLinks";

const read = prisma.receipt.findUnique as jest.Mock;
const write = prisma.receipt.updateMany as jest.Mock;
beforeEach(() => jest.resetAllMocks());

test("reuses a customer's existing link without a write", async () => {
  read.mockResolvedValue({ data: { publicReceiptToken: "rcpt_abcdefghijklmnop" } });
  expect(await getPublicReceiptDocumentsUrl("receipt-1")).toMatch(/\/r\/rcpt_abcdefghijklmnop\/view$/);
  expect(write).not.toHaveBeenCalled();
});

test("preserves receipt data and uses a conditional write", async () => {
  read.mockResolvedValue({ data: { customerName: "Customer" } });
  write.mockResolvedValue({ count: 1 });
  const token = await ensureReceiptPublicToken("receipt-1");
  expect(token).toMatch(/^rcpt_[A-Za-z0-9_-]{16}$/);
  expect(write.mock.calls[0][0]).toEqual({
    where: { id: "receipt-1", data: { equals: { customerName: "Customer" } } },
    data: { data: { customerName: "Customer", publicReceiptToken: token, publicReceiptTokenIssuedAt: expect.any(String) } },
  });
});

test("a concurrent send returns the winner's token", async () => {
  read.mockResolvedValueOnce({ data: {} }).mockResolvedValueOnce({ data: { publicReceiptToken: "rcpt_abcdefghijklmnop" } });
  write.mockResolvedValue({ count: 0 });
  expect(await ensureReceiptPublicToken("receipt-1")).toBe("rcpt_abcdefghijklmnop");
  expect(write).toHaveBeenCalledTimes(1);
});

test("does not create a link for a missing receipt", async () => {
  read.mockResolvedValue(null);
  await expect(ensureReceiptPublicToken("missing")).rejects.toThrow("Receipt not found");
  expect(write).not.toHaveBeenCalled();
});
