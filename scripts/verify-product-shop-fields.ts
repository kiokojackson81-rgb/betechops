import "dotenv/config";

import { PrismaClient } from "@prisma/client";

const REQUIRED_COLUMNS = [
  "showInShop",
  "shopCategory",
  "shopShortDescription",
  "shopWarranty",
  "shopSpecs",
  "shopImageUrl",
  "shopBrand",
] as const;

const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Product'
    ORDER BY ordinal_position
  `);

  const actualColumns = new Set(rows.map((row) => row.column_name));
  const found = REQUIRED_COLUMNS.filter((column) => actualColumns.has(column));
  const missing = REQUIRED_COLUMNS.filter((column) => !actualColumns.has(column));

  console.log("Product shop-field verification");
  console.log(`DATABASE_URL target: ${maskDatabaseUrl(process.env.DATABASE_URL)}`);
  console.log("");
  console.log(`Found columns (${found.length}/${REQUIRED_COLUMNS.length}):`);
  for (const column of found) {
    console.log(`  - ${column}`);
  }

  console.log("");
  console.log(`Missing columns (${missing.length}/${REQUIRED_COLUMNS.length}):`);
  if (missing.length === 0) {
    console.log("  - none");
  } else {
    for (const column of missing) {
      console.log(`  - ${column}`);
    }
  }

  console.log("");
  if (missing.length === 0) {
    console.log("POS Catalogue ecommerce controls can be enabled by capability detection.");
  } else {
    console.log("POS Catalogue ecommerce controls are not fully available yet.");
    console.log("Apply the additive manual patch first, then rerun this verifier.");
  }

  console.log("This script is read-only and does not mutate the database.");
}

function maskDatabaseUrl(databaseUrl: string | undefined) {
  if (!databaseUrl) return "missing";

  try {
    const parsed = new URL(databaseUrl);
    const host = parsed.host || "unknown-host";
    const dbName = parsed.pathname.replace(/^\//, "") || "unknown-db";
    return `${host}/${dbName}`;
  } catch {
    return "unparseable";
  }
}

main()
  .catch((error) => {
    console.error("Failed to verify Product shop fields.");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
