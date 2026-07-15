import { jest } from "@jest/globals";

const mockQueryRawUnsafe = jest.fn();
const mockExecuteRawUnsafe = jest.fn();
const mockWebsiteOrderFindUnique = jest.fn();
const mockSendWhatsAppTextMessage = jest.fn();
const mockHasWhatsAppConfig = jest.fn();
const mockSendTransactionalSms = jest.fn();

jest.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRawUnsafe: mockQueryRawUnsafe,
    $executeRawUnsafe: mockExecuteRawUnsafe,
    websiteOrder: {
      findUnique: mockWebsiteOrderFindUnique,
    },
  },
}));

jest.mock("@/lib/notifications/whatsapp", () => ({
  sendWhatsAppTextMessage: mockSendWhatsAppTextMessage,
  hasWhatsAppConfig: mockHasWhatsAppConfig,
}));

jest.mock("@/lib/africasTalking", () => ({
  sendTransactionalSms: mockSendTransactionalSms,
}));

describe("reviewsReferrals operations", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("maps failed invitation queue rows for admin operations", async () => {
    const { getReviewInvitationOperations } = await import("@/lib/reviewsReferrals");

    mockQueryRawUnsafe.mockResolvedValueOnce([
      {
        id: "inv_1",
        customerName: "Jane Wanjiku",
        customerPhone: "+254722123456",
        productName: "5KW Hybrid Inverter",
        reviewStatus: "PENDING",
        scheduledSendAt: new Date("2026-07-22T10:00:00.000Z"),
        sentAt: null,
        expiresAt: new Date("2026-10-13T10:00:00.000Z"),
        sendAttempts: 2,
        lastSendAttemptAt: new Date("2026-07-22T10:05:00.000Z"),
        lastSendStatus: "FAILED",
        lastSendError: "SMS send failed.",
        websiteOrderId: "wo_1",
        orderId: null,
        receiptId: null,
        orderOrReceiptRef: "BT-1001",
      },
    ]);

    const rows = await getReviewInvitationOperations({ status: "failed", limit: 5 });

    expect(mockQueryRawUnsafe).toHaveBeenCalled();
    const query = String(mockQueryRawUnsafe.mock.calls.at(-1)?.[0] || "");
    expect(query).toContain(`COALESCE("lastSendStatus", '') = 'FAILED'`);
    expect(rows).toEqual([
      expect.objectContaining({
        id: "inv_1",
        customerName: "Jane Wanjiku",
        customerPhone: "0722 *** 456",
        lastSendStatus: "FAILED",
        lastSendError: "SMS send failed.",
        sendAttempts: 2,
        orderOrReceiptRef: "BT-1001",
      }),
    ]);
  });

  it("retries a specific invitation and refreshes its row", async () => {
    const { retryReviewInvitationSend } = await import("@/lib/reviewsReferrals");

    const baseRow = {
      id: "inv_retry_1",
      customerName: "John Kamau",
      customerPhone: "0722123456",
      productName: "Solar Battery",
      reviewStatus: "PENDING",
      scheduledSendAt: new Date("2026-07-22T10:00:00.000Z"),
      sentAt: null,
      expiresAt: new Date("2026-10-13T10:00:00.000Z"),
      sendAttempts: 1,
      lastSendAttemptAt: new Date("2026-07-22T10:05:00.000Z"),
      lastSendStatus: "FAILED",
      lastSendError: "WhatsApp send failed.",
      websiteOrderId: "wo_2",
      orderId: null,
      receiptId: null,
      orderOrReceiptRef: "BT-2002",
      publicToken: "rvw_existing_public_token",
    };

    mockQueryRawUnsafe
      .mockResolvedValueOnce([baseRow])
      .mockResolvedValueOnce([
        {
          ...baseRow,
          sentAt: new Date("2026-07-22T10:08:00.000Z"),
          sendAttempts: 2,
          lastSendAttemptAt: new Date("2026-07-22T10:08:00.000Z"),
          lastSendStatus: "SENT",
          lastSendError: null,
        },
      ]);
    mockWebsiteOrderFindUnique.mockResolvedValue(null);
    mockHasWhatsAppConfig.mockReturnValue(true);
    mockSendWhatsAppTextMessage.mockResolvedValue({ ok: true });
    mockSendTransactionalSms.mockResolvedValue({ SMSMessageData: { Recipients: [{ status: "Success" }] } });

    const result = await retryReviewInvitationSend("inv_retry_1");

    expect(mockExecuteRawUnsafe).toHaveBeenCalled();
    expect(mockSendWhatsAppTextMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "+254722123456",
      }),
    );
    expect(mockSendTransactionalSms).toHaveBeenCalledWith(
      "+254722123456",
      expect.stringContaining("https://www.betech.co.ke/review/rvw_existing_public_token"),
    );
    expect(result.result).toEqual(
      expect.objectContaining({
        invitationId: "inv_retry_1",
        status: "sent",
      }),
    );
    expect(result.invitation).toEqual(
      expect.objectContaining({
        id: "inv_retry_1",
        sentAt: "2026-07-22T10:08:00.000Z",
        lastSendStatus: "SENT",
        sendAttempts: 2,
      }),
    );
  });
});
