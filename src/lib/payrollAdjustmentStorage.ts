import { prisma } from "@/lib/prisma";

const globalForPayrollAdjustmentStorage = globalThis as unknown as {
  __payrollAdjustmentStorageReady?: boolean;
};

export async function ensurePayrollAdjustmentStorage() {
  if (globalForPayrollAdjustmentStorage.__payrollAdjustmentStorageReady) return;

  const statements = [
    `
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE lower(typname) = lower('payrolladjustmenttype')
  ) THEN
    CREATE TYPE "PayrollAdjustmentType" AS ENUM ('CHAMA', 'LATENESS', 'DISCIPLINE', 'BONUS', 'COMMISSION_TOPUP', 'OTHER');
  END IF;
END $$;
`,
    `
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE lower(typname) = lower('payrolladjustmentkind')
  ) THEN
    CREATE TYPE "PayrollAdjustmentKind" AS ENUM ('ADDITION', 'DEDUCTION');
  END IF;
END $$;
`,
    `
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'AttendantPayrollAdjustment'
  ) THEN
    CREATE TABLE "AttendantPayrollAdjustment" (
      "id" TEXT PRIMARY KEY,
      "attendantId" TEXT NOT NULL,
      "periodKey" TEXT NOT NULL,
      "periodLabel" TEXT NOT NULL,
      "adjustmentType" "PayrollAdjustmentType" NOT NULL,
      "label" TEXT NOT NULL,
      "amount" INTEGER NOT NULL,
      "createdById" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "adjustmentKind" "PayrollAdjustmentKind" NOT NULL DEFAULT 'DEDUCTION'
    );
  END IF;
END $$;
`,
    `
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'AttendantPayrollAdjustment'
      AND column_name = 'adjustmentKind'
  ) THEN
    ALTER TABLE "AttendantPayrollAdjustment"
    ADD COLUMN "adjustmentKind" "PayrollAdjustmentKind" NOT NULL DEFAULT 'DEDUCTION';
  END IF;
END $$;
`,
    `
CREATE INDEX IF NOT EXISTS "AttendantPayrollAdjustment_attendantId_periodKey_idx"
ON "AttendantPayrollAdjustment"("attendantId", "periodKey");
`,
    `
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'User'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'AttendantPayrollAdjustment'
      AND constraint_name = 'AttendantPayrollAdjustment_attendantId_fkey'
  ) THEN
    ALTER TABLE "AttendantPayrollAdjustment"
    ADD CONSTRAINT "AttendantPayrollAdjustment_attendantId_fkey"
    FOREIGN KEY ("attendantId") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
`,
  ];

  for (const statement of statements) {
    await prisma.$executeRawUnsafe(statement);
  }

  globalForPayrollAdjustmentStorage.__payrollAdjustmentStorageReady = true;
}
