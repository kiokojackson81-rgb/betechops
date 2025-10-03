// src/app/api/health/route.ts
import { NextResponse } from "next/server";
import { computeHealth } from "@/lib/health";

export async function GET() {
  const payload = await computeHealth();
  return NextResponse.json(payload);
}