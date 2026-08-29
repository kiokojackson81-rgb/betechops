export const QUOTE_REQUEST_STATUSES = [
  "PENDING",
  "CONTACTED",
  "QUOTED",
  "FOLLOW_UP",
  "REVISED",
  "APPROVED",
  "CONVERTED",
  "CLOSED",
] as const;

export type QuoteRequestStatus = (typeof QUOTE_REQUEST_STATUSES)[number];

const QUOTE_REQUEST_STATUS_ALIASES = {
  PENDING: ["PENDING", "NEW", "PENDING_APPROVAL", "DRAFT", "VIEWED"],
  CONTACTED: ["CONTACTED"],
  QUOTED: ["QUOTED", "SENT"],
  FOLLOW_UP: ["FOLLOW_UP", "AMOUNT_PENDING"],
  REVISED: ["REVISED"],
  APPROVED: ["APPROVED", "ACCEPTED"],
  CONVERTED: ["CONVERTED"],
  CLOSED: ["CLOSED", "REJECTED", "EXPIRED"],
} as const satisfies Record<QuoteRequestStatus, readonly string[]>;

export const QUOTE_REQUEST_ACTIONABLE_STATUSES = [
  "PENDING",
  "FOLLOW_UP",
  "REVISED",
  "APPROVED",
] as const satisfies readonly QuoteRequestStatus[];

export function normalizeQuoteRequestStatus(status: string | null | undefined): QuoteRequestStatus {
  const normalized = String(status ?? "").trim().toUpperCase();
  for (const [canonicalStatus, aliases] of Object.entries(QUOTE_REQUEST_STATUS_ALIASES) as Array<
    [QuoteRequestStatus, readonly string[]]
  >) {
    if (aliases.includes(normalized)) return canonicalStatus;
  }
  return "PENDING";
}

export function getQuoteRequestStatusAliases(status: QuoteRequestStatus) {
  return [...QUOTE_REQUEST_STATUS_ALIASES[status]];
}
