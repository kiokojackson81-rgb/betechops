SELECT r.id, r."receiptNumber", r."sellingTotal", r."buyingTotal", r."createdAt", r."updatedAt"
FROM "SupportReceipt" r
WHERE r."receiptNumber" = 'Betech-20251212-20927';

SELECT si.id, si."productName", si."buyingPrice", si."pricedAt", si."updatedAt"
FROM "SupportReceiptItem" si
JOIN "SupportReceipt" r ON r.id = si."receiptId"
WHERE r."receiptNumber" = 'Betech-20251212-20927'
ORDER BY si.id;
