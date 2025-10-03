// src/app/api/health/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  let productCount = 0;
  let dbOk = false;
  try {
    productCount = await prisma.product.count();
    dbOk = true;
  } catch (e) {
    console.error("/api/health prisma error:", e);
  }

  const authReady = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.NEXTAUTH_SECRET);

  // Provide sanitized DATABASE_URL info (scheme and host only)
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

  return NextResponse.json({
    status: "ok",
    productCount,
    authReady,
    dbOk,
    hasDatabaseUrl: Boolean(dbUrl),
    dbScheme,
    dbHost,
    timestamp: new Date().toISOString(),
  });
}