import type { QuoteProjectType } from "@/lib/quoteRequests";

export const SITE_VISIT_STATUSES = ["PENDING", "SCHEDULED", "VISITED", "CLOSED"] as const;
export type SiteVisitStatus = (typeof SITE_VISIT_STATUSES)[number];

export const SITE_VISIT_OUTCOMES = [
  "QUOTATION_CREATED",
  "FURTHER_ASSESSMENT_REQUIRED",
  "CLOSED_WITHOUT_QUOTATION",
] as const;
export type SiteVisitOutcome = (typeof SITE_VISIT_OUTCOMES)[number];

export const SITE_VISIT_PAYMENT_STATUSES = ["UNPAID", "PAID", "WAIVED"] as const;
export type SiteVisitPaymentStatus = (typeof SITE_VISIT_PAYMENT_STATUSES)[number];

export const SITE_VISIT_SOURCES = ["STAFF", "CUSTOMER_REQUEST"] as const;
export type SiteVisitSource = (typeof SITE_VISIT_SOURCES)[number];

export const SITE_VISIT_CREDIT_STATUSES = ["NOT_ELIGIBLE", "AVAILABLE", "APPLIED"] as const;
export type SiteVisitCreditStatus = (typeof SITE_VISIT_CREDIT_STATUSES)[number];

export const SITE_VISIT_PAYMENT_VERIFICATION_STATUSES = ["NONE", "PENDING", "VERIFIED", "REJECTED"] as const;
export type SiteVisitPaymentVerificationStatus = (typeof SITE_VISIT_PAYMENT_VERIFICATION_STATUSES)[number];

export const DATA_LOGGER_STATUSES = ["NOT_REQUESTED", "REQUESTED", "SCHEDULED", "INSTALLED", "MONITORING", "COMPLETED"] as const;
export type DataLoggerStatus = (typeof DATA_LOGGER_STATUSES)[number];

export const SITE_VISIT_REASONS = [
  "LOAD_ASSESSMENT",
  "ROOF_INSPECTION",
  "PUMP_ASSESSMENT",
  "INSTALLATION_PLANNING",
  "FAULT_DIAGNOSIS",
  "FINAL_MEASUREMENTS",
  "QUOTATION_VERIFICATION",
  "MAINTENANCE_VISIT",
  "CUSTOMER_CONSULTATION",
  "OTHER",
] as const;
export type SiteVisitReason = (typeof SITE_VISIT_REASONS)[number];

