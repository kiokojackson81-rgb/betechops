-- Preview support receipts and their items for the specified receipt numbers
SELECT id, receiptNumber, sellingTotal, paymentMethod, dailyEntryId, createdAt, submittedById, data
FROM "SupportReceipt"
WHERE "receiptNumber" IN ('1030','uy69','1032','8000u','1038','1036','1037','1031','1042','1044','1035','1045');

-- Items for those receipts
SELECT i.*
FROM "SupportReceiptItem" i
WHERE i."receiptId" IN (
  SELECT r.id FROM "SupportReceipt" r WHERE r."receiptNumber" IN ('1030','uy69','1032','8000u','1038','1036','1037','1031','1042','1044','1035','1045')
);
