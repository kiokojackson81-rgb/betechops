-- CreateTable
CREATE TABLE "CallFeedback" (
    "id" TEXT NOT NULL,
    "phone" TEXT,
    "callId" TEXT,
    "rating" INTEGER NOT NULL,
    "contactReason" TEXT NOT NULL,
    "staffHelpful" TEXT NOT NULL,
    "questionsAnswered" TEXT NOT NULL,
    "recommend" TEXT NOT NULL,
    "comments" TEXT,
    "wantsContact" BOOLEAN NOT NULL DEFAULT false,
    "name" TEXT,
    "email" TEXT,
    "reviewed" BOOLEAN NOT NULL DEFAULT false,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CallFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallFeedbackSmsLog" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "callId" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CallFeedbackSmsLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CallFeedback_phone_idx" ON "CallFeedback"("phone");

-- CreateIndex
CREATE INDEX "CallFeedback_callId_idx" ON "CallFeedback"("callId");

-- CreateIndex
CREATE INDEX "CallFeedback_createdAt_idx" ON "CallFeedback"("createdAt");

-- CreateIndex
CREATE INDEX "CallFeedback_rating_idx" ON "CallFeedback"("rating");

-- CreateIndex
CREATE INDEX "CallFeedbackSmsLog_phone_idx" ON "CallFeedbackSmsLog"("phone");

-- CreateIndex
CREATE INDEX "CallFeedbackSmsLog_sentAt_idx" ON "CallFeedbackSmsLog"("sentAt");

-- CreateIndex
CREATE INDEX "CallFeedbackSmsLog_phone_sentAt_idx" ON "CallFeedbackSmsLog"("phone", "sentAt");
