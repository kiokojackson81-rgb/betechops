CREATE TABLE "EmployeeDocument" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "uploadedById" TEXT,
  "documentType" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "fileUrl" TEXT NOT NULL,
  "fileKey" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "EmployeeDocument_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EmployeeDocument_userId_createdAt_idx" ON "EmployeeDocument"("userId", "createdAt");
CREATE INDEX "EmployeeDocument_uploadedById_createdAt_idx" ON "EmployeeDocument"("uploadedById", "createdAt");
CREATE INDEX "EmployeeDocument_documentType_createdAt_idx" ON "EmployeeDocument"("documentType", "createdAt");

ALTER TABLE "EmployeeDocument"
ADD CONSTRAINT "EmployeeDocument_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EmployeeDocument"
ADD CONSTRAINT "EmployeeDocument_uploadedById_fkey"
FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
