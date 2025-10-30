import { PrismaClient, Platform } from "@prisma/client";
import { fetchOrdersForShop } from "../src/lib/jumia";
import { fetchOrders as kmFetchOrders } from "../src/lib/connectors/kilimall";
import { decryptJson } from "../src/lib/crypto/secure-json";

const prisma = new PrismaClient();

async function sanityShopByName(name: string) {
  const shop = await prisma.shop.findFirst({ where: { name }, select: { id: true, name: true, platform: true, credentialsEncrypted: true } });
  if (!shop) throw new Error(`shop not found: ${name}`);

  if (shop.platform === "JUMIA") {
  const items = await fetchOrdersForShop(shop.id).catch((e: unknown) => { throw new Error(`Jumia fetch failed for ${name}: ${String(e instanceof Error ? e.message : e)}`); });
    return { name, platform: shop.platform, count: items.length, sample: items[0] ? { id: (items[0] as any).id, status: (items[0] as any).status } : null };
  }

  if (shop.platform === "KILIMALL") {
    if (!shop.credentialsEncrypted) return { name, platform: shop.platform, error: "missing credentials" } as const;
    const creds = decryptJson(shop.credentialsEncrypted as any) as any;
    const appId = (creds?.storeId as string) || (creds?.appId as string);
    const appSecret = (creds?.appSecret as string) || (creds?.app_secret as string);
    const apiBase = (creds?.apiBase as string) || "https://openapi.kilimall.co.ke";
  const items = await kmFetchOrders({ appId, appSecret, apiBase }, { since: undefined }).catch((e: unknown) => { throw new Error(`Kilimall fetch failed for ${name}: ${String(e instanceof Error ? e.message : e)}`); });
    return { name, platform: shop.platform, count: items.length, sample: items[0] ? { id: (items[0] as any).id, status: (items[0] as any).status } : null };
  }

  return { name, platform: shop.platform, error: "unsupported platform" } as const;
}

async function main() {
  const targets = [
    "Betech store", // Jumia
    "Jm Collection Kilimall", // Kilimall
  ];
  const out: any[] = [];
  for (const t of targets) {
    try { out.push(await sanityShopByName(t)); } catch (e) { out.push({ name: t, error: String(e instanceof Error ? e.message : e) }); }
  }
  console.log(JSON.stringify({ ok: true, results: out }, null, 2));
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); prisma.$disconnect().finally(() => process.exit(1)); });
