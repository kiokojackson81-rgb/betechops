import { PrismaClient } from "@prisma/client";

const globalForPrimaryPrisma = globalThis as unknown as { prismaPrimary?: PrismaClient };

const directDatabaseUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;

export const prismaPrimary =
  globalForPrimaryPrisma.prismaPrimary ??
  new PrismaClient({
    log: ["warn", "error"],
    datasources: directDatabaseUrl
      ? {
          db: {
            url: directDatabaseUrl,
          },
        }
      : undefined,
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrimaryPrisma.prismaPrimary = prismaPrimary;
}
