// src/app/api/health/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  let productCount = 0;
  try {
    productCount = await prisma.product.count();
  } catch (e) {
    console.error("/api/health prisma error:", e);
  }
  const authReady = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.NEXTAUTH_SECRET);
  return NextResponse.json({
    status: "ok",
    productCount,
    authReady,
    timestamp: new Date().toISOString(),
  });
}