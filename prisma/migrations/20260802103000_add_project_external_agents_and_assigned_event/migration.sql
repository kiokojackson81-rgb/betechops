ALTER TYPE "ProjectNotificationEventType" ADD VALUE IF NOT EXISTS 'PROJECT_ASSIGNED';

CREATE TABLE IF NOT EXISTS "ProjectExternalAgent" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "whatsappNumber" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectExternalAgent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ProjectExternalAgent_isActive_name_idx"
ON "ProjectExternalAgent"("isActive", "name");
