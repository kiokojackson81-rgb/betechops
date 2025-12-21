-- Add paymentMethod and receiptNumber to DailySale

ALTER TABLE "DailySale" ADD COLUMN "paymentMethod" TEXT;
ALTER TABLE "DailySale" ADD COLUMN "receiptNumber" TEXT;
