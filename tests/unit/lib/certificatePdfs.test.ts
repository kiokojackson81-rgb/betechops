jest.mock("server-only", () => ({}), { virtual: true });
jest.mock("@/lib/branding", () => ({
  getBranding: jest.fn(async () => ({ digitalStampEnabled: false, digitalStampUrl: null, licensedProfessional: { name: "Jonathan Mugiira", title: "Senior Solar PV & Electrical Engineer", qualification: "EPRA T3 Solar Photovoltaic Technician", licenceNumber: "EPRA/SPVT/001782" } })),
  sameLicensedProfessional: (a: string, b: string) => a === b,
}));
jest.mock("@/lib/commissioning", () => ({ decryptCommissioningToken: () => "test-only" }));

import { mkdirSync, writeFileSync } from "fs";
import { PDFDocument } from "pdf-lib";
import { buildCommissioningCertificatePdf } from "@/lib/commissioningCertificate";
import { buildWarrantyCertificatePdf, type WarrantyCertificateSnapshot } from "@/lib/warrantyCertificate";

const warranty: WarrantyCertificateSnapshot = {
  certificateNo: "BS-WC-2026-000001", completionCertificateNo: "BSC-20260914-82699896-706C3B", projectReference: "BETECH2026082699896", customerName: "TEST CUSTOMER", customerPhone: "0700000000", installationLocation: "Konza", installationType: "New Installation", systemConfiguration: "Hybrid Solar PV System", technicianName: "Test Installer", commissioningDate: "2026-09-14T10:00:00Z", issueDate: "2026-09-14T10:00:00Z", verificationUrl: "https://example.invalid/verify/test",
  equipment: ["Solar Panels", "Inverter", "Lithium Battery"].map((equipment, index) => ({ equipment, brand: "TEST BRAND", modelCapacity: "Example equipment 5.2kW", serialNumbers: index ? "TEST-SERIAL-12345678901234567890" : "PANEL-001 PANEL-002 PANEL-003", warrantyYears: [25, 5, 10][index], warrantyStartDate: "2026-09-14", warrantyExpiryDate: ["2051-09-13", "2031-09-13", "2036-09-13"][index] })) as WarrantyCertificateSnapshot["equipment"],
};

test("warranty preview is one page and final issuance requires the existing stamp", async () => {
  const bytes = await buildWarrantyCertificatePdf(warranty, { preview: true });
  expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
  await expect(buildWarrantyCertificatePdf(warranty)).rejects.toThrow("digital stamp");
  mkdirSync("artifacts/certificate-review", { recursive: true });
  writeFileSync("artifacts/certificate-review/warranty-preview.pdf", bytes);
});

test.each(["Test Installer", "Jonathan Mugiira"])("completion layout supports installer %s", async (name) => {
  const source = {
    certificateNo: "BSC-20260914-82699896-706C3B", issuedAt: new Date("2026-09-14T10:00:00Z"), professionalApprovedAt: new Date("2026-09-14T10:00:00Z"), professionalProfileSnapshot: { name: "Jonathan Mugiira", title: "Senior Solar PV & Electrical Engineer", qualification: "EPRA T3 Solar Photovoltaic Technician", licenceNumber: "EPRA/SPVT/001782" }, technician: { name },
    receipt: { receiptNumber: "BETECH2026082699896", data: { customerLocation: "Konza" }, order: { orderNumber: "TEST-ORDER", customerName: "TEST CUSTOMER", customerPhone: "0700000000", customerEmail: null, metadata: {} } },
    data: { site: { county: "Kajiado", gps: "-1.496700, 37.083000", premises: "Industrial" }, installation: { type: "New Installation", systemConfiguration: "Hybrid" }, equipment: { panelBrand: "SRNE", panelModel: "620W", panelQuantity: "16", panelRating: "620W", inverterBrand: "ASP", inverterModel: "ASP48100S220H", inverterCapacity: "5.2kW", inverterSerial: "TEST-1234567890123456789", batteryBrand: "SRNE", batteryModel: "SR-SE16B-Pro", batteryCapacity: "314Ah", batterySerial: "TEST-123456789012345678901234" }, measurements: { pvVoltage: "312", batteryVoltage: "53", batterySoc: "50", acInput: "230", acOutput: "230", commissioningLoad: "1250" }, termsAcceptance: { accepted: true, acceptedAt: "2026-09-14T10:00:00Z" }, signatures: {}, checklist: {}, handover: {} },
  };
  const bytes = await buildCommissioningCertificatePdf(source);
  expect((await PDFDocument.load(bytes)).getPageCount()).toBe(2);
  mkdirSync("artifacts/certificate-review", { recursive: true });
  writeFileSync(`artifacts/certificate-review/completion-${name === "Test Installer" ? "supervised" : "self"}.pdf`, bytes);
});
