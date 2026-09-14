jest.mock("@/lib/prisma", () => ({ prisma: { branding: { findUnique: jest.fn() } } }));
import { prisma } from "@/lib/prisma";
import { getBranding } from "@/lib/branding";
import { supervisorSignatureUrl, JONATHAN_SUPERVISOR_SIGNATURE_URL } from "@/lib/supervisorSignature";

test("Jonathan's uploaded signature is available when the saved signature is empty", async () => {
  (prisma.branding.findUnique as jest.Mock).mockResolvedValue({ licensedProfessionalName: "Jonathan Mugiira", licensedProfessionalSignatureUrl: null });
  expect((await getBranding()).licensedProfessional.signatureUrl).toBe(JONATHAN_SUPERVISOR_SIGNATURE_URL);
  expect(supervisorSignatureUrl({})).toBe(JONATHAN_SUPERVISOR_SIGNATURE_URL);
});
test("a replacement signature remains authoritative", () => {
  expect(supervisorSignatureUrl({ name: "Jonathan Mugiira", signatureUrl: "https://example.invalid/replacement.jpg" })).toBe("https://example.invalid/replacement.jpg");
});
test("Jonathan's signature is not assigned to a different supervisor", () => {
  expect(supervisorSignatureUrl({ name: "Another Professional" })).toBeNull();
});
