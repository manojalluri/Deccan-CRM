const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function run() {
  console.log('Connecting to Supabase PostgreSQL (Singapore Pooler)...');

  const client = new Client({
    host: 'aws-0-ap-southeast-1.pooler.supabase.com',
    port: 5432,
    user: 'postgres.dryjlcidublougfnpypn',
    password: 'Manoj@minnu27',
    database: 'postgres',
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected successfully!');

    const schemaPath = path.join(__dirname, '../../supabase/schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf8');

    console.log('Executing schema.sql...');
    await client.query(sql);
    console.log('Schema executed successfully!');

    // Check tables
    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    console.log('Created tables in Supabase:');
    console.log(res.rows.map(r => r.table_name).join(', '));

    // Check restaurants
    const restRes = await client.query('SELECT id, name, slug FROM restaurants;');
    console.log('Restaurants in database:', restRes.rows);

    await client.end();
    console.log('Database migration complete!');
    process.exit(0);
  } catch (err) {
    console.error('Error executing schema:', err);
    process.exit(1);
  }
}

run();
