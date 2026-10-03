const { Client } = require('pg');

async function updateUpi() {
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
    await client.query("UPDATE restaurants SET upi_id = '8309653769@upi';");
    const res = await client.query("SELECT id, name, upi_id FROM restaurants;");
    console.log('Updated Restaurants in database:');
    console.log(res.rows);
    await client.end();
  } catch (err) {
    console.error('Error:', err.message);
  }
}

updateUpi();
