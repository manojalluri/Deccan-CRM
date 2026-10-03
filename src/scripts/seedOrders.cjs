const { Client } = require('pg');

async function seedOrders() {
  const client = new Client({
    host: 'aws-0-ap-southeast-1.pooler.supabase.com',
    port: 5432,
    user: 'postgres.dryjlcidublougfnpypn',
    password: 'Manoj@minnu27',
    database: 'postgres',
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  const restaurantId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

  // Get tables and menu items
  const tablesRes = await client.query('SELECT id, table_number FROM tables WHERE restaurant_id = $1 ORDER BY table_number ASC;', [restaurantId]);
  const itemsRes = await client.query('SELECT id, name, price FROM menu_items WHERE restaurant_id = $1 LIMIT 5;', [restaurantId]);

  if (tablesRes.rows.length === 0 || itemsRes.rows.length === 0) {
    console.log('No tables or menu items found to seed orders.');
    await client.end();
    return;
  }

  const tables = tablesRes.rows;
  const items = itemsRes.rows;

  const ordersData = [
    {
      table_id: tables[0].id,
      customer_name: 'Rahul Sharma',
      customer_phone: '+91 98200 12345',
      status: 'preparing',
      notes: 'Less spicy please',
      items: [
        { item: items[0], quantity: 2 },
        { item: items[1], quantity: 1 }
      ]
    },
    {
      table_id: tables[1].id,
      customer_name: 'Priya Patel',
      customer_phone: '+91 97110 54321',
      status: 'ready',
      notes: 'Extra chutney',
      items: [
        { item: items[2], quantity: 2 },
        { item: items[3], quantity: 1 }
      ]
    },
    {
      table_id: tables[2].id,
      customer_name: 'Vikram Reddy',
      customer_phone: '+91 99440 67890',
      status: 'served',
      notes: '',
      items: [
        { item: items[0], quantity: 1 },
        { item: items[4], quantity: 2 }
      ]
    },
    {
      table_id: tables[3].id,
      customer_name: 'Ananya Deshmukh',
      customer_phone: '+91 98330 99887',
      status: 'placed',
      notes: 'Hurry up please, running late',
      items: [
        { item: items[1], quantity: 2 },
        { item: items[2], quantity: 1 }
      ]
    }
  ];

  for (const ord of ordersData) {
    let subtotal = 0;
    for (const it of ord.items) {
      subtotal += Number(it.item.price) * it.quantity;
    }
    const tax = Math.round(subtotal * 0.05 * 100) / 100;
    const total = subtotal + tax;

    const ordRes = await client.query(`
      INSERT INTO orders (
        restaurant_id, table_id, status, subtotal, tax, discount, total,
        customer_name, customer_phone, notes, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, 0, $6, $7, $8, $9, NOW(), NOW()
      ) RETURNING id;
    `, [
      restaurantId, ord.table_id, ord.status, subtotal, tax, total,
      ord.customer_name, ord.customer_phone, ord.notes
    ]);

    const orderId = ordRes.rows[0].id;

    for (const it of ord.items) {
      await client.query(`
        INSERT INTO order_items (
          order_id, menu_item_id, item_name, price, quantity, special_instructions
        ) VALUES ($1, $2, $3, $4, $5, '')
      `, [orderId, it.item.id, it.item.name, it.item.price, it.quantity]);
    }
  }

  console.log('Seeded ' + ordersData.length + ' live orders with order_items in Supabase!');
  await client.end();
}

seedOrders().catch(console.error);
