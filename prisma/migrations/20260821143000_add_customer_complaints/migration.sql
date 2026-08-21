CREATE TABLE "Complaint" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "assignedToId" TEXT,
    "orderId" TEXT,
    "receiptId" TEXT,
    "websiteOrderId" TEXT,
    "relatedReference" TEXT,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "problemStartedAt" TIMESTAMP(3),
    "systemStatus" TEXT,
    "errorCode" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "technicalFindings" TEXT,
    "warrantyFindings" TEXT,
    "siteVisitInfo" TEXT,
    "resolution" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Complaint_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ComplaintAttachment" (
    "id" TEXT NOT NULL,
    "complaintId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileKey" TEXT,
    "contentType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ComplaintAttachment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ComplaintActivity" (
    "id" TEXT NOT NULL,
    "complaintId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "actorType" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "previousData" JSONB,
    "newData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ComplaintActivity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ComplaintMessage" (
    "id" TEXT NOT NULL,
    "complaintId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "visibility" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ComplaintMessage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Complaint_reference_key" ON "Complaint"("reference");
CREATE INDEX "Complaint_customerId_createdAt_idx" ON "Complaint"("customerId", "createdAt");
CREATE INDEX "Complaint_status_priority_createdAt_idx" ON "Complaint"("status", "priority", "createdAt");
CREATE INDEX "Complaint_assignedToId_status_idx" ON "Complaint"("assignedToId", "status");
CREATE INDEX "Complaint_orderId_idx" ON "Complaint"("orderId");
CREATE INDEX "Complaint_receiptId_idx" ON "Complaint"("receiptId");
CREATE INDEX "Complaint_websiteOrderId_idx" ON "Complaint"("websiteOrderId");
CREATE INDEX "ComplaintAttachment_complaintId_createdAt_idx" ON "ComplaintAttachment"("complaintId", "createdAt");
CREATE INDEX "ComplaintActivity_complaintId_createdAt_idx" ON "ComplaintActivity"("complaintId", "createdAt");
CREATE INDEX "ComplaintMessage_complaintId_visibility_createdAt_idx" ON "ComplaintMessage"("complaintId", "visibility", "createdAt");

ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "Receipt"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_websiteOrderId_fkey" FOREIGN KEY ("websiteOrderId") REFERENCES "WebsiteOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ComplaintAttachment" ADD CONSTRAINT "ComplaintAttachment_complaintId_fkey" FOREIGN KEY ("complaintId") REFERENCES "Complaint"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ComplaintAttachment" ADD CONSTRAINT "ComplaintAttachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ComplaintActivity" ADD CONSTRAINT "ComplaintActivity_complaintId_fkey" FOREIGN KEY ("complaintId") REFERENCES "Complaint"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ComplaintActivity" ADD CONSTRAINT "ComplaintActivity_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ComplaintMessage" ADD CONSTRAINT "ComplaintMessage_complaintId_fkey" FOREIGN KEY ("complaintId") REFERENCES "Complaint"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ComplaintMessage" ADD CONSTRAINT "ComplaintMessage_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
