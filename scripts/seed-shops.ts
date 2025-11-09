import { PrismaClient, Platform, Prisma } from "@prisma/client";
import { readFileSync, existsSync } from "fs";
import path from "path";
import crypto from "crypto";

const prisma = new PrismaClient();

type ShopSeed = {
  name: string;
  platform?: "JUMIA" | "KILIMALL";
  credentials: Record<string, unknown>; // expects tokenUrl, clientId, refreshToken, and optionally apiBase/base_url
  active?: boolean;
};

// Minimal inline encrypt helper mirroring src/lib/crypto/secure-json
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
    return obj as any; // fallback to plaintext in dev
  }
}

const FALLBACK_FILENAMES = [
  "shops.json",
  "shops.secrets.json",
  "shops.local.json",
  "shops.example.json",
];

function loadSeeds(fileArg?: string): ShopSeed[] {
  const candidates = fileArg ? [fileArg, ...FALLBACK_FILENAMES] : FALLBACK_FILENAMES;
  const file = candidates
    .map((candidate) => path.resolve(process.cwd(), candidate))
    .find((p) => existsSync(p));
  if (!file) {
    throw new Error(
      `No shop seed file found. Provide a path argument or create one of: ${FALLBACK_FILENAMES.join(", ")}`
    );
  }
  console.log(`Using shop seed file: ${file}`);
  const text = readFileSync(file, "utf-8");
  const json = JSON.parse(text);
  if (Array.isArray(json)) return json as ShopSeed[];
  if (Array.isArray(json.shops)) return json.shops as ShopSeed[];
  throw new Error(`Invalid seed file format at ${file}: expected array or { shops: [] }`);
}

async function upsertShop(seed: ShopSeed) {
  const name = seed.name.trim();
  const platformKey = (seed.platform || "JUMIA") as keyof typeof Platform;
  const platform = Platform[platformKey] ?? Platform.JUMIA;
  const active = seed.active ?? true;

  const creds = seed.credentials || {};
  if (!creds || typeof creds !== "object") throw new Error(`Missing credentials for shop ${name}`);
  // Validate by platform
  if (platform === Platform.JUMIA) {
    if (!("tokenUrl" in creds) || !("clientId" in creds) || !("refreshToken" in creds)) {
      throw new Error(`credentials.tokenUrl, credentials.clientId, and credentials.refreshToken are required for shop ${name}`);
    }
  } else if (platform === Platform.KILIMALL) {
    if (!("appId" in creds) || !("appSecret" in creds)) {
      throw new Error(`credentials.appId and credentials.appSecret are required for Kilimall shop ${name}`);
    }
    // Ensure apiBase default for Kilimall if missing
    if (!("apiBase" in creds)) {
      (creds as any).apiBase = "https://openapi.kilimall.co.ke";
    }
  }

  const credentialsEncrypted: Prisma.InputJsonValue = maybeEncrypt(creds);

  const existing = await prisma.shop.findFirst({ where: { name } });
  const data: Prisma.ShopCreateInput = { name, platform, isActive: active, credentialsEncrypted };

  if (existing) {
    await prisma.shop.update({ where: { id: existing.id }, data });
    return { action: "updated", id: existing.id } as const;
  }
  const created = await prisma.shop.create({ data });
  return { action: "created", id: created.id } as const;
}

async function main() {
  const fileArg = process.argv[2];
  const seeds = loadSeeds(fileArg);
  const results: Array<{ name: string; action: string; id: string }> = [];
  for (const s of seeds) {
    const r = await upsertShop(s);
    results.push({ name: s.name, action: r.action, id: r.id });
    console.log(`${r.action.toUpperCase()}: ${s.name} (${r.id})`);
  }
  // summary
  console.log("\nSeed complete:", results);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    return prisma.$disconnect().then(() => process.exit(1));
  });
