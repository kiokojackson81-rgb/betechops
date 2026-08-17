jest.mock("server-only", () => ({}), { virtual: true });

const mockSendTransactionalSms = jest.fn();
const mockSendGeneralCustomerNotificationEmail = jest.fn();
const mockSendWhatsAppTextMessage = jest.fn();
const mockHasWhatsAppConfig = jest.fn();

jest.mock("@/lib/africasTalking", () => ({
  sendTransactionalSms: mockSendTransactionalSms,
}));

jest.mock("@/lib/email", () => ({
  sendGeneralCustomerNotificationEmail:
    mockSendGeneralCustomerNotificationEmail,
}));

jest.mock("@/lib/notifications/whatsapp", () => ({
  sendWhatsAppTextMessage: mockSendWhatsAppTextMessage,
  hasWhatsAppConfig: mockHasWhatsAppConfig,
}));

import {
  sendLppLifecycleChannelNotification,
  sendLppReminderNotifications,
  type LppLifecycleNotificationContext,
} from "@/lib/lipaPolePoleNotifications";

const lifecycleContext: LppLifecycleNotificationContext = {
  event: "PAYMENT_VERIFIED",
  recipient: "CUSTOMER",
  reference: "LPP-2026-000147",
  customerName: "Carol",
  customerPhone: "+254712345678",
  customerEmail: "carol@example.com",
  agentName: "Alex",
  agentPhone: "+254722000111",
  agentEmail: "alex@example.com",
  productName: "5kW Solar Kit",
  dueDate: new Date("2026-11-16T00:00:00.000Z"),
  agreedTotal: 280000,
  totalPaid: 80000,
  balance: 200000,
  currency: "KES",
  paymentAmount: 30000,
  paymentReference: "UHG3K3STB0",
  nextInstallmentDate: new Date("2026-09-16T00:00:00.000Z"),
  nextInstallmentAmount: 66667,
  accountUrl: "https://www.betech.co.ke/shop/account/lipa-pole-pole/lpp-1",
  adminUrl: "https://ops.betech.co.ke/admin/lipa-pole-pole?id=lpp-1",
};

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
      expect.objectContaining({
        channel: "SMS",
        status: "SENT",
        providerMessageId: "sms-1",
      }),
      expect.objectContaining({
        channel: "WHATSAPP",
        status: "SENT",
        providerMessageId: "wa-1",
      }),
      expect.objectContaining({
        channel: "EMAIL",
        status: "SENT",
        providerMessageId: "email-1",
      }),
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
      expect.objectContaining({
        channel: "SMS",
        status: "SKIPPED",
        error: "missing_phone",
      }),
      expect.objectContaining({
        channel: "WHATSAPP",
        status: "SKIPPED",
        error: "missing_phone",
      }),
      expect.objectContaining({
        channel: "EMAIL",
        status: "SKIPPED",
        error: "missing_or_invalid_email",
      }),
    ]);
  });

  test("sends a payment verification SMS with balance, next installment, and account link", async () => {
    mockSendTransactionalSms.mockResolvedValue({
      SMSMessageData: { Recipients: [{ messageId: "sms-payment" }] },
    });

    const result = await sendLppLifecycleChannelNotification(
      lifecycleContext,
      "SMS",
    );

    expect(result).toEqual(
      expect.objectContaining({
        status: "SENT",
        providerMessageId: "sms-payment",
      }),
    );
    expect(mockSendTransactionalSms).toHaveBeenCalledWith(
      "+254712345678",
      expect.stringContaining("UHG3K3STB0"),
    );
    expect(mockSendTransactionalSms.mock.calls[0][1]).toContain(
      "Next payment:",
    );
    expect(mockSendTransactionalSms.mock.calls[0][1]).toContain(
      lifecycleContext.accountUrl,
    );
  });

  test("sends assigned agents to the BetechOps account link", async () => {
    mockSendGeneralCustomerNotificationEmail.mockResolvedValue({
      messageId: "email-agent",
    });

    const result = await sendLppLifecycleChannelNotification(
      {
        ...lifecycleContext,
        event: "PAYMENT_SUBMITTED",
        recipient: "ASSIGNED_AGENT",
      },
      "EMAIL",
    );

    expect(result).toEqual(
      expect.objectContaining({
        status: "SENT",
        providerMessageId: "email-agent",
      }),
    );
    expect(mockSendGeneralCustomerNotificationEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "alex@example.com",
        ctaLabel: "Open in BetechOps",
        ctaUrl: lifecycleContext.adminUrl,
      }),
    );
  });

  test("skips lifecycle channels with missing customer contacts", async () => {
    const missingContacts = {
      ...lifecycleContext,
      customerPhone: null,
      customerEmail: null,
    };

    await expect(
      sendLppLifecycleChannelNotification(missingContacts, "SMS"),
    ).resolves.toEqual(
      expect.objectContaining({ status: "SKIPPED", error: "missing_phone" }),
    );
    await expect(
      sendLppLifecycleChannelNotification(missingContacts, "EMAIL"),
    ).resolves.toEqual(
      expect.objectContaining({
        status: "SKIPPED",
        error: "missing_or_invalid_email",
      }),
    );
  });
});
