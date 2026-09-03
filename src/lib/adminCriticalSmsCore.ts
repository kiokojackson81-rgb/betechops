import { normalizeKenyanPhone } from "@/lib/phone";

export const ADMIN_CRITICAL_SMS_EVENT_TYPES = [
  "WEB_ORDER_CREATED",
  "COMPLAINT_CREATED",
  "WEB_PROJECT_BOOKED",
  "AGENT_APPLICATION_CREATED",
  "AGENT_PAYOUT_REQUESTED",
  "PRODUCT_CONTRIBUTOR_WITHDRAWAL_REQUESTED",
  "LPP_PAYMENT_PENDING",
  "SITE_VISIT_REQUESTED",
  "WELLNESS_LEAVE_REQUESTED",
  "WELLNESS_CASH_ADVANCE_REQUESTED",
] as const;

export type AdminCriticalSmsEventType =
  (typeof ADMIN_CRITICAL_SMS_EVENT_TYPES)[number];

type RecipientEnvironment = {
  smsNumbers?: string | null;
  whatsappNumbers?: string | null;
  adminPhone?: string | null;
};

function splitNumbers(value: string | null | undefined) {
  return String(value || "")
    .split(/[,;\s]+/)
    .map((entry) => normalizeKenyanPhone(entry))
    .filter(Boolean);
}

export function resolveAdminCriticalSmsRecipients(
  environment: RecipientEnvironment,
) {
  const preferred = splitNumbers(environment.smsNumbers);
  const fallback = preferred.length
    ? preferred
    : splitNumbers(environment.whatsappNumbers);
  const recipients = fallback.length
    ? fallback
    : splitNumbers(environment.adminPhone);
  return Array.from(new Set(recipients));
}

function cleanPart(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function buildAdminCriticalSmsMessage(input: {
  title: string;
  details: string[];
  actionUrl?: string | null;
}) {
  const title = cleanPart(input.title);
  const detailText = input.details.map(cleanPart).filter(Boolean).join(" | ");
  const action = input.actionUrl ? `Open: ${cleanPart(input.actionUrl)}` : "";
  const fixedLength = `[BETECH ACTION] ${title}.  ${action}`.length;
  const availableDetails = Math.max(0, 600 - fixedLength);
  const shortenedDetails =
    detailText.length > availableDetails
      ? `${detailText.slice(0, Math.max(0, availableDetails - 3)).trimEnd()}...`
      : detailText;
  return [`[BETECH ACTION] ${title}.`, shortenedDetails, action]
    .filter(Boolean)
    .join(" ");
}
