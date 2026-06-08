CREATE TABLE IF NOT EXISTS "OtpCode" (
  "id" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "used" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "OtpCode_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "OtpCode_phone_createdAt_idx"
  ON "OtpCode"("phone", "createdAt");

CREATE INDEX IF NOT EXISTS "OtpCode_phone_used_expiresAt_idx"
  ON "OtpCode"("phone", "used", "expiresAt");
