import { quoteRequestResponseSchema } from "@/lib/quoteRequests";

describe("quoteRequestResponseSchema", () => {
  it("allows status-only updates without quotation line items", () => {
    const parsed = quoteRequestResponseSchema.safeParse({
      status: "CLOSED",
      quoteItems: [],
      sendEmail: false,
      sendSms: false,
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.status).toBe("CLOSED");
      expect(parsed.data.quoteItems).toEqual([]);
    }
  });
});

