jest.mock("@/lib/prisma", () => ({ prisma: { receipt: { findFirst: jest.fn(async () => ({ id: "receipt-1", order: { orderNumber: "Betech-123" } })) } } }));
jest.mock("@/lib/documentAccess", () => ({ documentAccessAllowed: jest.fn(async () => true), documentVerificationPath: () => "/verify" }));
jest.mock("@/lib/receiptPdfResponse", () => ({ buildReceiptPdfResponse: jest.fn(async (_id, options) => new Response("%PDF-test", { headers: { "Content-Type": "application/pdf", "Content-Disposition": options.asDownload ? "attachment" : "inline" } })) }));
import { NextRequest } from "next/server";
import { GET } from "@/app/r/[token]/route";
import { documentAccessAllowed } from "@/lib/documentAccess";
import { buildReceiptPdfResponse } from "@/lib/receiptPdfResponse";
const context = { params: Promise.resolve({ token: "rcpt_abcdefghijklmnop" }) };
beforeEach(() => { jest.clearAllMocks(); (documentAccessAllowed as jest.Mock).mockResolvedValue(true); });
test.each([["", "inline"], ["?download=1", "attachment"]])("PDF %s preserves disposition", async (suffix, disposition) => {
  const response = await GET(new NextRequest(`http://localhost/r/rcpt_abcdefghijklmnop${suffix}`), context);
  expect(response.headers.get("Content-Type")).toBe("application/pdf"); expect(response.headers.get("Content-Disposition")).toBe(disposition);
});
test("expired access redirects PDF requests without rendering a document", async () => {
  (documentAccessAllowed as jest.Mock).mockResolvedValue(false);
  const response = await GET(new NextRequest("http://localhost/r/rcpt_abcdefghijklmnop?download=1"), context);
  expect(response.status).toBe(307); expect(response.headers.get("location")).toBe("http://localhost/verify");
  expect(buildReceiptPdfResponse).not.toHaveBeenCalled();
});
