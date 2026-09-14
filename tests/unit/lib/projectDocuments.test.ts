jest.mock("server-only", () => ({}), { virtual: true });
jest.mock("@/lib/prisma", () => ({ prisma: { commissioningSession: { updateMany: jest.fn(), findUniqueOrThrow: jest.fn(), findUnique: jest.fn(), update: jest.fn() } } }));
jest.mock("@vercel/blob", () => ({ put: jest.fn() }));
jest.mock("@/lib/commissioningCertificate", () => ({ buildCommissioningCertificatePdf: jest.fn() }));
jest.mock("@/app/receipts/buildSnapshot", () => ({ buildReceiptSnapshot: jest.fn(value => value) }));
jest.mock("@/workers/receiptSender", () => ({ generateReceiptPdf: jest.fn() }));
jest.mock("@/lib/warrantyCertificates", () => ({ getWarrantyCertificate: jest.fn(), issueWarrantyCertificate: jest.fn() }));
jest.mock("@/lib/commissioning", () => ({ ensureCustomerCertificateToken: jest.fn() }));
jest.mock("@/lib/commissioningSms", () => ({ sendCommissioningSms: jest.fn() }));
import { prisma } from "@/lib/prisma";
import { put } from "@vercel/blob";
import { buildCommissioningCertificatePdf } from "@/lib/commissioningCertificate";
import { generateReceiptPdf } from "@/workers/receiptSender";
import { getWarrantyCertificate, issueWarrantyCertificate } from "@/lib/warrantyCertificates";
import { prepareProjectDocuments } from "@/lib/projectDocuments";
import { sendCustomerCertificateDelivery } from "@/lib/commissioningDelivery";
import { sendCommissioningSms } from "@/lib/commissioningSms";

let state: Record<string, unknown>;
beforeEach(() => {
  jest.clearAllMocks(); process.env.BLOB_READ_WRITE_TOKEN = "test-only";
  state = { id: "s", receiptId: "r", status: "ISSUED", certificateNo: "CERT", receipt: { receiptNumber: "PROJECT", order: { customerName: "Thomas", customerPhone: "0722000000" } } };
  (prisma.commissioningSession.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
  (prisma.commissioningSession.findUniqueOrThrow as jest.Mock).mockImplementation(async () => ({ ...state }));
  (prisma.commissioningSession.findUnique as jest.Mock).mockImplementation(async () => ({ ...state }));
  (prisma.commissioningSession.update as jest.Mock).mockImplementation(async ({ data }) => { Object.assign(state, data); return state; });
  (put as jest.Mock).mockImplementation(async (key: string) => ({ url: `https://example.invalid/${key}` }));
  (buildCommissioningCertificatePdf as jest.Mock).mockResolvedValue(Buffer.from("completion"));
  (generateReceiptPdf as jest.Mock).mockResolvedValue(Buffer.from("receipt"));
  (getWarrantyCertificate as jest.Mock).mockResolvedValue(null);
});

test("warranty failure leaves the project completed and retries reuse successful stored PDFs", async () => {
  (issueWarrantyCertificate as jest.Mock).mockRejectedValueOnce(new Error("warranty unavailable")).mockResolvedValueOnce({ certificate: { certificateNo: "WARRANTY" } });
  await expect(prepareProjectDocuments({ sessionId: "s", origin: "https://example.invalid" })).rejects.toThrow("warranty unavailable");
  expect(state.status).toBe("ISSUED"); expect(state.documentsReadyAt).toBeFalsy();
  expect(state.completionPdfUrl).toBeTruthy(); expect(state.projectReceiptPdfUrl).toBeTruthy();
  await expect(sendCustomerCertificateDelivery({ sessionId: "s", certificateUrl: "https://example.invalid/certificate/token" })).rejects.toThrow("must all be ready");
  expect(sendCommissioningSms).not.toHaveBeenCalled();
  await prepareProjectDocuments({ sessionId: "s", origin: "https://example.invalid" });
  expect(buildCommissioningCertificatePdf).toHaveBeenCalledTimes(1);
  expect(generateReceiptPdf).toHaveBeenCalledTimes(1);
  expect(state.documentsReadyAt).toBeInstanceOf(Date);
});

test("failed SMS is not recorded as customer delivery", async () => {
  state.documentsReadyAt = new Date(); state.completionPdfUrl = "completion"; state.projectReceiptPdfUrl = "receipt";
  (getWarrantyCertificate as jest.Mock).mockResolvedValue({ certificateNo: "WARRANTY" });
  (sendCommissioningSms as jest.Mock).mockResolvedValue({ status: "FAILED", error: "Provider unavailable" });
  const response = await sendCustomerCertificateDelivery({ sessionId: "s", certificateUrl: "https://example.invalid/certificate/token" });
  expect(response.results.sms).toBe("FAILED");
  expect(prisma.commissioningSession.update).not.toHaveBeenCalled();
});

test("one customer SMS includes the receipt and both certificates after readiness", async () => {
  state.documentsReadyAt = new Date(); state.completionPdfUrl = "completion"; state.projectReceiptPdfUrl = "receipt";
  (getWarrantyCertificate as jest.Mock).mockResolvedValue({ certificateNo: "WARRANTY" });
  (sendCommissioningSms as jest.Mock).mockResolvedValue({ status: "SENT" });
  await sendCustomerCertificateDelivery({ sessionId: "s", certificateUrl: "https://example.invalid/certificate/token" });
  expect(sendCommissioningSms).toHaveBeenCalledTimes(1);
  expect((sendCommissioningSms as jest.Mock).mock.calls[0][0].message).toContain("Receipt, Completion Certificate and Warranty Certificate");
  expect(state.customerDeliveredAt).toBeInstanceOf(Date);
});
