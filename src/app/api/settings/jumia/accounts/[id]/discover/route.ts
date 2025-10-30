import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { JumiaClient } from "@/lib/jumia/client";

const API_BASE = "https://vendor-api.jumia.com";
const TOKEN_URL = "https://vendor-api.jumia.com/token";

async function requireAdmin() {
  const session = await auth();
  const role = (session as unknown as { user?: { role?: string } } | null)?.user?.role;
  if (role !== "ADMIN") {
    throw new NextResponse(JSON.stringify({ error: "Forbidden" }), { status: 403 });
  }
}

// Next 15 route handlers: context is an object whose params is a Promise
export async function POST(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
  } catch (res) {
    if (res instanceof NextResponse) return res;
    throw res;
  }

  const { params } = context;
  const { id: accountId } = await params;
  if (!accountId) {
    return NextResponse.json({ error: "Missing account id" }, { status: 400 });
  }

  const account = await prisma.jumiaAccount.findUnique({ where: { id: accountId } });
  if (!account) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  const client = new JumiaClient(
    API_BASE,
    TOKEN_URL,
    account.clientId,
    account.refreshToken,
    async (rotated) => {
      await prisma.jumiaAccount.update({
        where: { id: account.id },
        data: { refreshToken: rotated },
      });
    }
  );

  try {
    const payload = await client.getShops();
    const shops = Array.isArray(payload?.shops) ? payload.shops : [];

    await Promise.all(
      shops.map((shop) =>
        prisma.jumiaShop.upsert({
          where: { id: shop.id },
          create: {
            id: shop.id,
            name: shop.name,
            accountId: account.id,
          },
          update: {
            name: shop.name,
            accountId: account.id,
          },
        })
      )
    );

    await prisma.jumiaShop.deleteMany({
      where: {
        accountId: account.id,
        id: { notIn: shops.map((shop) => shop.id) },
      },
    });

    const refreshed = await prisma.jumiaAccount.findUnique({
      where: { id: account.id },
      include: { shops: { select: { id: true, name: true }, orderBy: { name: "asc" } } },
    });

    return NextResponse.json({
      ok: true,
      shops: refreshed?.shops ?? [],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to discover shops";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
