export const BUSY_ALERT_REASON =
  "Multiple consecutive incoming calls returned BUSY. The call receiver may be offline, rejecting calls, unavailable, or there may be a call system issue.";

export const INACTIVITY_ALERT_REASON =
  "No incoming calls have been recorded for the last 1 hour during working hours.";

export type HealthIncidentType = "BUSY_CALLS" | "NO_INBOUND_CALLS";

export type WorkingWindow = { start: Date; end: Date };

const NAIROBI_OFFSET_HOURS = 3;
const NAIROBI_PARTS = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Africa/Nairobi",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function dateParts(date: Date) {
  const parts = Object.fromEntries(
    NAIROBI_PARTS.formatToParts(date).map((part) => [part.type, part.value]),
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    weekday: parts.weekday,
  };
}

function nairobiLocalToUtc(
  parts: ReturnType<typeof dateParts>,
  hour: number,
  minute: number,
) {
  return new Date(
    Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      hour - NAIROBI_OFFSET_HOURS,
      minute,
    ),
  );
}

export function getNairobiWorkingWindow(now: Date): WorkingWindow | null {
  const parts = dateParts(now);
  if (parts.weekday === "Sun") return null;

  const saturday = parts.weekday === "Sat";
  const start = nairobiLocalToUtc(parts, 9, 0);
  const end = nairobiLocalToUtc(parts, saturday ? 15 : 17, saturday ? 0 : 30);
  if (now < start || now > end) return null;
  return { start, end };
}

export function hasReachedInactivityThreshold(input: {
  now: Date;
  windowStart: Date;
  lastInboundAt: Date | null;
  thresholdMinutes?: number;
}) {
  const thresholdMs = (input.thresholdMinutes ?? 60) * 60 * 1000;
  const baseline =
    input.lastInboundAt && input.lastInboundAt > input.windowStart
      ? input.lastInboundAt
      : input.windowStart;
  return input.now.getTime() - baseline.getTime() >= thresholdMs;
}

export function evaluateInactivityTransition(input: {
  incidentActive: boolean;
  now: Date;
  window: WorkingWindow | null;
  lastInboundAt: Date | null;
}) {
  const shouldAlert = Boolean(
    input.window &&
      !input.incidentActive &&
      hasReachedInactivityThreshold({
        now: input.now,
        windowStart: input.window.start,
        lastInboundAt: input.lastInboundAt,
      }),
  );
  return {
    incidentActive: input.incidentActive || shouldAlert,
    shouldAlert,
  };
}

export function resetInactivityIncidentOnInbound() {
  return { incidentActive: false };
}

export function normalizeCallCentreStatus(status: string | null | undefined) {
  const normalized = String(status || "").trim().toLowerCase();
  if (["busy", "user_busy"].includes(normalized)) return "BUSY";
  if (["answered", "connected", "in_progress", "completed"].includes(normalized)) {
    return "ANSWERED";
  }
  return normalized.toUpperCase();
}

export type BusyState = {
  consecutiveBusy: number;
  busyIncidentActive: boolean;
};

export function evaluateBusyTransition(
  state: BusyState,
  status: string,
): BusyState & { shouldAlert: boolean; shouldResolve: boolean } {
  const normalized = normalizeCallCentreStatus(status);
  if (normalized === "ANSWERED") {
    return {
      consecutiveBusy: 0,
      busyIncidentActive: false,
      shouldAlert: false,
      shouldResolve: state.busyIncidentActive,
    };
  }
  if (normalized !== "BUSY") {
    return { ...state, shouldAlert: false, shouldResolve: false };
  }

  const consecutiveBusy = state.consecutiveBusy + 1;
  const shouldAlert = consecutiveBusy >= 2 && !state.busyIncidentActive;
  return {
    consecutiveBusy,
    busyIncidentActive: state.busyIncidentActive || shouldAlert,
    shouldAlert,
    shouldResolve: false,
  };
}

export function formatNairobiAlertTime(date: Date) {
  return new Intl.DateTimeFormat("en-KE", {
    timeZone: "Africa/Nairobi",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
