import type { PayrollAdjustmentKind, PayrollAdjustmentType } from "@prisma/client";
import { getTradingPeriodFor } from "@/lib/tradingPeriod";

export const payrollAdjustmentOffenseTypes = [
  "THEFT",
  "LATENESS",
  "ABSENT_WITHOUT_NOTICE",
  "FAILURE_TO_REPORT_TO_WORK",
  "INSUBORDINATION",
  "MISCONDUCT",
  "PROPERTY_DAMAGE",
  "CUSTOMER_COMPLAINT",
  "BONUS",
  "OTHER",
] as const;

export type PayrollAdjustmentOffenseType = (typeof payrollAdjustmentOffenseTypes)[number];

export function canSubmitPayrollAdjustmentRequest(user?: {
  role?: string | null;
  email?: string | null;
  attendantCategory?: string | null;
}) {
  const role = String(user?.role ?? "").toUpperCase();
  const email = String(user?.email ?? "").trim().toLowerCase();
  const category = String(user?.attendantCategory ?? "").toUpperCase();
  return (
    role === "ADMIN" ||
    role === "SUPERVISOR" ||
    email === "benjamin@betech.co.ke" ||
    category === "BETECH_OPS"
  );
}

export function normalizePayrollAdjustmentKind(value: unknown): PayrollAdjustmentKind {
  const kind = String(value ?? "").trim().toUpperCase();
  return kind === "ADDITION" ? "ADDITION" : "DEDUCTION";
}

export function normalizePayrollAdjustmentOffenseType(value: unknown): PayrollAdjustmentOffenseType {
  const normalized = String(value ?? "").trim().toUpperCase().replace(/[\s-]+/g, "_");
  return payrollAdjustmentOffenseTypes.includes(normalized as PayrollAdjustmentOffenseType)
    ? (normalized as PayrollAdjustmentOffenseType)
    : "OTHER";
}

export function adjustmentTypeForOffense(
  offenseType: PayrollAdjustmentOffenseType,
  kind: PayrollAdjustmentKind,
): PayrollAdjustmentType {
  if (kind === "ADDITION") return offenseType === "BONUS" ? "BONUS" : "OTHER";
  if (offenseType === "LATENESS") return "LATENESS";
  if (offenseType === "OTHER") return "OTHER";
  return "DISCIPLINE";
}

export function labelForAdjustmentRequest(input: {
  offenseType: PayrollAdjustmentOffenseType;
  label?: string | null;
  incidentDate?: Date | null;
}) {
  const explicit = String(input.label ?? "").trim();
  if (explicit) return explicit;
  const readableType = input.offenseType
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
  const dateText = input.incidentDate ? input.incidentDate.toLocaleDateString("en-KE") : "";
  return dateText ? `${readableType} - ${dateText}` : readableType;
}

export function resolveAdjustmentRequestPeriod(periodKey?: string | null) {
  if (periodKey) {
    const [start, end] = String(periodKey).split("_");
    const startDate = start ? new Date(start) : null;
    const endDate = end ? new Date(end) : null;
    if (startDate && endDate && !Number.isNaN(startDate.getTime()) && !Number.isNaN(endDate.getTime())) {
      return {
        key: periodKey,
        label: `${startDate.toLocaleDateString("en-KE", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })} - ${endDate.toLocaleDateString("en-KE", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })}`,
        start: startDate,
        end: endDate,
      };
    }
  }
  return getTradingPeriodFor(new Date());
}
