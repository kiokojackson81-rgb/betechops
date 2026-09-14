import { customerProjectDocumentsSms, technicianCommissioningSms, PROJECT_DOCUMENT_ORDER } from "@/lib/projectDocumentMessages";

test("customer SMS describes all three documents in the requested order", () => {
  expect(PROJECT_DOCUMENT_ORDER).toEqual(["receipt", "completion", "warranty"]);
  const message = customerProjectDocumentsSms({ name: "Thomas", reference: "BETECH-123", link: "https://example.invalid/certificate/secure" });
  expect(message).toContain("Receipt, Completion Certificate and Warranty Certificate");
  expect(message).toContain("completed and certified");
  expect(message).toContain("https://example.invalid/certificate/secure");
  expect(message).toContain("Support: 0722 151 083.");
});

test("technician SMS links to commissioning, not customer documents", () => {
  expect(technicianCommissioningSms({ name: "Samuel", reference: "BETECH-123", customer: "Thomas", location: "Konza", link: "https://example.invalid/commissioning/secure" })).toContain("Complete installation checks, upload photos and sign off here: https://example.invalid/commissioning/secure");
});
