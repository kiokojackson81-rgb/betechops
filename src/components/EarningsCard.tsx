"use client";

// NOTE: This file was stubbed to avoid breaking imports while the Earnings UI is
// removed repo-wide. Replace this stub with a proper implementation or delete the
// component after updating all consumers.

export type Variant = "support" | "marketing" | "onlineOps";

export type Props =
  | {
      variant?: Exclude<Variant, "onlineOps">;
      summary: unknown | null;
      lockKey?: string;
    }
  | {
      variant: "onlineOps";
    };

export function EarningsCard(_props: Props) {
  // intentionally render nothing — placeholder for removal
  return null;
}

export default EarningsCard;
