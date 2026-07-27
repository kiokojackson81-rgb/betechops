import { sendTransactionalSms } from "@/lib/africasTalking";
import { normalizeKenyanPhone } from "@/lib/phone";

type WellnessRecipient = {
  name?: string | null;
  phone?: string | null;
};

type LeaveNotificationPayload = {
  recipient: WellnessRecipient;
  type: string;
  startDate: Date | string;
  endDate: Date | string;
  daysRequested: number;
  managerComment?: string | null;
};

type CashAdvanceNotificationPayload = {
  recipient: WellnessRecipient;
  requestedAmount: number;
  approvedAmount?: number | null;
  repaymentPeriod?: number | null;
  hrComment?: string | null;
};

function firstName(name?: string | null) {
  const normalized = String(name || "").trim();
  if (!normalized) return "Team member";
  return normalized.split(/\s+/)[0] || normalized;
}

function fmtDate(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-KE", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function fmtKes(value: number | null | undefined) {
  const amount = Math.round(Number(value ?? 0));
  return `KES ${amount.toLocaleString("en-KE")}`;
}

async function sendWellnessSms(phone: string | null | undefined, message: string, context: string) {
  const normalizedPhone = normalizeKenyanPhone(phone || "");
  if (!normalizedPhone) {
    console.warn("[wellness.sms.skipped]", { context, reason: "missing_phone" });
    return { sent: false as const, reason: "missing_phone" };
  }

  try {
    await sendTransactionalSms(normalizedPhone, message);
    return { sent: true as const, phone: normalizedPhone };
  } catch (error) {
    console.error("[wellness.sms.failed]", {
      context,
      phone: normalizedPhone,
      error: error instanceof Error ? error.message : String(error),
    });
    return { sent: false as const, reason: "failed", phone: normalizedPhone };
  }
}

export async function notifyLeaveApproved(payload: LeaveNotificationPayload) {
  const message =
    `Hi ${firstName(payload.recipient.name)}, your ${String(payload.type).toLowerCase()} leave ` +
    `for ${fmtDate(payload.startDate)} to ${fmtDate(payload.endDate)} ` +
    `(${payload.daysRequested} day(s)) has been approved.` +
    (payload.managerComment ? ` Comment: ${payload.managerComment}` : "");
  return sendWellnessSms(payload.recipient.phone, message, "leave_approved");
}

export async function notifyLeaveRejected(payload: LeaveNotificationPayload) {
  const message =
    `Hi ${firstName(payload.recipient.name)}, your ${String(payload.type).toLowerCase()} leave ` +
    `for ${fmtDate(payload.startDate)} to ${fmtDate(payload.endDate)} ` +
    `(${payload.daysRequested} day(s)) has been rejected.` +
    (payload.managerComment ? ` Comment: ${payload.managerComment}` : "");
  return sendWellnessSms(payload.recipient.phone, message, "leave_rejected");
}

export async function notifyLeaveUpdated(payload: LeaveNotificationPayload) {
  const message =
    `Hi ${firstName(payload.recipient.name)}, your leave request was updated to ` +
    `${String(payload.type).toLowerCase()} leave for ${fmtDate(payload.startDate)} to ${fmtDate(payload.endDate)} ` +
    `(${payload.daysRequested} day(s)).`;
  return sendWellnessSms(payload.recipient.phone, message, "leave_updated");
}

export async function notifyLeaveDeleted(payload: LeaveNotificationPayload) {
  const message =
    `Hi ${firstName(payload.recipient.name)}, your leave request for ${fmtDate(payload.startDate)} to ` +
    `${fmtDate(payload.endDate)} (${payload.daysRequested} day(s)) was deleted by admin.`;
  return sendWellnessSms(payload.recipient.phone, message, "leave_deleted");
}

export async function notifyCashAdvanceApproved(payload: CashAdvanceNotificationPayload) {
  const approvedAmount = Number(payload.approvedAmount ?? payload.requestedAmount ?? 0);
  const message =
    `Hi ${firstName(payload.recipient.name)}, your cash advance has been approved for ${fmtKes(approvedAmount)}.` +
    (payload.repaymentPeriod ? ` Repayment period: ${payload.repaymentPeriod} month(s).` : "") +
    (payload.hrComment ? ` Comment: ${payload.hrComment}` : "");
  return sendWellnessSms(payload.recipient.phone, message, "cash_advance_approved");
}

export async function notifyCashAdvanceRejected(payload: CashAdvanceNotificationPayload) {
  const message =
    `Hi ${firstName(payload.recipient.name)}, your cash advance request for ${fmtKes(payload.requestedAmount)} ` +
    `has been rejected.` +
    (payload.hrComment ? ` Comment: ${payload.hrComment}` : "");
  return sendWellnessSms(payload.recipient.phone, message, "cash_advance_rejected");
}

export async function notifyCashAdvanceUpdated(payload: CashAdvanceNotificationPayload) {
  const approvedAmount = Number(payload.approvedAmount ?? payload.requestedAmount ?? 0);
  const message =
    `Hi ${firstName(payload.recipient.name)}, your cash advance request was updated. ` +
    `Requested: ${fmtKes(payload.requestedAmount)}.` +
    (approvedAmount > 0 ? ` Approved amount: ${fmtKes(approvedAmount)}.` : "") +
    (payload.repaymentPeriod ? ` Repayment period: ${payload.repaymentPeriod} month(s).` : "");
  return sendWellnessSms(payload.recipient.phone, message, "cash_advance_updated");
}

export async function notifyCashAdvanceDeleted(payload: CashAdvanceNotificationPayload) {
  const message =
    `Hi ${firstName(payload.recipient.name)}, your cash advance request for ${fmtKes(payload.requestedAmount)} ` +
    `was deleted by admin.`;
  return sendWellnessSms(payload.recipient.phone, message, "cash_advance_deleted");
}
