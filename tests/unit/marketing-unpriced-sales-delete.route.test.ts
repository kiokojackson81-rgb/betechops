/**
 * @jest-environment node
 */

jest.mock("next-auth/next", () => ({
  getServerSession: jest.fn(),
}));

jest.mock("@/lib/nextAuth", () => ({
  authOptions: {},
}));

jest.mock("@/lib/marketingReceiptCleanup", () => ({
  cleanupMarketingReceipts: jest.fn(),
  cleanupSupportReceipts: jest.fn(),
  deleteReceiptOrderCascade: jest.fn(),
}));

jest.mock("@/lib/prisma", () => {
  const supportReceipt = {
    findUnique: jest.fn(),
  };
  const supportReceiptItem = {
    findUnique: jest.fn(),
  };
  const dailySale = {
    findUnique: jest.fn(),
  };
  const client = {
    supportReceipt,
    supportReceiptItem,
    dailySale,
  };
  return {
    prisma: {
      ...client,
      $transaction: jest.fn(async (cb: any) => cb({})),
    },
  };
});

import { POST } from "@/app/api/marketing/unpriced-sales/delete/route";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/prisma";
import {
  cleanupMarketingReceipts,
  cleanupSupportReceipts,
  deleteReceiptOrderCascade,
} from "@/lib/marketingReceiptCleanup";

const mockedGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>;
const mockedSupportReceiptFindUnique = prisma.supportReceipt.findUnique as jest.Mock;
const mockedSupportReceiptItemFindUnique = prisma.supportReceiptItem.findUnique as jest.Mock;
const mockedTransaction = prisma.$transaction as jest.Mock;

describe("POST /api/marketing/unpriced-sales/delete (support receipts)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetServerSession.mockResolvedValue({
      user: { email: "admin@betech.co.ke", role: "ADMIN" },
    } as any);
    (cleanupMarketingReceipts as jest.Mock).mockResolvedValue([]);
    (cleanupSupportReceipts as jest.Mock).mockResolvedValue([]);
    (deleteReceiptOrderCascade as jest.Mock).mockResolvedValue(true);
  });

  it("deletes a support receipt when saleId is supportReceipt.id", async () => {
    mockedSupportReceiptFindUnique.mockResolvedValue({
      id: "receipt-1",
      receiptNumber: "Betech-20260212-98732",
      items: [
        { id: "it-1", buyingPrice: 0 },
        { id: "it-2", buyingPrice: 0 },
      ],
    });
    mockedSupportReceiptItemFindUnique.mockResolvedValue(null);

    const res = await POST(
      new Request("http://localhost/api/marketing/unpriced-sales/delete", {
        method: "POST",
        body: JSON.stringify({ saleId: "receipt-1", source: "support" }),
      }),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true, removed: "support" });
    expect(mockedTransaction).toHaveBeenCalledTimes(1);
    expect(cleanupSupportReceipts).toHaveBeenCalledWith(expect.anything(), "Betech-20260212-98732", "receipt-1");
    expect(cleanupMarketingReceipts).toHaveBeenCalledWith(expect.anything(), "Betech-20260212-98732");
    expect(deleteReceiptOrderCascade).toHaveBeenCalledWith(expect.anything(), "Betech-20260212-98732");
  });

  it("supports deleting by supportReceiptItem.id (backward compatibility)", async () => {
    mockedSupportReceiptFindUnique.mockResolvedValue(null);
    mockedSupportReceiptItemFindUnique.mockResolvedValue({
      id: "item-1",
      receiptId: "receipt-2",
      receipt: {
        id: "receipt-2",
        receiptNumber: "Betech-20260212-35217",
        items: [{ id: "item-1", buyingPrice: 0 }],
      },
    });

    const res = await POST(
      new Request("http://localhost/api/marketing/unpriced-sales/delete", {
        method: "POST",
        body: JSON.stringify({ saleId: "item-1", source: "support" }),
      }),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true, removed: "support" });
    expect(cleanupSupportReceipts).toHaveBeenCalledWith(expect.anything(), "Betech-20260212-35217", "receipt-2");
  });

  it("blocks deleting receipts that already have priced items", async () => {
    mockedSupportReceiptFindUnique.mockResolvedValue({
      id: "receipt-3",
      receiptNumber: "Betech-20260212-11111",
      items: [
        { id: "it-1", buyingPrice: 0 },
        { id: "it-2", buyingPrice: 250 },
      ],
    });

    const res = await POST(
      new Request("http://localhost/api/marketing/unpriced-sales/delete", {
        method: "POST",
        body: JSON.stringify({ saleId: "receipt-3", source: "support" }),
      }),
    );

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: "Receipt already has priced items; cannot remove from queue",
    });
    expect(cleanupSupportReceipts).not.toHaveBeenCalled();
    expect(cleanupMarketingReceipts).not.toHaveBeenCalled();
  });

  it("returns 404 when no matching support receipt or item exists", async () => {
    mockedSupportReceiptFindUnique.mockResolvedValue(null);
    mockedSupportReceiptItemFindUnique.mockResolvedValue(null);

    const res = await POST(
      new Request("http://localhost/api/marketing/unpriced-sales/delete", {
        method: "POST",
        body: JSON.stringify({ saleId: "missing", source: "support" }),
      }),
    );

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Support sale not found" });
  });
});

