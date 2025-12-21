BEGIN;
ALTER TABLE "User" ALTER COLUMN "attendantCategory" TYPE "AttendantCategory" USING "attendantCategory"::text::"AttendantCategory";
ALTER TABLE "AttendantActivity" ALTER COLUMN "category" TYPE "AttendantCategory" USING "category"::text::"AttendantCategory";
ALTER TABLE "AttendantCategoryAssignment" ALTER COLUMN "category" TYPE "AttendantCategory" USING "category"::text::"AttendantCategory";
DROP TYPE IF EXISTS "AttendantCategory_new";
COMMIT;
