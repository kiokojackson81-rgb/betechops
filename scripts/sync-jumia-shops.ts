import "dotenv/config";
import crypto from "crypto";
import { PrismaClient, Platform, Prisma } from "@prisma/client";
import { existsSync, readFileSync } from "fs";
import path from "path";

const prisma = new PrismaClient();

type SyncResult = { shopName: string; action: "created" | "updated" | "skipped-no-credentials"; shopId?: string };

const FALLBACK_FILENAMES = [
  "shops.secrets.json",
  "shops.local.json",
  "shops.json",
  "shops.example.json",
];

type SeedLike = { name?: string; shopLabel?: string };

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

function resolveSeedFile(fileArg?: string): string | null {
  const candidates = fileArg ? [fileArg, ...FALLBACK_FILENAMES] : FALLBACK_FILENAMES;
  return candidates.map((candidate) => path.resolve(process.cwd(), candidate)).find((p) => existsSync(p)) ?? null;
}

function loadSeeds(fileArg?: string): SeedLike[] {
  const file = resolveSeedFile(fileArg);
  if (!file) {
    throw new Error(
      `No shop seed file found. Provide a path argument or create one of: ${FALLBACK_FILENAMES.join(", ")}`
    );
  }
  const text = readFileSync(file, "utf-8");
  const json = JSON.parse(text);
  if (Array.isArray(json)) return json as SeedLike[];
  if (Array.isArray(json.shops)) return json.shops as SeedLike[];
  return [json as SeedLike];
}

function loadAllowedNames(fileArg?: string): string[] {
  const seeds = loadSeeds(fileArg);
  const names = new Set<string>();
  for (const seed of seeds) {
    if (typeof seed.name === "string" && seed.name.trim()) names.add(seed.name.trim());
    if (typeof seed.shopLabel === "string" && seed.shopLabel.trim()) names.add(seed.shopLabel.trim());
  }
  if (!names.size) {
    throw new Error("No shop names discovered in seed file; cannot prune.");
  }
  return Array.from(names);
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
  const args = process.argv.slice(2);
  const prune = args.includes("--prune");
  const fileArg = args.find((arg) => !arg.startsWith("--"));

  let allowedLower: Set<string> | null = null;
  if (prune) {
    const allowedNames = loadAllowedNames(fileArg);
    allowedLower = new Set(allowedNames.map((name) => name.toLowerCase()));
    const existingShops = await prisma.shop.findMany({
      where: { platform: Platform.JUMIA },
      select: { id: true, name: true },
    });
    const toDelete = existingShops.filter((shop) => !allowedLower!.has(shop.name.toLowerCase()));
    if (toDelete.length) {
      console.log(`Removing ${toDelete.length} non-production shops from Shop table...`);
      await prisma.shop.deleteMany({ where: { id: { in: toDelete.map((s) => s.id) } } });
    } else {
      console.log("No extra JUMIA shops found in Shop table.");
    }
  }

  let jumiaShops = await prisma.jumiaShop.findMany({
    orderBy: { createdAt: "asc" },
    include: { account: true },
  });

  if (allowedLower) {
    const extraJumia = jumiaShops.filter((shop) => !allowedLower!.has(shop.name.toLowerCase()));
    if (extraJumia.length) {
      console.log(`Attempting to delete ${extraJumia.length} legacy JumiaShop rows...`);
      for (const legacy of extraJumia) {
        try {
          await prisma.jumiaShop.delete({ where: { id: legacy.id } });
          console.log(`DELETED legacy JumiaShop ${legacy.name}`);
        } catch (error) {
          console.warn(
            `Could not delete legacy JumiaShop ${legacy.name} (likely referenced by orders):`,
            error instanceof Error ? error.message : String(error)
          );
        }
      }
    }
    const before = jumiaShops.length;
    jumiaShops = jumiaShops.filter((shop) => allowedLower!.has(shop.name.toLowerCase()));
    const skipped = before - jumiaShops.length;
    if (skipped > 0) {
      console.log(`Skipping ${skipped} legacy JumiaShop records not in allow list.`);
    }
  }

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
