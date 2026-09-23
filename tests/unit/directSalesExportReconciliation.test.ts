jest.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: jest.fn().mockResolvedValue({ name: "Seller", email: "seller@example.test" }) } } }));
jest.mock("@/lib/api", () => ({ requireRole: jest.fn().mockResolvedValue({ ok: true }) }));
jest.mock("@/lib/branding", () => ({ getBranding: jest.fn().mockResolvedValue({}) }));
jest.mock("@/lib/pdf/chromium", () => ({ launchChromiumBrowser: jest.fn() }));
jest.mock("@/lib/attendantCommission", () => ({ getAttendantCommissionSummary: jest.fn() }));
import { GET } from "@/app/api/admin/receipts/pos-direct-sales-pdf/route";
import { getAttendantCommissionSummary } from "@/lib/attendantCommission";
import { launchChromiumBrowser } from "@/lib/pdf/chromium";
const url = "http://localhost/api/admin/receipts/pos-direct-sales-pdf?attendantId=staff&start=2026-08-25&end=2026-09-24";
beforeEach(() => {
  (getAttendantCommissionSummary as jest.Mock).mockResolvedValue({ receiptBreakdown: [
    { receiptKey: "ELIGIBLE", docType: "RECEIPT", sales: 10000, eligibleSales: 10000, eligible: true, profit: 3000, commission: 300, salesDate: new Date("2026-09-22"), customerName: "<script>bad</script>", reason: "Eligible", paymentMethod: "MPESA" },
    { receiptKey: "PENDING", docType: "RECEIPT", sales: 25000, eligibleSales: 0, eligible: false, profit: 0, commission: 0, salesDate: null, createdAt: new Date("2026-09-22"), reason: "Awaiting complete buying prices" },
  ] });
});
test("admin export includes pending receipts without counting them as commission eligible", async () => {
  const response = await GET(new Request(url + "&debug=1"));
  const body = await response.json();
  expect(body).toMatchObject({ totalSales: 10000, recordedSales: 35000, receiptCount: 1, commissionKes: 300 });
  expect(body.rows.map((row: any) => row.receiptNumber)).toEqual(["ELIGIBLE", "PENDING"]);
  expect((getAttendantCommissionSummary as jest.Mock).mock.calls[0][0].start.toISOString()).toBe("2026-08-24T21:00:00.000Z");
});
test("PDF uses the same rows and safely renders customer text", async () => {
  const page = { setContent: jest.fn(), pdf: jest.fn().mockResolvedValue(Buffer.from("%PDF-test")) };
  (launchChromiumBrowser as jest.Mock).mockResolvedValue({ newPage: async () => page, close: jest.fn() });
  const response = await GET(new Request(url));
  expect(response.headers.get("Content-Type")).toBe("application/pdf");
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  const html = page.setContent.mock.calls[0][0];
  expect(html).toContain("PENDING");
  expect(html).toContain("Awaiting complete buying prices");
  expect(html).toContain("&lt;script&gt;bad&lt;/script&gt;");
  expect(html).not.toContain("<script>bad</script>");
});