export type SerializedSiteVisit = {
  id: string;
  visitRef: string;
  quoteRequestId: string | null;
  quoteRef: string | null;
  customerUserId: string | null;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  companyName: string | null;
  siteContactPerson: string | null;
  alternativePhone: string | null;
  county: string | null;
  town: string | null;
  location: string | null;
  mapUrl: string | null;
  landmark: string | null;
  propertyType: string | null;
  accessInstructions: string | null;
  projectType: QuoteProjectType | null;
  visitReason: SiteVisitReason | null;
  preferredDate: string | null;
  preferredTimeLabel: string | null;
  scheduledAt: string | null;
  estimatedDurationMinutes: number | null;
  assignedStaffId: string | null;
  assignedStaffName: string | null;
  assignedTechnicianId: string | null;
  assignedTechnicianName: string | null;
  transportMethod: string | null;
  visitFee: number;
  paymentStatus: SiteVisitPaymentStatus;
  paymentReference: string | null;
  source: SiteVisitSource;
  feeRegion: "ZONE_1" | "ZONE_2" | "ZONE_3" | null;
  serviceZone: "ZONE_1" | "ZONE_2" | "ZONE_3" | null;
  serviceZoneLabel: string | null;
  locationCounty: string | null;
  locationTown: string | null;
  appliedFee: number;
  originProductId: string | null;
  originProductName: string | null;
  originProductSlug: string | null;
  originProductPrice: number | null;
  originProductCategory: string | null;
  originProductImage: string | null;
  originProductUrl: string | null;
  dataLoggerRequested: boolean;
  dataLoggerDays: number;
  dataLoggerDailyRate: number;
  dataLoggerFee: number;
  dataLoggerStatus: DataLoggerStatus;
  dataLoggerInstalledAt: string | null;
  dataLoggerExpectedEndAt: string | null;
  dataLoggerCompletedAt: string | null;
  totalPayable: number;
  standardVisitFee: number | null;
  feeOverrideReason: string | null;
  paymentMethod: string | null;
  paymentAmount: number | null;
  paymentSubmittedAt: string | null;
  paymentPaidAt: string | null;
  paymentRecordedById: string | null;
  paymentRecordedByName: string | null;
  paymentVerificationStatus: SiteVisitPaymentVerificationStatus;
  waiverReason: string | null;
  waiverAuthorizedById: string | null;
  waiverAuthorizedByName: string | null;
  quotationCreditStatus: SiteVisitCreditStatus;
  creditedQuotationId: string | null;
  creditedQuotationRef: string | null;
  creditedAmount: number | null;
  creditedAt: string | null;
  creditAppliedById: string | null;
  creditAppliedByName: string | null;
  rescheduleRequestedAt: string | null;
  rescheduleRequestedDate: string | null;
  rescheduleRequestedTimeLabel: string | null;
  rescheduleReason: string | null;
  cancellationRequestedAt: string | null;
  cancellationReason: string | null;
  customerRequirements: string | null;
  appliancesToInspect: string | null;
  specialInstructions: string | null;
  internalNotes: string | null;
  status: SiteVisitStatus;
  findings: string | null;
  assessmentSummary: string | null;
  recommendedSystem: string | null;
  recommendedItems: string | null;
  risks: string | null;
  nextAction: string | null;
  outcome: SiteVisitOutcome | null;
  closedReason: string | null;
  completedAt: string | null;
  closedAt: string | null;
  createdById: string | null;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CustomerSiteVisit = Pick<
  SerializedSiteVisit,
  | "id"
  | "visitRef"
  | "quoteRef"
  | "projectType"
  | "visitReason"
  | "status"
  | "preferredDate"
  | "preferredTimeLabel"
  | "scheduledAt"
  | "county"
  | "town"
  | "location"
  | "mapUrl"
  | "landmark"
  | "assignedTechnicianName"
  | "assignedStaffName"
  | "visitFee"
  | "paymentStatus"
  | "paymentReference"
  | "paymentVerificationStatus"
  | "serviceZone"
  | "serviceZoneLabel"
  | "originProductId"
  | "originProductName"
  | "originProductSlug"
  | "originProductPrice"
  | "originProductCategory"
  | "originProductImage"
  | "originProductUrl"
  | "dataLoggerRequested"
  | "dataLoggerDays"
  | "dataLoggerDailyRate"
  | "dataLoggerFee"
  | "dataLoggerStatus"
  | "totalPayable"
  | "quotationCreditStatus"
  | "outcome"
  | "rescheduleRequestedAt"
  | "rescheduleRequestedDate"
  | "rescheduleRequestedTimeLabel"
  | "cancellationRequestedAt"
  | "createdAt"
  | "updatedAt"
>;

export type SerializedSiteVisitEvent = {
  id: string;
  siteVisitId: string;
  eventType: string;
  eventLabel: string;
  eventDetail: string | null;
  actorUserId: string | null;
  actorName: string | null;
  metadata: unknown;
  createdAt: string;
};

export type SerializedSiteVisitAttachment = {
  id: string;
  siteVisitId: string;
  fileName: string;
  fileUrl: string;
  fileKey: string | null;
  contentType: string | null;
  fileSizeBytes: number | null;
  uploadedById: string | null;
  uploadedByName: string | null;
  createdAt: string;
};
