import type { SiteVisitOutcome, SiteVisitStatus } from "@/lib/siteVisitShared";

export const NAIROBI_SITE_VISIT_FEE = 2_000;
export const OUTSIDE_NAIROBI_SITE_VISIT_FEE = 5_000;

export type SiteVisitFeeRegion = "NAIROBI" | "OUTSIDE_NAIROBI";
export type SiteVisitCreditStatus = "NOT_ELIGIBLE" | "AVAILABLE" | "APPLIED";

export function getSiteVisitFeeRegion(county: string | null | undefined): SiteVisitFeeRegion | null {
  const normalized = String(county || "").trim().toLowerCase();
  if (!normalized) return null;
  return normalized === "nairobi" || normalized.startsWith("nairobi ") ? "NAIROBI" : "OUTSIDE_NAIROBI";
}

export function getStandardSiteVisitFee(county: string | null | undefined) {
  const region = getSiteVisitFeeRegion(county);
  if (!region) return null;
  return region === "NAIROBI" ? NAIROBI_SITE_VISIT_FEE : OUTSIDE_NAIROBI_SITE_VISIT_FEE;
}

const VALID_TRANSITIONS: Record<SiteVisitStatus, readonly SiteVisitStatus[]> = {
  PENDING: ["PENDING", "SCHEDULED", "CLOSED"],
  SCHEDULED: ["SCHEDULED", "PENDING", "VISITED", "CLOSED"],
  VISITED: ["VISITED", "SCHEDULED", "CLOSED"],
  CLOSED: ["CLOSED"],
};

export function validateSiteVisitLifecycle(input: {
  previousStatus: SiteVisitStatus;
  status: SiteVisitStatus;
  outcome?: SiteVisitOutcome | null;
  closedReason?: string | null;
}) {
  if (!VALID_TRANSITIONS[input.previousStatus].includes(input.status)) {
    return `Site visit cannot move from ${input.previousStatus} to ${input.status}.`;
  }
  if ((input.status === "PENDING" || input.status === "SCHEDULED") && input.outcome) {
    return `${input.status} site visits cannot have a completed outcome.`;
  }
  if (input.status === "CLOSED" && !input.outcome && !String(input.closedReason || "").trim()) {
    return "Closing a site visit requires an outcome or closure reason.";
  }
  return null;
}

export function deriveSiteVisitCreditStatus(input: {
  paymentStatus: "UNPAID" | "PAID" | "WAIVED";
  currentStatus?: SiteVisitCreditStatus | null;
}) {
  if (input.currentStatus === "APPLIED") return "APPLIED" as const;
  return input.paymentStatus === "PAID" ? "AVAILABLE" as const : "NOT_ELIGIBLE" as const;
}

export function isAllowedSiteVisitAttachment(file: { name: string; type: string; size: number }) {
  const maxBytes = 10 * 1024 * 1024;
  const extension = file.name.toLowerCase().split(".").pop() || "";
  const allowedExtensions = new Set(["jpg", "jpeg", "png", "webp", "pdf", "doc", "docx"]);
  const allowedTypes = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ]);
  if (!file.size || file.size > maxBytes) return "Files must be between 1 byte and 10 MB.";
  if (!allowedExtensions.has(extension) || !allowedTypes.has(file.type)) {
    return "Only JPG, PNG, WebP, PDF, DOC and DOCX files are allowed.";
  }
  return null;
}
