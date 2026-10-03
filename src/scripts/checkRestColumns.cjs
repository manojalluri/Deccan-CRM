const { Client } = require('pg');
const client = new Client({
  host: 'aws-0-ap-southeast-1.pooler.supabase.com',
  port: 5432,
  user: 'postgres.dryjlcidublougfnpypn',
  password: 'Manoj@minnu27',
  database: 'postgres',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    await client.connect();
    const res = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'restaurants' 
      ORDER BY ordinal_position;
    `);
    console.log('Columns:', res.rows.map(r => r.column_name).join(', '));

    // Also check current restaurant values
    const restRes = await client.query(`SELECT id, name, gstin, upi_id, tax_enabled, cgst_rate, sgst_rate, currency FROM restaurants LIMIT 1;`);
    console.log('Current rest:', restRes.rows[0]);
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}
run();
