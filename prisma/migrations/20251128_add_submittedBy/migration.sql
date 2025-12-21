-- Migration: add submittedBy to DailyReport
-- This migration adds a nullable text column "submittedBy" to the DailyReport table.

ALTER TABLE "DailyReport" ADD COLUMN "submittedBy" TEXT;
