CREATE TABLE IF NOT EXISTS "LipaPolePoleItem" (
  "id" TEXT NOT NULL,
  "lipaPolePoleId" TEXT NOT NULL,
  "productId" TEXT,
  "description" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "unitPrice" DECIMAL(14,2) NOT NULL,
  "total" DECIMAL(14,2) NOT NULL,
  "serial" TEXT,
  "warranty" TEXT,
  "position" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LipaPolePoleItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LipaPolePoleItem_lipaPolePoleId_fkey" FOREIGN KEY ("lipaPolePoleId") REFERENCES "LipaPolePole"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "LipaPolePoleItem_lipaPolePoleId_position_idx" ON "LipaPolePoleItem"("lipaPolePoleId", "position");
CREATE INDEX IF NOT EXISTS "LipaPolePoleItem_productId_idx" ON "LipaPolePoleItem"("productId");

INSERT INTO "LipaPolePoleItem" (
  "id", "lipaPolePoleId", "productId", "description", "quantity", "unitPrice", "total", "serial", "warranty", "position", "createdAt", "updatedAt"
)
SELECT
  lpp."id" || '-item-1',
  lpp."id",
  lpp."productId",
  COALESCE(NULLIF(lpp."customProductName", ''), p."name", 'Lipa Pole Pole item'),
  lpp."quantity",
  lpp."agreedUnitPrice",
  lpp."agreedTotal",
  lpp."itemSerial",
  lpp."itemWarranty",
  0,
  lpp."createdAt",
  lpp."updatedAt"
FROM "LipaPolePole" lpp
LEFT JOIN "Product" p ON p."id" = lpp."productId"
WHERE NOT EXISTS (
  SELECT 1 FROM "LipaPolePoleItem" item WHERE item."lipaPolePoleId" = lpp."id"
);
