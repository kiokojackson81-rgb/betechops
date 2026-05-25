CREATE TABLE "ProductAiJob" (
  "id" TEXT NOT NULL,
  "productId" TEXT,
  "kind" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "sourceImageUrl" TEXT,
  "sourceImageKey" TEXT,
  "createdById" TEXT,
  "options" JSONB,
  "analysis" JSONB,
  "generatedDraft" JSONB,
  "cleanImageUrl" TEXT,
  "transparentImageUrl" TEXT,
  "thumbnailUrl" TEXT,
  "bannerImageUrl" TEXT,
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ProductAiJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProductAiJob_status_createdAt_idx" ON "ProductAiJob"("status", "createdAt");
CREATE INDEX "ProductAiJob_kind_createdAt_idx" ON "ProductAiJob"("kind", "createdAt");
CREATE INDEX "ProductAiJob_productId_createdAt_idx" ON "ProductAiJob"("productId", "createdAt");

ALTER TABLE "ProductAiJob"
ADD CONSTRAINT "ProductAiJob_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "Product"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
