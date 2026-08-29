import { jest } from "@jest/globals";

const convertLppToPos = jest.fn(async () => ({}));
const getSerializedLppAccountDetail = jest.fn(async () => ({ account: { id: "lpp-1" } }));

jest.mock("next/headers", () => ({
  headers: jest.fn(async () => new Headers({ cookie: "session=test" })),
}));

jest.mock("@/lib/abs-url", () => ({
  absUrl: jest.fn(async (path: string) => `https://ops.betech.co.ke${path}`),
}));

jest.mock("@/lib/api", () => ({
  getActorId: jest.fn(async () => "admin-1"),
  requireRole: jest.fn(async () => ({
    ok: true,
    session: { user: { id: "admin-1" } },
  })),
  noStoreJson: jest.fn((body: unknown, init?: ResponseInit) =>
    Response.json(body, init),
  ),
}));

jest.mock("@/lib/lipaPolePoleService", () => ({
  convertLppToPos,
  getSerializedLppAccountDetail,
  getLppAccountSummary: jest.fn(async () => ({
    lpp: {
      id: "lpp-1",
      reference: "LPP-2026-000004",
      customerId: "customer-1",
      salespersonId: "jeniffer-1",
      assignedToId: "jeniffer-1",
      convertedReceiptId: null,
    },
    items: [
      {
        productId: "product-1",
        description: "Solar kit",
        quantity: 1,
        unitPrice: 42400,
        serial: null,
        warranty: null,
      },
    ],
    summary: { totalPaid: 42400, agreedTotal: 42400 },
  })),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: jest.fn(async () => ({
        name: "Veronicah Ogaye",
        phone: "+254700000000",
        email: "customer@example.com",
      })),
    },
  },
}));

import { POST } from "@/app/api/lipa-pole-pole/[id]/convert/pos/route";

describe("Lipa Pole Pole POS conversion attribution", () => {
  afterEach(() => jest.restoreAllMocks());

  it("credits the original salesperson while preserving the converter in metadata", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      Response.json({ receiptId: "receipt-1" }),
    );

    const response = await POST(
      new Request("https://ops.betech.co.ke/api/lipa-pole-pole/lpp-1/convert/pos", {
        method: "POST",
        body: JSON.stringify({}),
      }),
      { params: { id: "lpp-1" } },
    );

    expect(response.status).toBe(200);
    const request = fetchMock.mock.calls[0]?.[1];
    const payload = JSON.parse(String(request?.body));

    expect(payload.attendantId).toBe("jeniffer-1");
    expect(payload.issuedById).toBeUndefined();
    expect(payload.metadata).toEqual(
      expect.objectContaining({
        lppSalespersonId: "jeniffer-1",
        lppReceiptOwnerId: "jeniffer-1",
        lppConvertedById: "admin-1",
      }),
    );
    expect(convertLppToPos).toHaveBeenCalledWith({
      lipaPolePoleId: "lpp-1",
      receiptId: "receipt-1",
      convertedById: "admin-1",
    });
  });
});
