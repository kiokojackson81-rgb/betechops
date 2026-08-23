import type { SiteVisitOutcome, SiteVisitStatus } from "@/lib/siteVisitShared";
import { getServiceZone, getSiteVisitFee, type ServiceZone } from "@/lib/agents/kenyaMarkets";

export type SiteVisitFeeRegion = ServiceZone;
export type SiteVisitCreditStatus = "NOT_ELIGIBLE" | "AVAILABLE" | "APPLIED";
export const PRODUCT_LINKED_SITE_VISIT_MINIMUM_EXCLUSIVE = 100_000;
export const DATA_LOGGER_DAILY_RATE = 5_000;

export function isProductLinkedSiteVisitEligible(price: number | null | undefined) {
  return Number(price || 0) > PRODUCT_LINKED_SITE_VISIT_MINIMUM_EXCLUSIVE;
}

export function calculateDataLoggerFee(requested: boolean, days: number | null | undefined) {
  if (!requested) return { days: 0, dailyRate: DATA_LOGGER_DAILY_RATE, fee: 0 };
  const normalizedDays = Math.max(1, Math.min(3, Math.trunc(Number(days || 1))));
  return { days: normalizedDays, dailyRate: DATA_LOGGER_DAILY_RATE, fee: normalizedDays * DATA_LOGGER_DAILY_RATE };
}

export function getSiteVisitFeeRegion(county: string | null | undefined, town?: string | null): SiteVisitFeeRegion | null {
  return getServiceZone(county, town)?.id ?? null;
}

export function getStandardSiteVisitFee(county: string | null | undefined, town?: string | null) {
  return getSiteVisitFee(county, town);
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
