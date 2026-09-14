const clean = (value: string) => value.replace(/\s+/g, " ").trim();

export function technicianCommissioningSms(input: { name: string; reference: string; customer: string; location: string; link: string }) {
  return `BETECH SOLAR: Hi ${clean(input.name)}, you've been assigned project ${clean(input.reference)} for ${clean(input.customer)} in ${clean(input.location)}. Complete installation checks, upload photos and sign off here: ${input.link} Support: 0722 151 083.`;
}

export function customerProjectDocumentsSms(input: { name: string; reference: string; link: string }) {
  return `BETECH SOLAR: Hi ${clean(input.name)}, your solar installation for project ${clean(input.reference)} is completed and certified. Your Receipt, Completion Certificate and Warranty Certificate are ready. View or download your documents here: ${input.link} Support: 0722 151 083.`;
}

export const PROJECT_DOCUMENT_ORDER = ["receipt", "completion", "warranty"] as const;
export const PROJECT_DOCUMENT_LABELS = { receipt: "Receipt", completion: "Certificate of Completion", warranty: "Warranty Certificate" } as const;
