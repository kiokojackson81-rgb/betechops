/*
  Warnings:

  - Added the required column `day` to the `DailyReport` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "DailyReport" ADD COLUMN     "day" TEXT NOT NULL,
ADD COLUMN     "tasks" JSONB;
