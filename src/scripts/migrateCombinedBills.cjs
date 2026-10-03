const { Client } = require('pg');

async function migrate() {
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
    console.log('Connected to Supabase PostgreSQL database.');

    const sql = `
      ALTER TABLE bills
        ADD COLUMN IF NOT EXISTS order_ids TEXT[],
        ADD COLUMN IF NOT EXISTS order_numbers TEXT,
        ADD COLUMN IF NOT EXISTS is_combined BOOLEAN DEFAULT false;
    `;

    await client.query(sql);
    console.log('Successfully migrated bills table for combined billing support.');
  } catch (err) {
    console.error('Migration error:', err);
  } finally {
    await client.end();
  }
}

migrate();
