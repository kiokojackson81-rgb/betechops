jest.mock("server-only", () => ({}), { virtual: true });
jest.mock("@/lib/prisma", () => ({ prisma: {} }));
jest.mock("@/lib/mpesaRefunds", () => ({ requireMpesaRefundAdmin: jest.fn(), createMpesaRefundDraft: jest.fn() }));
import { requireMpesaRefundAdmin, createMpesaRefundDraft } from "@/lib/mpesaRefunds";
import { POST } from "@/app/api/admin/mpesa-refunds/route";

describe("M-Pesa refund authorization", () => {
  beforeEach(() => jest.resetAllMocks());
  it("does not allow ordinary staff to create a refund request", async () => {
    (requireMpesaRefundAdmin as jest.Mock).mockResolvedValue({ ok: false, status: 403, error: "PAYMENT_REFUND authorization is required" });
    const response = await POST(new Request("http://localhost/api/admin/mpesa-refunds", { method: "POST", body: JSON.stringify({ paymentId: "payment-1", amount: 10, reason: "Test" }) }) as any);
    expect(response.status).toBe(403);
    expect(createMpesaRefundDraft).not.toHaveBeenCalled();
  });
});
