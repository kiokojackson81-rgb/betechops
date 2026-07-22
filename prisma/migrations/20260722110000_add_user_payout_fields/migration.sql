ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "payoutMethod" TEXT,
ADD COLUMN IF NOT EXISTS "payoutAccountName" TEXT,
ADD COLUMN IF NOT EXISTS "mobileMoneyPhoneNumber" TEXT,
ADD COLUMN IF NOT EXISTS "tillPaybillNumber" TEXT,
ADD COLUMN IF NOT EXISTS "tillPaybillBusinessName" TEXT,
ADD COLUMN IF NOT EXISTS "paybillAccountNumber" TEXT,
ADD COLUMN IF NOT EXISTS "notificationPhoneNumber" TEXT;
