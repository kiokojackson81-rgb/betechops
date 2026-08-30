import {
  buildAdminCriticalSmsMessage,
  resolveAdminCriticalSmsRecipients,
} from "@/lib/adminCriticalSmsCore";

describe("admin critical SMS", () => {
  it("uses the dedicated SMS list before fallback numbers", () => {
    expect(resolveAdminCriticalSmsRecipients({
      smsNumbers: "0722151083, +254722151083; 0703241917",
      whatsappNumbers: "0716722151",
      adminPhone: "0700000000",
    })).toEqual(["+254722151083", "+254703241917"]);
  });

  it("falls back to existing WhatsApp recipients", () => {
    expect(resolveAdminCriticalSmsRecipients({
      whatsappNumbers: "254716722151",
    })).toEqual(["+254716722151"]);
  });

  it("keeps the action link when long details are shortened", () => {
    const message = buildAdminCriticalSmsMessage({
      title: "New complaint",
      details: ["Issue ".repeat(200)],
      actionUrl: "https://ops.betech.co.ke/admin/complaints/CMP-2026-000001",
    });
    expect(message.length).toBeLessThanOrEqual(600);
    expect(message).toContain("CMP-2026-000001");
  });
});
