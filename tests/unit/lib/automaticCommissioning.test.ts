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
import { issueAutomaticCompletionCertificate } from "@/lib/professionalCommissioning";
import { completeCertifiedProject } from "@/lib/projectCompletion";
import { sendCustomerCertificateDelivery } from "@/lib/commissioningDelivery";
const originalFetch = global.fetch;
const profile = { active: true, userId: null, name: "Jonathan Mugiira", title: "Supervisor", qualification: "T3", licenceNumber: "TEST-LICENCE", signatureUrl: "https://example.invalid/signature.png" };
beforeEach(() => {
  jest.clearAllMocks();
  (getBranding as jest.Mock).mockResolvedValue({ licensedProfessional: profile, digitalStampUrl: "https://example.invalid/stamp.png" });
  (isReadyToIssue as jest.Mock).mockReturnValue({ ready: true });
  (prisma.commissioningSession.findUnique as jest.Mock).mockResolvedValue({ id: "s", receiptId: "r", status: "DRAFT", updatedAt: new Date(), customerTermsAcceptedAt: new Date(), data: { installerName: "Agent Jackson", termsAcceptance: { accepted: true } }, receipt: { order: { customerPhone: "0700000000" } } });
  (prisma.commissioningSession.update as jest.Mock).mockResolvedValue({ id: "s", receiptId: "r", status: "ISSUED" });
  (prisma.$transaction as jest.Mock).mockImplementation(async callback => callback(prisma));
  global.fetch = jest.fn().mockResolvedValue({ ok: true, headers: { get: () => "image/png" }, arrayBuffer: async () => Buffer.from("test-image") });
});
afterAll(() => { global.fetch = originalFetch; });
test("automatically signs, completes the project and delivers without a supervisor account login", async () => {
  await issueAutomaticCompletionCertificate({ sessionId: "s", origin: "https://example.invalid", source: "PUBLIC_LINK" });
  const saved = (prisma.commissioningSession.update as jest.Mock).mock.calls[0][0].data;
  expect(saved.status).toBe("ISSUED");
  expect(saved.professionalSignatureSnapshot).toMatch(/^data:image\/png;base64,/);
  expect(saved.professionalReviewedBy).toBeNull();
  expect(saved.data.certificationMode).toBe("AUTOMATIC_SUPERVISOR_SIGNATURE");
  expect(saved.audit[0]).toMatchObject({ action: "CERTIFICATE_AUTO_ISSUED_WITH_SUPERVISOR_SIGNATURE", actorId: null, detail: { automaticSource: "PUBLIC_LINK" } });
  expect(prisma.user.findUnique).not.toHaveBeenCalled();
  expect(completeCertifiedProject).toHaveBeenCalled();
  expect(sendCustomerCertificateDelivery).toHaveBeenCalled();
});
test("an administrator can release a previously pending record with an honest audit actor", async () => {
  const existing = await prisma.commissioningSession.findUnique({ where: { id: "s" } });
  (prisma.commissioningSession.findUnique as jest.Mock).mockResolvedValue({ ...existing, status: "AWAITING_PROFESSIONAL_REVIEW" });
  await issueAutomaticCompletionCertificate({ sessionId: "s", origin: "https://example.invalid", actorId: "admin", source: "STAFF_ACTION" });
  expect((prisma.commissioningSession.update as jest.Mock).mock.calls[0][0].data.audit[0].actorId).toBe("admin");
});
test("incomplete checks cannot issue automatically", async () => {
  (isReadyToIssue as jest.Mock).mockReturnValue({ ready: false });
  await expect(issueAutomaticCompletionCertificate({ sessionId: "s", origin: "https://example.invalid", source: "PUBLIC_LINK" })).rejects.toThrow("must be complete");
  expect(prisma.$transaction).not.toHaveBeenCalled();
});
test("missing supervisor signature or inactive configuration cannot issue automatically", async () => {
  (getBranding as jest.Mock).mockResolvedValue({ licensedProfessional: { ...profile, signatureUrl: null } });
  await expect(issueAutomaticCompletionCertificate({ sessionId: "s", origin: "https://example.invalid", source: "PUBLIC_LINK" })).rejects.toThrow("signature");
  (getBranding as jest.Mock).mockResolvedValue({ licensedProfessional: { ...profile, active: false } });
  await expect(issueAutomaticCompletionCertificate({ sessionId: "s", origin: "https://example.invalid", source: "PUBLIC_LINK" })).rejects.toThrow("Activate");
  expect(prisma.$transaction).not.toHaveBeenCalled();
});
