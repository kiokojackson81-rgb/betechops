-- Migration: add shopName column to JumiaOrder
-- Run with: npx prisma migrate deploy or apply using your DB tooling

ALTER TABLE "JumiaOrder" ADD COLUMN "shopName" text;
