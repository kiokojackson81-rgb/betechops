import { prisma } from "@/lib/prisma";

export type HealthPayload = {
  status: "ok";
  productCount: number;
  authReady: boolean;
  dbOk: boolean;
  hasDatabaseUrl: boolean;
  dbScheme: string | null;
  dbHost: string | null;
  timestamp: string;
};

export async function computeHealth(): Promise<HealthPayload> {
  let productCount = 0;
  let dbOk = false;
  try {
    productCount = await prisma.product.count();
    dbOk = true;
  } catch (e) {
    console.error("computeHealth prisma error:", e);
  }

  const authReady = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.NEXTAUTH_SECRET);

  const dbUrl = process.env.DATABASE_URL || "";
  let dbScheme: string | null = null;
  let dbHost: string | null = null;
  try {
    if (dbUrl) {
      const u = new URL(dbUrl.replace(/^postgres:\/\//, "postgresql://"));
      dbScheme = u.protocol.replace(":", "");
      dbHost = u.hostname;
    }
  } catch {
    // ignore parse errors
  }

  return {
    status: "ok",
    productCount,
    authReady,
    dbOk,
    hasDatabaseUrl: Boolean(dbUrl),
    dbScheme,
    dbHost,
    timestamp: new Date().toISOString(),
  };
}
