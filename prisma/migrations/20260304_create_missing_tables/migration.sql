-- Migration: create minimal Order, OrderItem, Receipt tables for test harness
BEGIN;

CREATE TABLE IF NOT EXISTS "Order" (
  id text PRIMARY KEY,
  "orderNumber" text UNIQUE,
  "customerName" text,
  "shopId" text,
  "attendantId" text,
  metadata jsonb,
  status text,
  "paymentStatus" text,
  "totalAmount" numeric,
  "paidAmount" numeric,
  createdAt timestamp without time zone DEFAULT now(),
  updatedAt timestamp without time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "OrderItem" (
  id text PRIMARY KEY,
  "orderId" text,
  "productId" text,
  quantity integer,
  "sellingPrice" numeric,
  serial text,
  warranty jsonb
);

CREATE TABLE IF NOT EXISTS "Receipt" (
  id text PRIMARY KEY,
  "orderId" text UNIQUE,
  "receiptNumber" text,
  "docType" text,
  "issuedById" text,
  totals jsonb,
  data jsonb,
  "generatedAt" timestamp without time zone DEFAULT now()
);

COMMIT;
