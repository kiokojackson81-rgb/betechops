-- Minimal, guarded reconciliation for running prisma/seed.js
-- Non-destructive and idempotent: uses existence checks

-- 1) Ensure Role enum exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE lower(typname) = lower('role')) THEN
    CREATE TYPE "Role" AS ENUM ('ADMIN', 'SUPERVISOR', 'ATTENDANT');
  END IF;
END
$$;

-- 2) Ensure AttendantCategory enum exists (common values used in seed)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE lower(typname) = lower('attendantcategory')) THEN
    CREATE TYPE "AttendantCategory" AS ENUM (
      'DIRECT_SALES_OPS',
      'MARKETING_OPS',
      'JUMIA_KILIMALL_OPS',
      'SUPPORT_OPS',
      'BETECH_OPS'
    );
  END IF;
END
$$;

-- 3) Minimal Shop table (only columns seed needs)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'Shop'
  ) THEN
    CREATE TABLE "Shop" (
      "id" TEXT PRIMARY KEY,
      "name" TEXT NOT NULL,
      "location" TEXT,
      "phone" TEXT,
      "email" TEXT,
      "isActive" BOOLEAN DEFAULT true,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  END IF;
END
$$;

-- 4) Minimal Product table (columns used by seed)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'Product'
  ) THEN
    CREATE TABLE "Product" (
      "id" TEXT PRIMARY KEY,
      "sku" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "category" TEXT,
      "sellingPrice" DOUBLE PRECISION,
      "lastBuyingPrice" DOUBLE PRECISION,
      "minStockLevel" INTEGER DEFAULT 5,
      "stockQuantity" INTEGER DEFAULT 0,
      "isActive" BOOLEAN DEFAULT true,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  END IF;
END
$$;

-- Ensure unique index on Product.sku
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'Product' AND indexname = 'Product_sku_key'
  ) THEN
    CREATE UNIQUE INDEX "Product_sku_key" ON "Product" ("sku");
  END IF;
END
$$;

-- 5) Minimal User table (columns used by seed)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'User'
  ) THEN
    CREATE TABLE "User" (
      "id" TEXT PRIMARY KEY,
      "email" TEXT NOT NULL,
      "name" TEXT,
      "password" TEXT,
      "role" "Role" DEFAULT 'ATTENDANT',
      "isActive" BOOLEAN DEFAULT true,
      "attendantCategory" "AttendantCategory",
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  END IF;
END
$$;

-- Ensure unique index on User.email
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'User' AND indexname = 'User_email_key'
  ) THEN
    CREATE UNIQUE INDEX "User_email_key" ON "User" ("email");
  END IF;
END
$$;

-- Optional: create reconciliation log table (harmless if exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'schema_reconciliation_log'
  ) THEN
    CREATE TABLE "schema_reconciliation_log" (
      id TEXT PRIMARY KEY,
      created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      note TEXT
    );
  END IF;
END
$$;
