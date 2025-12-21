-- CreateTable
CREATE TABLE "SupportDailyEntry" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "dayOfWeek" TEXT NOT NULL,
    "totalSales" INTEGER NOT NULL DEFAULT 0,
    "totalProfit" INTEGER NOT NULL DEFAULT 0,
    "newBatteries" INTEGER NOT NULL DEFAULT 0,
    "changedBatteries" INTEGER NOT NULL DEFAULT 0,
    "submittedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportDailyEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportSale" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "product" TEXT NOT NULL,
    "buyingPrice" INTEGER NOT NULL,
    "sellingPrice" INTEGER NOT NULL,
    "receiptNumber" TEXT,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "itemsCount" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportSale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportReceipt" (
    "id" TEXT NOT NULL,
    "dailyEntryId" TEXT NOT NULL,
    "receiptNumber" TEXT,
    "sellingTotal" INTEGER NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportReceiptItem" (
    "id" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "buyingPrice" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportReceiptItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupportDailyEntry_date_idx" ON "SupportDailyEntry"("date");

-- CreateIndex
CREATE INDEX "SupportDailyEntry_submittedById_idx" ON "SupportDailyEntry"("submittedById");

-- CreateIndex
CREATE INDEX "SupportSale_entryId_idx" ON "SupportSale"("entryId");

-- CreateIndex
CREATE INDEX "SupportReceipt_dailyEntryId_idx" ON "SupportReceipt"("dailyEntryId");

-- CreateIndex
CREATE INDEX "SupportReceiptItem_receiptId_idx" ON "SupportReceiptItem"("receiptId");

-- AddForeignKey
ALTER TABLE "SupportDailyEntry" ADD CONSTRAINT "SupportDailyEntry_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportSale" ADD CONSTRAINT "SupportSale_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "SupportDailyEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportReceipt" ADD CONSTRAINT "SupportReceipt_dailyEntryId_fkey" FOREIGN KEY ("dailyEntryId") REFERENCES "SupportDailyEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportReceiptItem" ADD CONSTRAINT "SupportReceiptItem_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "SupportReceipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

