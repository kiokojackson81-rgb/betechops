require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main(){
  const canonicalStart = new Date('2026-01-04T00:00:00Z');
  const rows = await prisma.weeklySale.findMany({ where: { weekStart: canonicalStart }, orderBy: { shopId: 'asc' } });
  console.log('WeeklySale rows for canonical week:', rows.length);
  const map = new Map();
  for (const r of rows) {
    const key = `${r.shopId}::${r.weekStart.toISOString()}::${r.weekEnd.toISOString()}`;
    const arr = map.get(key) || [];
    arr.push(r);
    map.set(key, arr);
  }

  let merged = 0, deleted = 0;
  for (const [key, arr] of map.entries()){
    if (arr.length <= 1) continue;
    // keep earliest createdAt as canonical
    arr.sort((a,b)=> new Date(a.createdAt) - new Date(b.createdAt));
    const keeper = arr[0];
    const sum = arr.reduce((s,x)=> s + Number(x.amount || 0),0);
    if (Number(keeper.amount) !== sum){
      await prisma.weeklySale.update({ where: { id: keeper.id }, data: { amount: sum } });
      merged++;
      console.log('Merged into', keeper.id, 'newAmount', sum);
    }
    const toDelete = arr.slice(1).map(x=>x.id);
    for (const id of toDelete){
      await prisma.weeklySale.delete({ where: { id } });
      deleted++;
      console.log('Deleted duplicate', id);
    }
  }

  console.log('Done dedupe:', { merged, deleted });
  await prisma.$disconnect();
}

main().catch(async(e)=>{ console.error(e); try{ await prisma.$disconnect(); }catch(_){}; process.exit(1); });
