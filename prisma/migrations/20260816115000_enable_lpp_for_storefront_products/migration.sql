-- Enable Lipa Pole Pole for the existing active storefront catalogue.
-- Products below the standard KES 500 deposit remain explicitly ineligible.
UPDATE "Product"
SET "lipaPolePoleEnabled" = true,
    "lipaPolePoleMinDeposit" = COALESCE("lipaPolePoleMinDeposit", 500.00),
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "isActive" = true
  AND COALESCE("status", 'ACTIVE') = 'ACTIVE'
  AND (COALESCE("ecommerceVisible", false) OR COALESCE("showInShop", false))
  AND "sellingPrice" >= 500
  AND "lipaPolePoleEnabled" = false;
