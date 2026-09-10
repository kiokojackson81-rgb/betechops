import { PrismaClient } from "@prisma/client";

const globalForPrimaryPrisma = globalThis as unknown as { prismaPrimary?: PrismaClient };

const normalizeDatabaseTarget = (databaseUrl: string) => {
  try {
    const parsed = new URL(databaseUrl);
    // Neon uses a `-pooler` hostname for its pooled connection. That is still
    // the same branch as the equivalent direct hostname, so compare the
    // branch/database target rather than the exact connection host.
    const hostname = parsed.hostname.replace(/-pooler(?=\.)/, "");
    return `${parsed.protocol}//${hostname}${parsed.pathname}`;
  } catch {
    return "";
  }
};

const databaseUrl = process.env.DATABASE_URL;
const directUrl = process.env.DIRECT_URL;
const hasMismatchedDirectTarget = Boolean(
  databaseUrl &&
    directUrl &&
    normalizeDatabaseTarget(databaseUrl) !== normalizeDatabaseTarget(directUrl),
);

// Operational receipt/project reads must use the same database as writes.
// A wrongly configured DIRECT_URL previously made post-save verification and
// printing query a different database from the POS save route.
const primaryDatabaseUrl = hasMismatchedDirectTarget
  ? databaseUrl
  : directUrl || databaseUrl;

if (hasMismatchedDirectTarget) {
  console.error(
    "[database] DIRECT_URL and DATABASE_URL target different databases; using DATABASE_URL for operational consistency.",
  );
}

export const prismaPrimary =
  globalForPrimaryPrisma.prismaPrimary ??
  new PrismaClient({
    log: ["warn", "error"],
    datasources: primaryDatabaseUrl
      ? {
          db: {
            url: primaryDatabaseUrl,
          },
        }
      : undefined,
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrimaryPrisma.prismaPrimary = prismaPrimary;
}
