try { require('dotenv').config(); } catch {}
const { Pool } = require('pg');
const prisma = require('../.worker-dist/src/lib/prisma').prisma;
const { randomUUID } = require('crypto');

async function main(){
  const accounts = await prisma.marketplaceAccount.findMany({ where: { jumiaShopSid: { not: null } }, select: { id: true, displayName: true, jumiaShopSid: true } });
  const shops = await prisma.shop.findMany({ select: { id: true, name: true, jumiaShopSid: true } });
  const shopsByJumia = new Map(shops.filter(s => s.jumiaShopSid).map(s => [s.jumiaShopSid, s]));
  const toCreate = accounts.filter(a => !shopsByJumia.has(a.jumiaShopSid));
  if (!toCreate.length){
    console.log('Nothing to create.');
    process.exit(0);
  }
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('DATABASE_URL not set in env');
    process.exit(2);
  }
  const pool = new Pool({ connectionString: dbUrl });
  try {
    for (const acc of toCreate){
      const id = randomUUID();
      const name = acc.displayName || ('Jumia ' + acc.jumiaShopSid.slice(0,8));
      const sid = acc.jumiaShopSid;
      const sql = 'INSERT INTO "Shop" (id, name, "jumiaShopSid", platform, "createdAt", "updatedAt") VALUES ($1,$2,$3,$4,now(),now())';
      try {
        await pool.query(sql, [id, name, sid, 'JUMIA']);
        console.log(`Inserted Shop.id=${id} name="${name}" sid=${sid}`);
      } catch (err){
        console.error('Insert failed for', acc.id, acc.jumiaShopSid, err.message);
      }
    }
  } finally {
    await pool.end();
    await prisma.$disconnect();
  }
}

main().catch(e=>{ console.error(e); process.exit(1); });
