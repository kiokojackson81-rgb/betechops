jest.mock("server-only", () => ({}), { virtual: true });

const mockSendTransactionalSms = jest.fn();
const mockSendGeneralCustomerNotificationEmail = jest.fn();
const mockSendWhatsAppTextMessage = jest.fn();
const mockHasWhatsAppConfig = jest.fn();

jest.mock("@/lib/africasTalking", () => ({
  sendTransactionalSms: mockSendTransactionalSms,
}));

jest.mock("@/lib/email", () => ({
  sendGeneralCustomerNotificationEmail: mockSendGeneralCustomerNotificationEmail,
}));

jest.mock("@/lib/notifications/whatsapp", () => ({
  sendWhatsAppTextMessage: mockSendWhatsAppTextMessage,
  hasWhatsAppConfig: mockHasWhatsAppConfig,
}));

import { sendLppReminderNotifications } from "@/lib/lipaPolePoleNotifications";

describe("lipaPolePoleNotifications", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockHasWhatsAppConfig.mockReturnValue(true);
  });

  test("sends across all channels when customer contacts are available", async () => {
    mockSendTransactionalSms.mockResolvedValue({
      SMSMessageData: { Recipients: [{ messageId: "sms-1" }] },
    });
    mockSendWhatsAppTextMessage.mockResolvedValue({
      messages: [{ id: "wa-1" }],
    });
    mockSendGeneralCustomerNotificationEmail.mockResolvedValue({
      messageId: "email-1",
    });

    const results = await sendLppReminderNotifications({
      reference: "LPP-2026-000145",
      customerName: "Alice",
      customerPhone: "+254712345678",
      customerEmail: "alice@example.com",
      productName: "5kVA Inverter",
      dueDate: new Date("2026-08-21T00:00:00.000Z"),
      reminderType: "REMINDER_7_DAYS",
      agreedTotal: 280000,
      totalPaid: 80000,
      balance: 200000,
      currency: "KES",
    });

    expect(results).toEqual([
      expect.objectContaining({ channel: "SMS", status: "SENT", providerMessageId: "sms-1" }),
      expect.objectContaining({ channel: "WHATSAPP", status: "SENT", providerMessageId: "wa-1" }),
      expect.objectContaining({ channel: "EMAIL", status: "SENT", providerMessageId: "email-1" }),
    ]);
  });

  test("skips unavailable channels instead of throwing", async () => {
    mockHasWhatsAppConfig.mockReturnValue(false);

    const results = await sendLppReminderNotifications({
      reference: "LPP-2026-000146",
      customerName: "Bob",
      customerPhone: null,
      customerEmail: "not-an-email",
      productName: null,
      dueDate: new Date("2026-08-21T00:00:00.000Z"),
      reminderType: "DUE_TODAY",
      agreedTotal: 150000,
      totalPaid: 50000,
      balance: 100000,
      currency: "KES",
    });

    expect(results).toEqual([
      expect.objectContaining({ channel: "SMS", status: "SKIPPED", error: "missing_phone" }),
      expect.objectContaining({ channel: "WHATSAPP", status: "SKIPPED", error: "missing_phone" }),
      expect.objectContaining({ channel: "EMAIL", status: "SKIPPED", error: "missing_or_invalid_email" }),
    ]);
  });
});
