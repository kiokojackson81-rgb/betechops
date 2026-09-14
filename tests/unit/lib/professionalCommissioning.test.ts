jest.mock("server-only", () => ({}), { virtual: true });
jest.mock("@/lib/prisma", () => ({ prisma: { commissioningSession: { findUnique: jest.fn(), update: jest.fn() }, user: { findUnique: jest.fn() } } }));
jest.mock("@/lib/branding", () => ({ getBranding: jest.fn() }));
jest.mock("@/lib/commissioning", () => ({}));
jest.mock("@/lib/commissioningDelivery", () => ({}));
jest.mock("@/lib/warrantyCertificates", () => ({}));
import { prisma } from "@/lib/prisma";
import { technicianIsLicensedProfessional, issueProfessionallyApprovedCertificate } from "@/lib/professionalCommissioning";

const professional = { userId: "professional-account", name: "Jonathan Mugiira", title: "Engineer", qualification: "EPRA T3", licenceNumber: "TEST-LICENCE", signatureUrl: "https://example.invalid/signature.png" };

test("a matching display name never grants professional certification", () => {
  expect(technicianIsLicensedProfessional("Jonathan Mugiira", professional, "other-account")).toBe(false);
  expect(technicianIsLicensedProfessional("Updated display name", professional, "professional-account")).toBe(true);
  expect(technicianIsLicensedProfessional("Jonathan Mugiira", { ...professional, userId: null }, null)).toBe(false);
});

test("another administrator cannot apply the professional signature", async () => {
  (prisma.commissioningSession.findUnique as jest.Mock).mockResolvedValue({ status: "AWAITING_PROFESSIONAL_REVIEW" });
  await expect(issueProfessionallyApprovedCertificate({ sessionId: "test", origin: "https://example.invalid", professional, approvedById: "other-admin" })).rejects.toThrow("Only the licensed professional");
  expect(prisma.commissioningSession.update).not.toHaveBeenCalled();
});

test("issued certificates cannot be certified again", async () => {
  (prisma.commissioningSession.findUnique as jest.Mock).mockResolvedValue({ status: "ISSUED" });
  await expect(issueProfessionallyApprovedCertificate({ sessionId: "test", origin: "https://example.invalid", professional, approvedById: professional.userId })).rejects.toThrow("already been issued");
});
