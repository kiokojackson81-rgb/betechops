export const LIPA_POLE_POLE_MIN_DEPOSIT = 500;
export const LIPA_POLE_POLE_MPESA_PAYBILL = "516600";
export const LIPA_POLE_POLE_MPESA_ACCOUNT = "0710098001";
export const LIPA_POLE_POLE_WEB_OWNER_EMAIL = "benjamin@betech.co.ke";
export const LIPA_POLE_POLE_DEFAULT_MONTHS = 6;
export const LIPA_POLE_POLE_MAX_MONTHS = 6;
export const LIPA_POLE_POLE_MAX_WEEKS = 26;

export type LipaPolePolePaymentFrequency = "WEEKLY" | "MONTHLY";

export function getLipaPolePoleMaxInstallments(
  frequency: LipaPolePolePaymentFrequency,
) {
  return frequency === "WEEKLY"
    ? LIPA_POLE_POLE_MAX_WEEKS
    : LIPA_POLE_POLE_MAX_MONTHS;
}

export function getLipaPolePoleDefaultInstallments(
  frequency: LipaPolePolePaymentFrequency,
) {
  return frequency === "WEEKLY"
    ? LIPA_POLE_POLE_MAX_WEEKS
    : LIPA_POLE_POLE_DEFAULT_MONTHS;
}
