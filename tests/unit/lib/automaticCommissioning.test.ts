jest.mock("server-only", () => ({}), { virtual: true });
jest.mock("@/lib/prisma", () => ({ prisma: { commissioningSession: { findUnique: jest.fn(), update: jest.fn() }, user: { findUnique: jest.fn() }, $transaction: jest.fn() } }));
jest.mock("@/lib/branding", () => ({ getBranding: jest.fn() }));
jest.mock("@/lib/commissioningValidation", () => ({ isReadyToIssue: jest.fn() }));
jest.mock("@/lib/commissioning", () => ({ certificateNumber: () => "CERT-TEST", projectSummary: () => ({ reference: "TEST", customerName: "Test Customer" }), appendCommissioningAudit: (_: unknown, event: unknown) => [event] }));
jest.mock("@/lib/projectCompletion", () => ({ completeCertifiedProject: jest.fn() }));
jest.mock("@/lib/projectDocuments", () => ({ prepareProjectDocuments: jest.fn().mockResolvedValue({}) }));
jest.mock("@/lib/posCustomerAccountSync", () => ({ syncPosReceiptToCustomerAccount: jest.fn().mockResolvedValue({}) }));
jest.mock("@/lib/commissioningDelivery", () => ({ ensureCustomerCertificateToken: jest.fn().mockResolvedValue("customer-token"), sendCustomerCertificateDelivery: jest.fn().mockResolvedValue({ status: "SENT" }) }));
import { prisma } from "@/lib/prisma";
import { getBranding } from "@/lib/branding";
import { isReadyToIssue } from "@/lib/commissioningValidation";
import { issueProfessionallyApprovedCertificate } from "@/lib/professionalCommissioning";
import { completeCertifiedProject } from "@/lib/projectCompletion";
import { sendCustomerCertificateDelivery } from "@/lib/commissioningDelivery";
const originalFetch = global.fetch;
const profile = { active: true, userId: "licensed-professional", name: "Jonathan Mugiira", title: "Supervisor", qualification: "T3", licenceNumber: "TEST-LICENCE", signatureUrl: "https://example.invalid/signature.png", stampUrl: "https://example.invalid/stamp.png" };
beforeEach(() => {
  jest.clearAllMocks();
  (getBranding as jest.Mock).mockResolvedValue({ licensedProfessional: profile, digitalStampUrl: "https://example.invalid/stamp.png" });
  (isReadyToIssue as jest.Mock).mockReturnValue({ ready: true });
  (prisma.commissioningSession.findUnique as jest.Mock).mockResolvedValue({ id: "s", receiptId: "r", status: "AWAITING_PROFESSIONAL_REVIEW", updatedAt: new Date(), customerTermsAcceptedAt: new Date(), data: { installerName: "Agent Jackson", termsAcceptance: { accepted: true } }, receipt: { order: { customerPhone: "0700000000" } } });
  (prisma.commissioningSession.update as jest.Mock).mockResolvedValue({ id: "s", receiptId: "r", status: "ISSUED" });
  (prisma.user.findUnique as jest.Mock).mockResolvedValue({ isActive: true });
  (prisma.$transaction as jest.Mock).mockImplementation(async callback => callback(prisma));
  global.fetch = jest.fn().mockResolvedValue({ ok: true, headers: { get: () => "image/png" }, arrayBuffer: async () => Buffer.from("test-image") });
});
afterAll(() => { global.fetch = originalFetch; });
test("records a licensed professional authorisation, then completes and delivers the project", async () => {
  await issueProfessionallyApprovedCertificate({ sessionId: "s", origin: "https://example.invalid", professional: profile, approvedById: "licensed-professional", approvedByName: "Jonathan Mugiira" });
  const saved = (prisma.commissioningSession.update as jest.Mock).mock.calls[0][0].data;
  expect(saved.status).toBe("ISSUED");
  expect(saved.professionalSignatureSnapshot).toMatch(/^data:image\/png;base64,/);
  expect(saved.professionalReviewedBy).toBe("Jonathan Mugiira");
  expect(saved.data.certificationMode).toBe("PROFESSIONAL_REVIEW");
  expect(saved.audit[0]).toMatchObject({ action: "CERTIFICATE_ISSUED_AFTER_PROFESSIONAL_CERTIFICATION", actorId: "licensed-professional" });
  expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: "licensed-professional" }, select: { isActive: true } });
  expect(completeCertifiedProject).toHaveBeenCalled();
  expect(sendCustomerCertificateDelivery).toHaveBeenCalled();
});
test("rejects an administrator who is not the linked licensed professional", async () => {
  await expect(issueProfessionallyApprovedCertificate({ sessionId: "s", origin: "https://example.invalid", professional: profile, approvedById: "admin" })).rejects.toThrow("Only the licensed professional");
  expect(prisma.$transaction).not.toHaveBeenCalled();
});
test("incomplete checks cannot be authorised", async () => {
  (isReadyToIssue as jest.Mock).mockReturnValue({ ready: false });
  await expect(issueProfessionallyApprovedCertificate({ sessionId: "s", origin: "https://example.invalid", professional: profile, approvedById: "licensed-professional" })).rejects.toThrow("must be complete");
  expect(prisma.$transaction).not.toHaveBeenCalled();
});
test("requires the configured signature before professional authorisation", async () => {
  await expect(issueProfessionallyApprovedCertificate({ sessionId: "s", origin: "https://example.invalid", professional: { ...profile, signatureUrl: null }, approvedById: "licensed-professional" })).rejects.toThrow("signature");
  expect(prisma.$transaction).not.toHaveBeenCalled();
});
