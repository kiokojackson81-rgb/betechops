const { PrismaClient, Platform } = require('@prisma/client');
const puppeteer = require('puppeteer');
const prisma = new PrismaClient();

function toLocalIso(dt) {
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getJumiaWeeklyPeriodFor(date) {
  const d = new Date(date);
  d.setHours(0,0,0,0);
  const dayOfWeek = d.getDay();
  const diffToMonday = (dayOfWeek === 0 ? -6 : 1) - dayOfWeek;
  const start = new Date(d);
  start.setDate(d.getDate() + diffToMonday);
  start.setHours(0,0,0,0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23,59,59,999);
  const label = `${toLocalIso(start)} – ${toLocalIso(end)}`;
  const key = `${toLocalIso(start)}_${toLocalIso(end)}`;
  return { start, end, label, key };
}

function getTradingPeriodFor(date){
  const d = new Date(date);
  d.setHours(0,0,0,0);
  const year = d.getFullYear();
  const month = d.getMonth();
  const day = d.getDate();
  let startYear, startMonth, endYear, endMonth;
  if (day >= 25) {
    startYear = year; startMonth = month;
    const next = new Date(year, month+1, 1);
    endYear = next.getFullYear(); endMonth = next.getMonth();
  } else {
    const prev = new Date(year, month-1, 1);
    startYear = prev.getFullYear(); startMonth = prev.getMonth();
    endYear = year; endMonth = month;
  }
  const start = new Date(startYear, startMonth, 25,0,0,0,0);
  const end = new Date(endYear, endMonth, 24,23,59,59,999);
  const label = `${start.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})} – ${end.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}`;
  const key = `${toLocalIso(start)}_${toLocalIso(end)}`;
  return { start, end, label, key };
}

(async ()=>{
  try{
    const period = getTradingPeriodFor(new Date());
    const now = new Date();

    const [accountCount, activeAssignments, payoutAgg, ordersAgg, unpricedOrders, returnsOpen, returnsByStatusRaw] = await Promise.all([
      prisma.marketplaceAccount.count(),
      prisma.marketplaceAccountAssignment.count({ where: { OR: [{ endsAt: null }, { endsAt: { gt: now } }] } }),
      prisma.marketplacePayoutWeek.aggregate({ _sum: { grossSales: true, payoutAmount: true }, _count: { _all: true }, where: { weekEnd: { gte: period.start, lte: period.end } } }),
      prisma.marketplaceOrder.aggregate({ _count: { _all: true }, _sum: { sellingPrice: true }, where: { orderedAt: { gte: period.start, lte: period.end } } }),
      prisma.marketplaceOrder.count({ where: { buyingPrice: null } }),
      prisma.marketplaceReturn.count({ where: { status: 'WAITING_AT_HUB' } }),
      prisma.marketplaceReturn.groupBy({ by: ['status'], _count: { _all: true } }).catch(()=>[]),
    ]);

    // recent weeks for JUMIA cards (use last 8 weeks)
    const weeks = [];
    for (let i=0;i<8;i++){ const ref = new Date(); ref.setDate(ref.getDate() - i*7); weeks.push(getJumiaWeeklyPeriodFor(ref)); }

    // fetch payout rows for JUMIA and dedupe by statementNumber+weekStart
    const rawRows = await prisma.marketplacePayoutWeek.findMany({ where: { account: { platform: Platform.JUMIA } }, select: { weekStart: true, weekEnd: true, payoutAmount: true, grossSales: true, accountId: true, statementNumber: true }, orderBy: { weekEnd: 'desc' } });

    const weekMap = {};
    const seen = new Set();
    for (const r of rawRows){
      const wkStartIso = toLocalIso(new Date(r.weekStart ?? r.weekEnd ?? new Date()));
      const stmtKey = `${r.statementNumber ?? ''}::${wkStartIso}`;
      if (seen.has(stmtKey)) continue; seen.add(stmtKey);
      // find period
      const baseDate = new Date(r.weekStart ?? r.weekEnd ?? new Date());
      const p = getJumiaWeeklyPeriodFor(baseDate);
      const key = p.key;
      if (!weekMap[key]) weekMap[key] = { period: p, gross:0, payout:0, statementCount:0, accountSet: new Set() };
      weekMap[key].gross += Number(r.grossSales ?? 0);
      weekMap[key].payout += Number(r.payoutAmount ?? 0);
      weekMap[key].statementCount += 1;
      if (r.accountId) weekMap[key].accountSet.add(r.accountId);
    }

    const recentWeeksEnriched = Object.values(weekMap).map(w=>({ period: w.period, _sum: { grossSales: w.gross, payoutAmount: w.payout }, statementCount: w.statementCount, accountCount: w.accountSet.size, label: w.period.label })).sort((a,b)=>(a.period.start<b.period.start?1:-1)).slice(0,8);

    // build HTML
    const cardsHtml = recentWeeksEnriched.map(w=>{
      const gross = Number(w._sum.grossSales||0).toLocaleString('en-KE');
      const payout = Number(w._sum.payoutAmount||0).toLocaleString('en-KE');
      const accounts = w.accountCount;
      return `<div class="card"><div class="label">${w.label}</div><div class="meta">Accounts: ${accounts}</div><div class="gross">Gross: Ksh ${gross}</div><div class="payout">Payout: Ksh ${payout}</div></div>`;
    }).join('');

    const html = `
<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Admin Summary Snapshot</title>
<style>
body{background:#0f1724;color:#cbd5e1;font-family:Inter,system-ui,Arial;padding:24px}
.container{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
.card{background:#0b1220;border:1px solid rgba(255,255,255,0.06);padding:16px;border-radius:12px}
.label{color:#e6edf3;font-weight:600}
.meta{color:#9fb0c6;margin-top:8px}
.gross{color:#34d399;margin-top:8px}
.payout{color:#86efac}
.header{margin-bottom:16px}
</style>
</head>
<body>
<div class="header"><h2 style="color:#fff;margin:0">Payout weeks</h2><p style="margin:4px 0 0;color:#9fb0c6">Snapshot for ${getTradingPeriodFor(new Date()).label}</p></div>
<div class="container">${cardsHtml}</div>
</body>
</html>`;

    // render with puppeteer
    const browser = await puppeteer.launch({ args: ['--no-sandbox','--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.setViewport({ width: 1400, height: 640 });
    const out = '.tmp/admin_summary_snapshot.png';
    await page.screenshot({ path: out, fullPage: true });
    await browser.close();
    console.log('Screenshot saved to', out);
    await prisma.$disconnect();
  }catch(err){ console.error('failed', err); await prisma.$disconnect(); process.exit(1);} 
})();
