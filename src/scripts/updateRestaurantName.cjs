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
    const res = await client.query('SELECT id, name, slug FROM restaurants');
    console.log('Current restaurants:', res.rows);
    const updateRes = await client.query("UPDATE restaurants SET name = 'Deccan CRM'");
    console.log('Updated rows to Deccan CRM:', updateRes.rowCount);
    const after = await client.query('SELECT id, name, slug FROM restaurants');
    console.log('Updated restaurants in DB:', after.rows);
  } catch (err) {
    console.error('Error updating restaurant:', err);
  } finally {
    await client.end();
  }
}

run();
