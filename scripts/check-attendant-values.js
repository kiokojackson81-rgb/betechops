const { Client } = require('pg');
(async ()=>{
  const url = process.env.DATABASE_URL;
  if(!url){ console.error('DATABASE_URL not set'); process.exit(2);} 
  const c = new Client({ connectionString: url });
  try{
    await c.connect();
    const u = await c.query('SELECT DISTINCT "attendantCategory"::text AS v FROM "User"');
    console.log('USER distinct:', JSON.stringify(u.rows,null,2));
    const a = await c.query('SELECT DISTINCT "category"::text AS v FROM "AttendantActivity"');
    console.log('ATTENDANTACT distinct:', JSON.stringify(a.rows,null,2));
    const ac = await c.query('SELECT DISTINCT "category"::text AS v FROM "AttendantCategoryAssignment"');
    console.log('ASSIGN distinct:', JSON.stringify(ac.rows,null,2));
  }catch(e){ console.error(e); process.exit(1);} finally{ await c.end(); }
})();