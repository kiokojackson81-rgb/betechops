// src/app/api/health/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const productCount = await prisma.product.count();
  return NextResponse.json({
    status: "ok",
    productCount,
    timestamp: new Date().toISOString(),
  });
}