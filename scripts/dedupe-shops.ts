import { PrismaClient } from "@prisma/client";
import { existsSync, readFileSync } from "fs";
import path from "path";

const prisma = new PrismaClient();

type SeedLike = { name?: string; shopLabel?: string };

function loadAllowedNames(fileArg?: string): string[] {
  const candidates = fileArg
    ? [fileArg, "shops.secrets.json", "shops.local.json", "shops.json", "shops.example.json"]
    : ["shops.secrets.json", "shops.local.json", "shops.json", "shops.example.json"];
  const file = candidates.map((f) => path.resolve(process.cwd(), f)).find((p) => existsSync(p));
  if (!file) return [];
  const text = readFileSync(file, "utf-8");
  const json = JSON.parse(text);
  const seeds: SeedLike[] = Array.isArray(json) ? json : Array.isArray(json.shops) ? json.shops : [];
  const names = new Set<string>();
  for (const seed of seeds) {
    if (typeof seed.name === "string" && seed.name.trim()) names.add(seed.name.trim());
    if (typeof seed.shopLabel === "string" && seed.shopLabel.trim()) names.add(seed.shopLabel.trim());
  }
  return Array.from(names);
}

async function countSafe<T>(fn: () => Promise<number>): Promise<number> {
  try {
    return await fn();
  } catch (e: any) {
    // If the table doesn't exist in this environment, treat as zero
    if (e && e.code === "P2021") return 0;
    return 0;
  }
}

async function hasReferences(shopId: string): Promise<boolean> {
  const checks = await Promise.all([
    countSafe(() => prisma.order.count({ where: { shopId } })),
    countSafe(() => prisma.settlementRow.count({ where: { shopId } })),
    countSafe(() => prisma.userShop.count({ where: { shopId } })),
    countSafe(() => prisma.shopAssignment.count({ where: { shopId } })),
    countSafe(() => prisma.apiCredential.count({ where: { shopId } })),
    countSafe(() => prisma.shopApiConfig.count({ where: { shopId } })),
    countSafe(() => prisma.reconciliation.count({ where: { shopId } })),
    countSafe(() => prisma.discrepancy.count({ where: { shopId } })),
    countSafe(() => prisma.fulfillmentAudit.count({ where: { shopId } })),
    countSafe(() => prisma.costCatalog.count({ where: { shopId } })),
    countSafe(() => prisma.attendantCommission.count({ where: { shopId } })),
    countSafe(() => prisma.commissionRule.count({ where: { shopId } })),
    countSafe(() => prisma.returnCase.count({ where: { shopId } })),
    countSafe(() => prisma.catalogCounters.count({ where: { shopId } })),
  ]);
  return checks.some((n) => n > 0);
}

async function main() {
  const fileArg = process.argv[2];
  const canonicalNames = loadAllowedNames(fileArg);
  const canonicalSet = new Set(canonicalNames);

  const shops = await prisma.shop.findMany({ orderBy: { createdAt: "asc" } });
  const groups = new Map<string, typeof shops>();
  for (const s of shops) {
    const k = s.name.toLowerCase();
    const arr = (groups.get(k) || []) as typeof shops;
    arr.push(s);
    groups.set(k, arr);
  }

  let deleted = 0;
  for (const [k, arr] of groups) {
    if (arr.length <= 1) continue;
    // choose keep: prefer exact match with canonical seed name casing
    let keep = arr.find((s) => canonicalSet.has(s.name)) || arr[0];
    const duplicates = arr.filter((s) => s.id !== keep.id);
    for (const dup of duplicates) {
      const ref = await hasReferences(dup.id);
      if (ref) {
        console.warn(`SKIP: ${dup.name} (${dup.id}) has references — not deleting.`);
        continue;
      }
      await prisma.shop.delete({ where: { id: dup.id } });
      console.log(`DELETED duplicate: ${dup.name} (${dup.id}) -> kept: ${keep.name} (${keep.id})`);
      deleted += 1;
    }
  }
  console.log(`\nDedup complete. Deleted ${deleted} duplicate shop(s).`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    return prisma.$disconnect().then(() => process.exit(1));
  });
