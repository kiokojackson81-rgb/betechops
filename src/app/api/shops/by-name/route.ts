import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma, Platform } from "@prisma/client";

export const dynamic = "force-dynamic";

// GET /api/shops/by-name?name=JM%20Collection&platform=JUMIA
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const name = url.searchParams.get("name");
  const platformParam = url.searchParams.get("platform");

  if (!name || !name.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  // Optional platform filter, limited to known enum values
  const platform = (platformParam === "JUMIA" || platformParam === "KILIMALL")
    ? (platformParam as Platform)
    : undefined;

  const where: Prisma.ShopWhereInput = {
    name: { equals: name.trim(), mode: "insensitive" },
    ...(platform ? { platform } : {}),
  };

  try {
    const shop = await prisma.shop.findFirst({
      where,
      select: { id: true, name: true, platform: true, isActive: true },
    });
    if (!shop) {
      return NextResponse.json({ ok: false, error: "Shop not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, shop });
  } catch (e: unknown) {
    const msg = typeof e === "object" && e !== null && "message" in (e as any)
      ? String((e as any).message)
      : String(e ?? "Server error");
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
