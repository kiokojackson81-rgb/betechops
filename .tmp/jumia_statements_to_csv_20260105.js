const fs = require('fs');
const inPath = '.tmp/jumia_statements_2026-01-05_2026-01-11.json';
const outPath = '.tmp/jumia_statements_2026-01-05_2026-01-11.csv';
const j = JSON.parse(fs.readFileSync(inPath,'utf8'));
const rows = j.statements || [];
const header = ['accountId','accountName','statementNumber','shopSid','amount','currency','weekStart','vendorCreatedAt'];
const lines = [header.join(',')];
for(const r of rows){
  const currency = (r.raw && r.raw.payout && r.raw.payout.currency) || '';
  const createdAt = (r.raw && r.raw.createdAt) || '';
  const vals = [r.accountId, r.accountName, r.statementNumber, r.shopSid, r.amount, currency, r.weekStart, createdAt];
  const esc = vals.map(v => typeof v === 'string' && v.includes(',') ? `"${v.replace(/"/g,'""')}"` : v);
  lines.push(esc.join(','));
}
fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
console.log('Wrote', outPath, 'rows=', rows.length);