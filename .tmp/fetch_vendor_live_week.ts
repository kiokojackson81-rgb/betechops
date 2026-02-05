import fs from 'fs';
import { requestWithRetry } from '../src/lib/fetchWithRetry.ts';
import { PrismaClient } from '@prisma/client';

async function refreshJumiaToken(credentials: any, apiBase: string): Promise<string> {
  const url = new URL('/token', apiBase).toString();
  const params = new URLSearchParams({ client_id: credentials.clientId, grant_type: 'refresh_token', refresh_token: credentials.refreshToken });
  if (credentials.clientSecret) params.set('client_secret', credentials.clientSecret);
  const res = await requestWithRetry(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params.toString() });
  if (!res.ok) throw new Error(`Failed to refresh Jumia token (${res.status})`);
  const data = (await res.json()) as { access_token: string; refresh_token?: string };
  return data.access_token;
}

async function fetchStatements(apiBase: string, authHeader: string, createdAfter: Date) {
  const url = new URL('/payout-statement', apiBase);
  url.searchParams.set('createdAfter', createdAfter.toISOString().split('T')[0]);
  url.searchParams.set('currency', 'LOCAL');
  url.searchParams.set('paid', 'true');
  url.searchParams.set('size', '1000');
  const res = await requestWithRetry(url.toString(), { headers: { Authorization: authHeader } });
  if (!res.ok) throw new Error(`Failed to fetch payout statements (${res.status})`);
  const data = (await res.json()) as { statements?: any[] };
  return data.statements ?? [];
}

async function main() {
  const startArg = process.argv[2] ?? '2025-12-21';
  const start = new Date(startArg);
  if (isNaN(start.getTime())) { console.error('invalid date'); process.exit(2); }

  // Prefer explicit env vars, otherwise read latest ApiCredential from DB
  const envClientId = process.env.JUMIA_CLIENT_ID?.trim();
  const envRefreshToken = process.env.JUMIA_REFRESH_TOKEN?.trim();
  const prisma = new PrismaClient();
  let creds: any = {};
  if (envClientId && envRefreshToken) {
    creds = {
      clientId: envClientId,
      clientSecret: process.env.JUMIA_CLIENT_SECRET?.trim() ?? null,
      refreshToken: envRefreshToken,
      baseUrl: process.env.JUMIA_VENDOR_API_BASE?.trim() ?? 'https://vendor-api.jumia.com',
      authScheme: process.env.JUMIA_AUTH_SCHEME?.trim() ?? 'Bearer',
    };
  } else {
    const credential = await prisma.apiCredential.findFirst({
      where: { scope: 'JUMIA_VENDOR' },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    }) ?? await prisma.apiCredential.findFirst({ where: { scope: 'GLOBAL' }, orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }] });
    if (!credential || !credential.clientId || !credential.refreshToken) {
      throw new Error('No Jumia credentials found in env or db');
    }
    creds = {
      clientId: credential.clientId,
      clientSecret: credential.apiSecret,
      refreshToken: credential.refreshToken,
      baseUrl: credential.apiBase ?? 'https://vendor-api.jumia.com',
      authScheme: credential.issuer ?? 'Bearer',
    };
  }

  const apiBase = creds.baseUrl?.trim() || 'https://vendor-api.jumia.com';
  const token = await refreshJumiaToken(creds, apiBase);
  const authHeader = `${creds.authScheme?.trim() || 'Bearer'} ${token}`;

  const statements = await fetchStatements(apiBase, authHeader, start);

  // Save raw statements for audit and filter to canonical week by period.startDate
  fs.mkdirSync('.tmp', { recursive: true });
  const outPath = `.tmp/vendor_live_audit_${startArg}.json`;
  fs.writeFileSync(outPath, JSON.stringify({ generatedAt: new Date().toISOString(), apiBase, statements }, null, 2));
  console.log(`Wrote ${outPath} — statements: ${statements.length}`);
  for (const s of statements) console.log(`- stmt=${s.statementNumber} amount=${s.payout?.amount ?? 0} period=${s.period?.startDate}`);

}

main().catch((e) => { console.error('fetch failed', e); process.exit(1); });
