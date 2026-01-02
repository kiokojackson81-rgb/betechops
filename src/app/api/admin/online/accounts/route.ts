import { NextResponse } from "next/server";
import { Platform } from "@prisma/client";
import { requireRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type UpsertPayload = {
  id?: string;
  platform: Platform;
  displayName: string;
  countryCode: string;
  currency?: string;
  jumiaShopSid?: string;
  kilimallShopCode?: string;
  isActive?: boolean;
  // Optional Jumia credential fields (server will create/link JumiaAccount when present)
  clientId?: string;
  refreshToken?: string;
  jumiaLabel?: string;
};

export async function GET() {
  const auth = await requireRole(["ADMIN", "SUPERVISOR"]);
  if (!auth.ok) return auth.res;

  const accounts = await prisma.marketplaceAccount.findMany({
    orderBy: [{ createdAt: "desc" }],
    include: {
      assignments: {
        include: {
          attendant: {
            select: { id: true, name: true, email: true },
          },
        },
      },
    },
  });

  return NextResponse.json({ accounts });
}

export async function POST(req: Request) {
  const auth = await requireRole("ADMIN");
  if (!auth.ok) return auth.res;

  let payload: UpsertPayload | null = null;
  try {
    payload = (await req.json()) as UpsertPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  if (!payload?.displayName || !payload.platform || !payload.countryCode) {
    return NextResponse.json({ error: "platform, displayName and countryCode are required" }, { status: 400 });
  }

  const data = {
    platform: payload.platform,
    displayName: payload.displayName.trim(),
    countryCode: payload.countryCode.trim(),
    currency: payload.currency?.trim() || "KES",
    jumiaShopSid: payload.jumiaShopSid?.trim() || null,
    kilimallShopCode: payload.kilimallShopCode?.trim() || null,
    isActive: payload.isActive ?? true,
  };

  const record = payload.id
    ? await prisma.marketplaceAccount.update({ where: { id: payload.id }, data })
    : await prisma.marketplaceAccount.create({ data });

  // If this is a JUMIA account and credentials were provided, ensure a JumiaAccount and JumiaShop exist
  if (payload.platform === Platform.JUMIA && payload.clientId && payload.refreshToken && (payload.jumiaShopSid || record.jumiaShopSid)) {
    const jumiaSid = payload.jumiaShopSid?.trim() || record.jumiaShopSid!;

    // Reuse existing JumiaAccount by clientId if present, otherwise create
    let jumiaAcct = await prisma.jumiaAccount.findFirst({ where: { clientId: payload.clientId } });
    if (!jumiaAcct) {
      jumiaAcct = await prisma.jumiaAccount.create({
        data: {
          label: payload.jumiaLabel?.trim() || payload.displayName.trim(),
          clientId: payload.clientId.trim(),
          refreshToken: payload.refreshToken.trim(),
        },
      });
    }

    // Upsert the JumiaShop to point at the JumiaAccount
    if (jumiaSid) {
      await prisma.jumiaShop.upsert({
        where: { id: jumiaSid },
        create: { id: jumiaSid, name: payload.displayName.trim(), accountId: jumiaAcct.id },
        update: { name: payload.displayName.trim(), accountId: jumiaAcct.id },
      });

      // ensure marketplaceAccount has the jumiaShopSid set
      if (!record.jumiaShopSid) {
        await prisma.marketplaceAccount.update({ where: { id: record.id }, data: { jumiaShopSid: jumiaSid } });
      }
    }
  }

  return NextResponse.json({ account: record });
}
