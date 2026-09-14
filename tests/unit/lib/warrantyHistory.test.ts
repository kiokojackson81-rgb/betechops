jest.mock("server-only", () => ({}), { virtual: true });
jest.mock("@/lib/prisma", () => ({ prisma: {} }));
jest.mock("@/lib/commissioning", () => ({}));
jest.mock("@/lib/warrantyCertificate", () => ({}));
jest.mock("@/lib/africasTalking", () => ({}));
jest.mock("@/lib/email", () => ({}));
import { createHash } from "crypto";
import { currentWarrantyEquipment, warrantyPdfBytes } from "@/lib/warrantyCertificates";

test("replacement overlays current equipment while preserving issued snapshots and warranty dates", () => {
  const original = { equipment: "Inverter", brand: "Original", serialNumbers: "OLD-001", warrantyExpiryDate: "2031-09-13" };
  const replacement = { ...original, brand: "Replacement", serialNumbers: "NEW-001" };
  const certificate = { data: { equipment: [original] }, history: [{ action: "REPLACEMENT", data: { index: 0, originalEquipment: original, replacementEquipment: replacement } }] };
  expect(currentWarrantyEquipment(certificate)[0].serialNumbers).toBe("NEW-001");
  expect(currentWarrantyEquipment(certificate)[0].warrantyExpiryDate).toBe("2031-09-13");
  expect(certificate.data.equipment[0].serialNumbers).toBe("OLD-001");
});

test("downloads return the stored PDF and detect altered bytes", async () => {
  const bytes = Buffer.from("stored-pdf-test");
  const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(new Response(bytes));
  const certificate = { pdfUrl: "https://example.invalid/stored.pdf", pdfSha256: createHash("sha256").update(bytes).digest("hex") };
  expect(await warrantyPdfBytes(certificate)).toEqual(bytes);
  expect(fetchMock).toHaveBeenCalledWith(certificate.pdfUrl, { cache: "no-store" });
  fetchMock.mockResolvedValueOnce(new Response("changed"));
  await expect(warrantyPdfBytes(certificate)).rejects.toThrow("integrity check");
  fetchMock.mockRestore();
});
