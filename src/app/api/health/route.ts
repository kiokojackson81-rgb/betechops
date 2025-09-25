// src/app/api/health/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const productCount = await prisma.product.count();
  const authReady = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.NEXTAUTH_SECRET);
  return NextResponse.json({
    status: "ok",
    productCount,
    authReady,
    timestamp: new Date().toISOString(),
  });
}