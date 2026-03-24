const ELIGIBLE_INDIVIDUAL_EXPORT_EMAILS = new Set([
  "benjamin@betech.co.ke",
  "stephen@betech.co.ke",
]);

export function canDownloadOnlineSummaryIndividual(email: string | null | undefined) {
  return ELIGIBLE_INDIVIDUAL_EXPORT_EMAILS.has(String(email ?? "").trim().toLowerCase());
}
