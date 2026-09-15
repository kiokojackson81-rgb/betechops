jest.mock("@/lib/prisma", () => ({ prisma: { branding: { findUnique: jest.fn() } } }));
import { prisma } from "@/lib/prisma";
import { getBranding } from "@/lib/branding";
import { companyStampSettings, DEFAULT_COMPANY_STAMP_URL } from "@/lib/companyStamp";

test("unconfigured branding gets the supplied stamp enabled alongside Jonathan's signature", async () => {
  (prisma.branding.findUnique as jest.Mock).mockResolvedValue({ digitalStampUrl: null, digitalStampEnabled: false });
  const branding = await getBranding();
  expect(branding.digitalStampUrl).toBe(DEFAULT_COMPANY_STAMP_URL);
  expect(branding.digitalStampEnabled).toBe(true);
  expect(branding.licensedProfessional.signatureUrl).toBeTruthy();
});
test("a saved replacement and its disabled setting are preserved", () => {
  expect(companyStampSettings({ digitalStampUrl: "https://example.invalid/custom.jpg", digitalStampEnabled: false })).toEqual({ digitalStampUrl: "https://example.invalid/custom.jpg", digitalStampEnabled: false });
});
test("explicit removal does not silently restore the default", () => {
  expect(companyStampSettings({ digitalStampUrl: "", digitalStampEnabled: false })).toEqual({ digitalStampUrl: null, digitalStampEnabled: false });
});
