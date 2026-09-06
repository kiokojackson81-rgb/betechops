import type { TradingPeriod } from "@/lib/tradingPeriod";
import {
  buildOpenfloatReviewRow,
  type OpenfloatReviewRow,
  type PayoutUser,
} from "@/lib/payrollOpenfloatShared";

export type ApprovedCashAdvanceForOpenfloat = {
  id: string;
  approvedAmount: number | null;
  user: PayoutUser;
};

/**
 * Maps an approved advance to the same validated OpenFloat transaction schema
 * used by payroll, while keeping the payment purpose clear to the recipient
 * and to the finance team.
 */
export function buildCashAdvanceOpenfloatRow(
  advance: ApprovedCashAdvanceForOpenfloat,
  period: TradingPeriod,
): OpenfloatReviewRow {
  const row = buildOpenfloatReviewRow(advance.user, Number(advance.approvedAmount ?? 0), period);

  return {
    ...row,
    remark: `Cash advance ${advance.id} ${period.key}`,
  };
}
