jest.mock("@/lib/documentAccess", () => ({ documentAccessAllowed: jest.fn(), documentVerificationPath: () => "/verify" }));
jest.mock("@/lib/commissioning", () => ({ findCustomerCertificateSession: jest.fn() }));
jest.mock("@/lib/warrantyCertificates", () => ({ getWarrantyCertificate: jest.fn(), warrantyPdfBytes: jest.fn() }));
jest.mock("@/lib/storedProjectDocument", () => ({ storedProjectDocument: jest.fn() }));
jest.mock("@/lib/receiptPdfResponse", () => ({ buildReceiptPdfResponse: jest.fn() }));
import { NextRequest } from "next/server";
import { GET } from "@/app/api/certificate/[token]/documents/[kind]/route";
import { documentAccessAllowed } from "@/lib/documentAccess";
import { findCustomerCertificateSession } from "@/lib/commissioning";
import { buildReceiptPdfResponse } from "@/lib/receiptPdfResponse";
const context = { params: Promise.resolve({ token: "token", kind: "receipt" }) };
beforeEach(() => jest.clearAllMocks());
test("expired unverified links cannot render a receipt", async () => {
  (documentAccessAllowed as jest.Mock).mockResolvedValue(false);
  const response = await GET(new NextRequest("https://example.invalid/api/certificate/token/documents/receipt"), context);
  expect(response.status).toBe(401);
  expect(buildReceiptPdfResponse).not.toHaveBeenCalled();
});
test("verified link downloads the current receipt and retains privacy headers", async () => {
  (documentAccessAllowed as jest.Mock).mockResolvedValue(true);
  (findCustomerCertificateSession as jest.Mock).mockResolvedValue({ receiptId: "r" });
  (buildReceiptPdfResponse as jest.Mock).mockResolvedValue(new Response("pdf"));
  const response = await GET(new NextRequest("https://example.invalid/api/certificate/token/documents/receipt?download=1"), context);
  expect(buildReceiptPdfResponse).toHaveBeenCalledWith("r", { asDownload: true, allowCached: false });
  expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
});
