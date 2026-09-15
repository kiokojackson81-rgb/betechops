import { customerProjectDocumentsSms, technicianCommissioningSms, PROJECT_DOCUMENT_ORDER } from "@/lib/projectDocumentMessages";

test("customer SMS describes all three documents in the requested order", () => {
  expect(PROJECT_DOCUMENT_ORDER).toEqual(["receipt", "completion", "warranty"]);
  const message = customerProjectDocumentsSms({ name: "Thomas", reference: "BETECH-123", link: "https://example.invalid/certificate/secure" });
  expect(message).toBe("Hi Thomas, your solar installation for project BETECH-123 is completed and certified. Your Receipt, Completion Certificate and Warranty Certificate are ready. View or download your documents here: https://example.invalid/certificate/secure");
});

test("technician SMS links to commissioning, not customer documents", () => {
  expect(technicianCommissioningSms({ name: "Samuel", reference: "BETECH-123", customer: "Thomas", location: "Konza", link: "https://example.invalid/commissioning/secure" })).toBe("Hi Samuel, you've been assigned project BETECH-123 for Thomas in Konza. Complete installation checks, upload photos and sign off here: https://example.invalid/commissioning/secure");
});
