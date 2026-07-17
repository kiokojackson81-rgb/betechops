ALTER TYPE "AttendantCategory" ADD VALUE IF NOT EXISTS 'TECHNICAL_TEAM';

CREATE TABLE IF NOT EXISTS "TechnicalProfile" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "teamRole" TEXT,
  "positionTitle" TEXT,
  "employeeNumber" TEXT,
  "phoneNumber" TEXT,
  "epraLicenseNumber" TEXT,
  "epraLicenseClass" TEXT,
  "drivingLicenseDetails" TEXT,
  "employmentDate" TIMESTAMP(3),
  "activeAccount" BOOLEAN NOT NULL DEFAULT TRUE,
  "permissionScope" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TechnicalProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TechnicalProfile_userId_key" ON "TechnicalProfile"("userId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'TechnicalProfile_userId_fkey'
      AND table_name = 'TechnicalProfile'
  ) THEN
    ALTER TABLE "TechnicalProfile"
      ADD CONSTRAINT "TechnicalProfile_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
