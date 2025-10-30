-- Adjust default, then cast platform to enum, then restore default
ALTER TABLE "Shop" ALTER COLUMN "platform" DROP DEFAULT;
ALTER TABLE "Shop"
  ALTER COLUMN "platform" TYPE "betechops_ops"."Platform"
  USING ("platform"::text::"betechops_ops"."Platform");
ALTER TABLE "Shop" ALTER COLUMN "platform" SET DEFAULT 'JUMIA'::"betechops_ops"."Platform";
