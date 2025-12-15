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
      select: { id: true, name: true, platform: true, apiConfig: { select: { apiKey: true } } },
    }),
  ]);

  const shopsById = new Map(shops.map((shop) => [shop.id, shop]));
  const shopsByName = new Map(
    shops
      .filter((shop) => Boolean(shop.name))
      .map((shop) => [shop.name.trim().toLowerCase(), shop]),
  );
  // map apiConfig.apiKey (per-shop configured key) to shop so we can match
  // marketplace account identifiers like jumiaShopSid / kilimallShopCode
  const shopsByApiKey = new Map<string, typeof shops[0]>();
  for (const shop of shops) {
    const apiKey = (shop as any).apiConfig?.apiKey;
    if (apiKey) shopsByApiKey.set(String(apiKey), shop);
  }

  const matchedAccountIds = new Set<string>();
  const payload = accounts
    .map((account) => {
      const matchById = shopsById.get(account.id);
      const matchByName = account.displayName ? shopsByName.get(account.displayName.trim().toLowerCase()) : undefined;
      // try matching by configured per-shop api key (common place to store
      // marketplace shop identifiers like Jumia SID or Kilimall code)
      const matchByApiKey = account.jumiaShopSid ? shopsByApiKey.get(account.jumiaShopSid) : undefined;
      const matchByApiKey2 = !matchByApiKey && account.kilimallShopCode ? shopsByApiKey.get(account.kilimallShopCode) : undefined;
      const shopRecord = matchById ?? matchByName ?? matchByApiKey ?? matchByApiKey2;
      if (!shopRecord) return null;
      matchedAccountIds.add(account.id);

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

  // Ensure we return an entry for every active shop even if there's no
  // matching marketplace account. This guarantees the admin UI always
  // receives selectable shops (avoids empty "Loading shop assignments…").
  const payloadById = new Map(payload.map((p) => [p.id, p]));
  for (const shop of shops) {
    if (!payloadById.has(shop.id)) {
      payloadById.set(shop.id, {
        id: shop.id,
        shopName: shop.name,
        displayName: shop.name ?? shop.id,
        platform: shop.platform as Platform,
        attendants: [],
        // Provide a typed-empty primaryAttendant to satisfy TS inference in
        // production builds. Consumers treat missing attendant as "Unassigned".
        primaryAttendant: null as unknown as { id: string; name: string | null; email: string },
        identifiers: { jumiaShopSid: null, kilimallShopCode: null },
      });
    }
  }

  for (const account of accounts) {
    if (matchedAccountIds.has(account.id)) continue;
    payloadById.set(account.id, {
      id: account.id,
      shopName: account.displayName ?? account.id,
      displayName: account.displayName,
      platform: account.platform as Platform,
      attendants: account.assignments
        .map((assignment) => assignment.attendant)
        .filter((attendant): attendant is NonNullable<typeof attendant> => Boolean(attendant))
        .map((attendant) => ({
          id: attendant.id,
          name: attendant.name ?? null,
          email: attendant.email ?? null,
        })),
      primaryAttendant: null,
      identifiers: {
        jumiaShopSid: account.jumiaShopSid,
        kilimallShopCode: account.kilimallShopCode,
      },
    });
  }

  const finalPayload = Array.from(payloadById.values()).sort((a, b) => (a.displayName || "").localeCompare(b.displayName || ""));

  return NextResponse.json(finalPayload);
}
