import 'dotenv/config';
import { readFileSync, existsSync } from 'fs';
import path from 'path';

/*
 * Bulk POST shops to /api/debug/seed-shops using SETUP_TOKEN.
 * Usage:
 *   npm run seed:shops:remote -- https://prod-host.example shops.secrets.json
 * If no file is provided falls back to shops.secrets.json or shops.json variants.
 * Requires env SETUP_TOKEN. Optionally SECURE_JSON_KEY at server side for encryption.
 */

function resolveSeedFile(arg?: string): string {
  const FALLBACK = [arg, 'shops.secrets.json', 'shops.local.json', 'shops.json', 'shops.example.json'].filter(Boolean) as string[];
  const found = FALLBACK.map(f => path.resolve(process.cwd(), f)).find(p => existsSync(p));
  if (!found) throw new Error('No seed file found');
  return found;
}

function loadShops(file: string) {
  const raw = readFileSync(file, 'utf8');
  const json = JSON.parse(raw);
  return Array.isArray(json) ? json : Array.isArray(json.shops) ? json.shops : (() => { throw new Error('Invalid shops file format'); })();
}

async function main() {
  const [baseUrlArg, fileArg] = process.argv.slice(2);
  if (!baseUrlArg || !/^https?:\/\//i.test(baseUrlArg)) {
    console.error('First arg must be the production base URL, e.g. https://betechops.app');
    process.exit(1);
  }
  const token = process.env.SETUP_TOKEN || process.env.SEED_TOKEN;
  if (!token) {
    console.error('SETUP_TOKEN env not set. Export it before running.');
    process.exit(1);
  }
  const file = resolveSeedFile(fileArg);
  const shops = loadShops(file).map((s: any) => ({
    name: s.name ?? s.shopLabel,
    clientId: s.credentials?.clientId,
    refreshToken: s.credentials?.refreshToken,
    apiBase: s.credentials?.apiBase || s.credentials?.base_url,
    tokenUrl: s.credentials?.tokenUrl,
    shopId: s.credentials?.vendorShopId || s.credentials?.shopId,
  }));

  const payload = JSON.stringify({ shops });
  const url = baseUrlArg.replace(/\/$/, '') + '/api/debug/seed-shops?token=' + encodeURIComponent(token);
  console.log(`Posting ${shops.length} shops to ${url}`);

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: payload,
  });
  const text = await res.text();
  let json: any;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!res.ok) {
    console.error('Failed:', res.status, res.statusText, json);
    process.exit(1);
  }
  console.log('Result:', JSON.stringify(json, null, 2));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
