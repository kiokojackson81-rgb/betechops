ALTER TABLE "Product"
  ALTER COLUMN "variableCost" SET DEFAULT false;

UPDATE "Product"
  SET "variableCost" = false
  WHERE "variableCost" IS NULL;

ALTER TABLE "Product"
  ALTER COLUMN "variableCost" SET NOT NULL;
