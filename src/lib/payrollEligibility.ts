import type { Prisma } from "@prisma/client";

export const PAYROLL_ATTENDANT_CATEGORIES = [
  "DIRECT_SALES_OPS",
  "MARKETING_OPS",
  "JUMIA_KILIMALL_OPS",
  "SUPPORT_OPS",
  "GENERAL_OPS",
  "BETECH_OPS",
] as const;

export function payrollEligibleUserWhere(extra: Prisma.UserWhereInput = {}): Prisma.UserWhereInput {
  return {
    role: { in: ["ATTENDANT", "SUPERVISOR"] },
    attendantCategory: { in: [...PAYROLL_ATTENDANT_CATEGORIES] },
    ...extra,
  };
}
