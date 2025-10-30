import { PrismaClient } from "@prisma/client";
import { decryptJson } from "../src/lib/crypto/secure-json";

const prisma = new PrismaClient();

async function mintAccessToken(tokenUrl: string, clientId: string, refreshToken: string) {
  const body = new URLSearchParams({ client_id: clientId, grant_type: "refresh_token", refresh_token: refreshToken });
  const r = await fetch(tokenUrl, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  if (!r.ok) throw new Error(`token exchange failed: ${r.status} ${await r.text().catch(()=>"")}`);
  const j = (await r.json()) as { access_token: string };
  if (!j.access_token) throw new Error("no access_token in response");
  return j.access_token;
}

async function pingJumiaShop(name: string) {
  const shop = await prisma.shop.findFirst({ where: { name }, select: { id: true, name: true, credentialsEncrypted: true } });
  if (!shop) throw new Error(`shop not found: ${name}`);
  const creds = decryptJson(shop.credentialsEncrypted as any) as any;
  const apiBase = (creds?.apiBase as string) || (creds?.base_url as string) || "https://vendor-api.jumia.com";
  const tokenUrl = (creds?.tokenUrl as string) || "https://vendor-api.jumia.com/token";
  const clientId = String(creds?.clientId || "");
  const refreshToken = String(creds?.refreshToken || "");
  if (!clientId || !refreshToken) throw new Error("missing clientId/refreshToken");
  const accessToken = await mintAccessToken(tokenUrl, clientId, refreshToken);
  const today = new Date();
  const from = new Date(today.getTime() - 24*3600*1000).toISOString().slice(0,10);
  const to = today.toISOString().slice(0,10);
  const url = `${apiBase.replace(/\/+$/,'')}/orders?createdAfter=${from}&createdBefore=${to}&size=1`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" });
  const text = await r.text().catch(()=>"");
  const ct = r.headers.get("content-type") || "";
  let parsed: any = null;
  if (ct.includes("json")) { try { parsed = JSON.parse(text); } catch {} }
  const count = Array.isArray(parsed?.orders) ? parsed.orders.length : Array.isArray(parsed?.items) ? parsed.items.length : Array.isArray(parsed?.data) ? parsed.data.length : 0;
  return { id: shop.id, name: shop.name, httpStatus: r.status, count, sampleId: count>0 ? (parsed.orders?.[0]?.id || parsed.items?.[0]?.id || parsed.data?.[0]?.id) : null };
}

async function main() {
  // Accept names as CLI args: node ping-jumia.ts "Shop A" "Shop B" ...
  const argv = process.argv.slice(2).filter(Boolean);
  const targets = argv.length ? argv : [
    "Betech store",
    "LabTech Kenya",
    "Hitech Power",
    "Sky Store Ke",
    "Maxton Enterprise",
    "JUDE COLLECTIONS",
    "Betech Solar Solution",
  ];
  const out: any[] = [];
  for (const t of targets) {
    try { out.push(await pingJumiaShop(t)); } catch (e) { out.push({ name: t, error: String(e instanceof Error ? e.message : e) }); }
  }
  console.log(JSON.stringify({ ok: true, results: out }, null, 2));
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); prisma.$disconnect().finally(()=>process.exit(1)); });
