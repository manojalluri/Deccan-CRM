const { Client } = require('pg');
const client = new Client({
  host: 'aws-0-ap-southeast-1.pooler.supabase.com',
  port: 5432,
  user: 'postgres.dryjlcidublougfnpypn',
  password: 'Manoj@minnu27',
  database: 'postgres',
  ssl: { rejectUnauthorized: false }
});

const PRIMARY_RESTAURANT_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const OLD_RESTAURANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

async function run() {
  try {
    await client.connect();
    console.log('Connected to Supabase PostgreSQL');

    // 1. Ensure primary restaurant exists with Deccan CRM name and slug
    await client.query(`
      UPDATE restaurants 
      SET name = 'Deccan CRM', slug = 'deccan-crm'
      WHERE id = $1
    `, [PRIMARY_RESTAURANT_ID]);

    // 2. Move any tables from old restaurant to primary
    // Check table conflicts first
    const oldTables = await client.query('SELECT * FROM tables WHERE restaurant_id = $1', [OLD_RESTAURANT_ID]);
    console.log(`Found ${oldTables.rows.length} tables under old restaurant`);

    for (const tbl of oldTables.rows) {
      // Check if table_number exists in primary
      const existing = await client.query(
        'SELECT id FROM tables WHERE restaurant_id = $1 AND table_number = $2',
        [PRIMARY_RESTAURANT_ID, tbl.table_number]
      );
      if (existing.rows.length > 0) {
        // Rename table_number to avoid unique constraint, e.g. "T-01-B"
        const newNum = `T-${tbl.table_number}-Old`;
        await client.query(
          'UPDATE tables SET restaurant_id = $1, table_number = $2 WHERE id = $3',
          [PRIMARY_RESTAURANT_ID, newNum, tbl.id]
        );
      } else {
        await client.query(
          'UPDATE tables SET restaurant_id = $1 WHERE id = $2',
          [PRIMARY_RESTAURANT_ID, tbl.id]
        );
      }
    }

    // 3. Move orders from old restaurant to primary
    const updateOrders = await client.query(
      'UPDATE orders SET restaurant_id = $1 WHERE restaurant_id = $2',
      [PRIMARY_RESTAURANT_ID, OLD_RESTAURANT_ID]
    );
    console.log(`Moved ${updateOrders.rowCount} orders to primary restaurant`);

    // 4. Move bills from old restaurant to primary
    const updateBills = await client.query(
      'UPDATE bills SET restaurant_id = $1 WHERE restaurant_id = $2',
      [PRIMARY_RESTAURANT_ID, OLD_RESTAURANT_ID]
    );
    console.log(`Moved ${updateBills.rowCount} bills to primary restaurant`);

    // 5. Move payments from old restaurant to primary
    try {
      const updatePayments = await client.query(
        'UPDATE payments SET restaurant_id = $1 WHERE restaurant_id = $2',
        [PRIMARY_RESTAURANT_ID, OLD_RESTAURANT_ID]
      );
      console.log(`Moved ${updatePayments.rowCount} payments to primary restaurant`);
    } catch (e) {
      // Payments table might not have restaurant_id
    }

    // 6. Delete old restaurant
    await client.query('DELETE FROM restaurants WHERE id = $1', [OLD_RESTAURANT_ID]);
    console.log('Deleted duplicate old restaurant');

    // 7. Verify all profiles are linked to primary restaurant
    const profileUpdate = await client.query(
      'UPDATE profiles SET restaurant_id = $1 WHERE restaurant_id IS NULL OR restaurant_id = $2',
      [PRIMARY_RESTAURANT_ID, OLD_RESTAURANT_ID]
    );
    console.log(`Updated ${profileUpdate.rowCount} profiles to primary restaurant`);

    // 8. Confirm totals
    const finalCounts = await client.query(`
      SELECT 
        (SELECT count(*) FROM restaurants) as restaurants,
        (SELECT count(*) FROM tables WHERE restaurant_id = $1) as tables,
        (SELECT count(*) FROM menu_items WHERE restaurant_id = $1) as menu_items,
        (SELECT count(*) FROM orders WHERE restaurant_id = $1) as orders,
        (SELECT count(*) FROM bills WHERE restaurant_id = $1) as bills
    `, [PRIMARY_RESTAURANT_ID]);

    console.log('Final Database State for Deccan CRM:', finalCounts.rows[0]);

  } catch (err) {
    console.error('Migration error:', err);
  } finally {
    await client.end();
  }
}

run();
