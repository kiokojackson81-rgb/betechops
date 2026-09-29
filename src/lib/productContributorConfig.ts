export const PRODUCT_CONTRIBUTOR_EMAIL = "twili@betech.co.ke";
export const STEPHEN_PRODUCT_CONTRIBUTOR_EMAIL = "stephen@betech.co.ke";
export const PRODUCT_UPLOAD_EARNING_KES = 5;

// Twili is paid through the contributor withdrawal workflow. Stephen is a
// Direct Sales employee, so the same KES 5 credit belongs in payroll as
// product commission and must never also be available for withdrawal.
export const PRODUCT_CONTRIBUTOR_EMAILS = [
  PRODUCT_CONTRIBUTOR_EMAIL,
  STEPHEN_PRODUCT_CONTRIBUTOR_EMAIL,
] as const;

export function isProductContributorEmail(email?: string | null) {
  return PRODUCT_CONTRIBUTOR_EMAILS.includes(
    email?.trim().toLowerCase() as (typeof PRODUCT_CONTRIBUTOR_EMAILS)[number],
  );
}

export function isPayrollProductContributorEmail(email?: string | null) {
  return email?.trim().toLowerCase() === STEPHEN_PRODUCT_CONTRIBUTOR_EMAIL;
}
