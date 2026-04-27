ALTER TABLE "Product"
ADD COLUMN "commissionEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "commissionAmount" DECIMAL(12, 2),
ADD COLUMN "commissionRequiresApproval" BOOLEAN NOT NULL DEFAULT false;
