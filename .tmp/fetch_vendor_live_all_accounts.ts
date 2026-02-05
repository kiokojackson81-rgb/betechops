import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import { requestWithRetry } from '../src/lib/fetchWithRetry.ts';

async function refreshJumiaToken(credentials: any, apiBase: string): Promise<string> {
  const url = new URL('/token', apiBase).toString();
  const params = new URLSearchParams({ client_id: credentials.clientId, grant_type: 'refresh_token', refresh_token: credentials.refreshToken });
  if (credentials.clientSecret) params.set('client_secret', credentials.clientSecret);
  const res = await requestWithRetry(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params.toString() });
  if (!res.ok) throw new Error(`Failed to refresh Jumia token (${res.status})`);
  const data = await res.json();
  return data.access_token;
}

async function fetchStatements(apiBase: string, authHeader: string, startDate: string) {
  const url = new URL('/payout-statement', apiBase);
  url.searchParams.set('createdAfter', startDate);
  url.searchParams.set('currency', 'LOCAL');
  url.searchParams.set('paid', 'true');
  url.searchParams.set('size', '1000');
  const res = await requestWithRetry(url.toString(), { headers: { Authorization: authHeader } });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Failed to fetch payout statements (${res.status}) ${txt}`);
  }
  const data = await res.json();
  return data.statements ?? [];
}

async function main() {
  const startArg = process.argv[2] ?? '2025-12-21';
  const start = new Date(startArg);
  if (isNaN(start.getTime())) { console.error('invalid date'); process.exit(2); }
  const startDate = start.toISOString().split('T')[0];

  const prisma = new PrismaClient();
  const creds = await prisma.apiCredential.findMany({ where: { refreshToken: { not: null } }, orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }], take: 200 });
  const candidates = creds.filter((c) => !!c.apiBase && c.apiBase.includes('jumia'));
  if (candidates.length === 0) {
    console.error('No Jumia-like ApiCredential rows found');
    process.exit(3);
  }

  const results: any[] = [];
  for (const c of candidates) {
    try {
      const cred = { clientId: c.clientId, clientSecret: c.apiSecret, refreshToken: c.refreshToken, baseUrl: c.apiBase, authScheme: c.issuer };
      const apiBase = (c.apiBase || 'https://vendor-api.jumia.com').trim();
      const token = await refreshJumiaToken(cred, apiBase);
      const authHeader = `${(c.issuer || 'Bearer').trim()} ${token}`;
      const statements = await fetchStatements(apiBase, authHeader, startDate);
      results.push({ credentialId: c.id, scope: c.scope, apiBase, count: statements.length, statements });
      console.log(`credential=${c.id} scope=${c.scope} statements=${statements.length}`);
    } catch (e: any) {
      console.error(`credential=${c.id} failed: ${e.message}`);
      results.push({ credentialId: c.id, scope: c.scope, apiBase: c.apiBase, error: String(e) });
    }
  }

  fs.mkdirSync('.tmp', { recursive: true });
  const outPath = `.tmp/vendor_live_audit_all_${startArg}.json`;
  fs.writeFileSync(outPath, JSON.stringify({ generatedAt: new Date().toISOString(), startDate, results }, null, 2));
  console.log(`Wrote ${outPath} — credentials tried: ${candidates.length}`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error('fetch failed', e); process.exit(1); });
