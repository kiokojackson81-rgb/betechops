const { Client } = require('pg');
(async ()=>{
  const url = process.env.DATABASE_URL;
  if(!url){ console.error('DATABASE_URL not set'); process.exit(2);} 
  const c = new Client({ connectionString: url });
  try{
    await c.connect();
    const migrations = await c.query('SELECT migration_name, checksum, started_at, finished_at, rolled_back_at, logs FROM "_prisma_migrations" ORDER BY started_at');
    console.log('MIGRATIONS:\n', JSON.stringify(migrations.rows, null, 2));

    const cols = await c.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='User' ORDER BY ordinal_position");
    console.log('\nUSER_COLUMNS:\n', JSON.stringify(cols.rows, null, 2));

    const enums = await c.query("SELECT t.typname as enum_name, e.enumlabel as enum_value FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public' ORDER BY t.typname, e.enumsortorder");
    console.log('\nENUMS:\n', JSON.stringify(enums.rows, null, 2));

  }catch(e){ console.error(e); process.exit(1);} finally{ await c.end(); }
})();