import "dotenv/config";
import crypto from "crypto";
import { PrismaClient, Platform, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

type SyncResult = { shopName: string; action: "created" | "updated" | "skipped-no-credentials" | "skipped-inactive"; shopId?: string };

function resolveApiBase() {
  return (
    process.env.base_url ||
    process.env.BASE_URL ||
    process.env.JUMIA_API_BASE ||
    "https://vendor-api.jumia.com"
  );
}

function resolveTokenUrl(apiBase: string) {
  return (
    process.env.OIDC_TOKEN_URL ||
    process.env.JUMIA_OIDC_TOKEN_URL ||
    `${new URL(apiBase).origin}/token`
  );
}

function maybeEncrypt(obj: unknown): Prisma.InputJsonValue {
  const keyEnv = process.env.SECURE_JSON_KEY;
  if (!keyEnv) return obj as any;
  try {
    const key = /^[0-9a-f]{64}$/i.test(keyEnv)
      ? Buffer.from(keyEnv, "hex")
      : crypto.createHash("sha256").update(keyEnv).digest();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    const input = Buffer.from(JSON.stringify(obj), "utf8");
    const enc = Buffer.concat([cipher.update(input), cipher.final()]);
    const tag = cipher.getAuthTag();
    const payload = Buffer.concat([iv, tag, enc]).toString("base64");
    return { payload } as any;
  } catch {
    return obj as any;
  }
}

async function syncOne(shop: { id: string; name: string; account: { id: string; clientId: string; refreshToken: string } | null }): Promise<SyncResult> {
  if (!shop.account?.clientId || !shop.account?.refreshToken) {
    return { shopName: shop.name, action: "skipped-no-credentials" };
  }

  const apiBase = resolveApiBase();
  const tokenUrl = resolveTokenUrl(apiBase);

  const credentials = {
    platform: "JUMIA",
    shopLabel: shop.name,
    apiBase,
    tokenUrl,
    clientId: shop.account.clientId,
    refreshToken: shop.account.refreshToken,
    authType: "SELF_AUTHORIZATION",
  };

  const payload = maybeEncrypt(credentials);
  const existing = await prisma.shop.findFirst({ where: { name: shop.name } });
  const data: Prisma.ShopCreateInput = {
    name: shop.name,
    platform: Platform.JUMIA,
    isActive: true,
    credentialsEncrypted: payload,
  };

  if (existing) {
    await prisma.shop.update({ where: { id: existing.id }, data });
    return { shopName: shop.name, action: "updated", shopId: existing.id };
  }

  const created = await prisma.shop.create({ data });
  return { shopName: shop.name, action: "created", shopId: created.id };
}

async function main() {
  const jumiaShops = await prisma.jumiaShop.findMany({
    orderBy: { createdAt: "asc" },
    include: { account: true },
  });

  if (!jumiaShops.length) {
    console.log("No legacy JumiaShop records found.");
    return;
  }

  const results: SyncResult[] = [];
  for (const shop of jumiaShops) {
    try {
      const res = await syncOne(shop);
      results.push(res);
      console.log(`${res.action.toUpperCase()}: ${shop.name}${res.shopId ? ` (${res.shopId})` : ""}`);
    } catch (error) {
      console.error(`ERROR syncing ${shop.name}:`, error instanceof Error ? error.message : String(error));
    }
  }

  const summary = results.reduce<Record<string, number>>((acc, item) => {
    acc[item.action] = (acc[item.action] || 0) + 1;
    return acc;
  }, {});
  console.log("\nSync summary:", summary);
}

main()
  .then(() => prisma.$disconnect())
  .catch((error) => {
    console.error(error);
    return prisma.$disconnect().then(() => process.exit(1));
  });
