import { PrismaClient } from "@prisma/client";
import { decryptJson } from "../src/lib/crypto/secure-json.ts";

const prisma = new PrismaClient();

async function kmFetch(apiBase: string, appId: string, appSecret: string, path: string, payload: unknown) {
  // This mirrors src/lib/connectors/kilimall.ts signing
  const ts = Date.now();
  const body = JSON.stringify(payload ?? {});
  const s = await (await import("crypto")).createHash("md5").update(appSecret + body + String(ts)).digest("hex");
  const r = await fetch(`${apiBase}${path}`, { method: "POST", headers: { "Content-Type": "application/json", "X-App-Id": appId, "X-Timestamp": String(ts), "X-Sign": s }, body });
  if (!r.ok) throw new Error(`Kilimall ${path} ${r.status} ${await r.text().catch(()=>"")}`);
  return r.json();
}

async function pingKilimallShop(name: string) {
  const shop = await prisma.shop.findFirst({ where: { name }, select: { id: true, name: true, credentialsEncrypted: true } });
  if (!shop) throw new Error(`shop not found: ${name}`);
  const creds = decryptJson(shop.credentialsEncrypted as any) as any;
  const appId = String(creds?.storeId || creds?.appId || "");
  const appSecret = String(creds?.appSecret || creds?.app_secret || "");
  const apiBase = (creds?.apiBase as string) || "https://openapi.kilimall.co.ke";
  if (!appId || !appSecret) throw new Error(`missing appId/appSecret for ${name}`);
  // NOTE: Path '/orders/list' is our current placeholder; if you have the official endpoint, share it and I'll update.
  const res = await kmFetch(apiBase, appId, appSecret, "/orders/list", { since: undefined }).catch((e: unknown) => { throw new Error(String(e instanceof Error ? e.message : e)); });
  const arr = Array.isArray((res as any)?.data) ? (res as any).data : Array.isArray((res as any)?.orders) ? (res as any).orders : [];
  return { id: shop.id, name: shop.name, httpStatus: 200, count: arr.length, sampleId: arr[0]?.id ?? null };
}

async function main() {
  const argv = process.argv.slice(2).filter(Boolean);
  const targets = argv.length ? argv : [
    "Jm Collection Kilimall",
    "Hitech Power Kilimall",
    "Hitech Access Kilimall",
    "Betech Solar Solutions Kilimall",
    "Betech Kilimall",
  ];
  const out: any[] = [];
  for (const t of targets) {
    try { out.push(await pingKilimallShop(t)); } catch (e) { out.push({ name: t, error: String(e instanceof Error ? e.message : e) }); }
  }
  console.log(JSON.stringify({ ok: true, results: out }, null, 2));
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); prisma.$disconnect().finally(()=>process.exit(1)); });
