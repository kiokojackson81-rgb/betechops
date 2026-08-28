-- Product-specific commissions are retired for new sales. Historical commission
-- approval and payroll ledger records are intentionally preserved for audit.
UPDATE "Product"
SET
  "commissionEnabled" = FALSE,
  "commissionAmount" = NULL,
  "commissionRequiresApproval" = FALSE
WHERE
  COALESCE("commissionEnabled", FALSE) = TRUE
  OR "commissionAmount" IS NOT NULL
  OR COALESCE("commissionRequiresApproval", FALSE) = TRUE;
