jest.mock("@/lib/websiteOrders", () => ({ requireWebsiteOrdersAdmin: jest.fn() }));
jest.mock("@/lib/mpesa", () => ({ reconcileUnmatchedMpesaPayment: jest.fn() }));

import { requireWebsiteOrdersAdmin } from "@/lib/websiteOrders";
import { reconcileUnmatchedMpesaPayment } from "@/lib/mpesa";
import { POST } from "@/app/api/admin/mpesa-payments/[id]/reconcile/route";

describe("M-Pesa reconciliation authorization", () => {
  beforeEach(() => jest.resetAllMocks());

  it("rejects an unauthorized reconciliation attempt", async () => {
    (requireWebsiteOrdersAdmin as jest.Mock).mockResolvedValue({ ok: false, status: 403, error: "Forbidden" });
    const response = await POST(new Request("http://localhost/api/admin/mpesa-payments/payment-1/reconcile", {
      method: "POST",
      body: JSON.stringify({ targetKind: "ORDER", targetId: "order-1", confirm: true }),
    }) as any, { params: Promise.resolve({ id: "payment-1" }) });

    expect(response.status).toBe(403);
    expect(reconcileUnmatchedMpesaPayment).not.toHaveBeenCalled();
  });
});
