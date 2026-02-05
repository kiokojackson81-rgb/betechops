const fetch = require('node-fetch');
const fs = require('fs');
const mapping = [
  { name: 'Betech Solar Solution', clientId: 'b2a290cc-74fd-4b9e-a598-ef42fc57f918', envVar: 'JUMIA_RT_BETECH_SOLAR' },
  { name: 'Hitech Power', clientId: '8c0e5ed0-8eb7-49c6-982c-1acdfef94d37', envVar: 'JUMIA_RT_HITECH_POWER' },
  { name: 'Jude Collection', clientId: '70a7341a-1927-45a5-aec8-d0c5a4ac7b45', envVar: 'JUMIA_RT_JUDE' },
  { name: 'LabTech Kenya', clientId: '3579f345-a3ac-4e9d-b355-1990f0ad8a54', envVar: 'JUMIA_RT_LABTECH' },
  { name: 'Maxton Enterprise', clientId: '61e52422-f98e-49da-87e2-f9c832bf1a04', envVar: 'JUMIA_RT_MAXTON' },
  { name: 'Sky Store Ke', clientId: 'cd95a840-f194-4f49-88fd-848f2c59456f', envVar: 'JUMIA_RT_SKYSTORE' },
  { name: 'JM Latest Collections', clientId: 'f7df0953-7c18-4191-b304-614f9f0987a4', envVar: 'JUMIA_RT_JM_LATEST' },
  { name: 'Betech Store', clientId: 'e20e8623-e422-4566-a08a-37751f4bc759', envVar: 'JUMIA_RT_BETECH_STORE' },
];

const apiBase = process.env.JUMIA_API_BASE || 'https://vendor-api.jumia.com';
const since = process.env.JUMIA_DISCOVER_SINCE ? new Date(process.env.JUMIA_DISCOVER_SINCE) : new Date('2025-12-01');

async function refreshToken(clientId, refreshToken){
  const res = await fetch(new URL('/token', apiBase).toString(), { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: clientId, grant_type: 'refresh_token', refresh_token: refreshToken }) });
  if (!res.ok) throw new Error('token refresh failed ' + res.status);
  return res.json();
}

async function fetchStatements(authHeader){
  const url = new URL('/payout-statement', apiBase);
  url.searchParams.set('createdAfter', since.toISOString().slice(0,10));
  url.searchParams.set('currency', 'LOCAL');
  url.searchParams.set('size', '10');
  const res = await fetch(url.toString(), { headers: { Authorization: authHeader } });
  if (!res.ok) throw new Error('statements fetch failed ' + res.status);
  const data = await res.json();
  return data.statements ?? [];
}

(async ()=>{
  const out = [];
  for(const m of mapping){
    const rt = process.env[m.envVar];
    if(!rt){ out.push({ name: m.name, clientId: m.clientId, ok:false, error:'missing_env_var', envVar: m.envVar }); continue; }
    try{
      const tokenData = await refreshToken(m.clientId, rt);
      const token = tokenData.access_token;
      const authHeader = `Bearer ${token}`;
      const statements = await fetchStatements(authHeader);
      const shopSids = new Set();
      for(const s of statements){ if(s.shopSid) shopSids.add(s.shopSid); }
      out.push({ name: m.name, clientId: m.clientId, ok:true, discoveredShopSids: Array.from(shopSids), statementCount: statements.length, shopNameFromStatement: (statements[0] && (statements[0].shopName || statements[0].sellerName)) || null });
    }catch(e){ out.push({ name: m.name, clientId: m.clientId, ok:false, error: e.message }); }
  }
  fs.writeFileSync('.tmp/jumia_discovery_report.json', JSON.stringify({ generatedAt: new Date().toISOString(), rows: out }, null, 2));
  console.log('Discovery written to .tmp/jumia_discovery_report.json');
})();
