import { NextResponse } from "next/server";
import { Platform } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api";
import { MarketplaceAssignmentRoleValues } from "@/lib/marketplaceAssignment";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireRole(["ADMIN", "SUPERVISOR"]);
  if (!guard.ok) return guard.res;

  const now = new Date();
  const [accounts, shops] = await Promise.all([
    prisma.marketplaceAccount.findMany({
      where: { isActive: true },
      orderBy: { displayName: "asc" },
      include: {
        assignments: {
          where: {
            role: { in: MarketplaceAssignmentRoleValues },
            OR: [{ endsAt: null }, { endsAt: { gt: now } }],
          },
          orderBy: { startsAt: "desc" },
          include: {
            attendant: { select: { id: true, name: true, email: true } },
          },
        },
      },
    }),
    prisma.shop.findMany({
      where: { isActive: true },
      select: { id: true, name: true, platform: true },
    }),
  ]);

  const shopsById = new Map(shops.map((shop) => [shop.id, shop]));
  const shopsByName = new Map(
    shops
      .filter((shop) => Boolean(shop.name))
      .map((shop) => [shop.name.trim().toLowerCase(), shop]),
  );

  const payload = accounts
    .map((account) => {
      const matchById = shopsById.get(account.id);
      const matchByName = account.displayName ? shopsByName.get(account.displayName.trim().toLowerCase()) : undefined;
      const shopRecord = matchById ?? matchByName;
      if (!shopRecord) return null;

      const attendants = account.assignments
        .map((assignment) => assignment.attendant)
        .filter((attendant): attendant is NonNullable<typeof attendant> => Boolean(attendant))
        .map((attendant) => ({
          id: attendant.id,
          name: attendant.name ?? null,
          email: attendant.email ?? null,
        }));

      const primaryAttendant = attendants[0] ?? null;

      return {
        id: shopRecord.id,
        shopName: shopRecord.name,
        displayName: account.displayName,
        platform: account.platform as Platform,
        attendants,
        primaryAttendant,
        identifiers: {
          jumiaShopSid: account.jumiaShopSid,
          kilimallShopCode: account.kilimallShopCode,
        },
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

  return NextResponse.json(payload);
}
