const { Client } = require('pg');

(async function(){
  const conn = process.env.DATABASE_URL;
  if(!conn){
    console.error('DATABASE_URL not set');
    process.exit(2);
  }

  const client = new Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });
  try{
    await client.connect();

    console.log('\n-- Column types for affected columns --');
    const q1 = `SELECT table_name, column_name, data_type, udt_name FROM information_schema.columns WHERE (table_name = 'User' AND column_name = 'attendantCategory') OR (table_name = 'AttendantActivity' AND column_name = 'category') OR (table_name = 'AttendantCategoryAssignment' AND column_name = 'category') ORDER BY table_name;`;
    const r1 = await client.query(q1);
    console.table(r1.rows);

    console.log('\n-- Enum labels for AttendantCategory types --');
    const q2 = `SELECT t.typname AS type_name, e.enumlabel FROM pg_type t LEFT JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname IN ('attendantcategory','attendantcategory_new','attendantcategory_new_old','AttendantCategory','AttendantCategory_new') ORDER BY t.typname;`;
    const r2 = await client.query(q2);
    console.table(r2.rows);

    console.log('\n-- Sample values from User.attendantCategory (limit 50) --');
    const q3 = `SELECT attendantCategory, COUNT(*) FROM "User" GROUP BY attendantCategory ORDER BY COUNT(*) DESC LIMIT 50;`;
    const r3 = await client.query(q3);
    console.table(r3.rows);

    await client.end();
  }catch(err){
    console.error('ERROR', err);
    try{ await client.end(); }catch(e){}
    process.exit(1);
  }
})();