import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const expectedTables = [
  "AgentProfile",
  "AgentCommission",
  "AgentPayout",
  "AgentActivityLog",
] as const;

async function main() {
  const identityRows = await prisma.$queryRaw<
    Array<{
      current_database: string;
      current_schema: string;
      inet_server_addr: string | null;
    }>
  >`
    SELECT
      current_database() AS current_database,
      current_schema() AS current_schema,
      inet_server_addr()::text AS inet_server_addr
  `;

  const rows = await prisma.$queryRaw<Array<{ table_name: string }>>`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name LIKE 'Agent%'
    ORDER BY table_name
  `;

  const found = new Set(rows.map((row) => row.table_name));
  const missing = expectedTables.filter((tableName) => !found.has(tableName));

  console.log(
    JSON.stringify(
      {
        ok: missing.length === 0,
        identity: identityRows[0] ?? null,
        found: expectedTables.filter((tableName) => found.has(tableName)),
        matchingTables: rows.map((row) => row.table_name),
        missing,
      },
      null,
      2,
    ),
  );

  if (missing.length > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
