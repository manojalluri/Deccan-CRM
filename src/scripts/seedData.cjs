const { Client } = require('pg');

async function seed() {
  const client = new Client({
    host: 'aws-0-ap-southeast-1.pooler.supabase.com',
    port: 5432,
    user: 'postgres.dryjlcidublougfnpypn',
    password: 'Manoj@minnu27',
    database: 'postgres',
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();
  console.log('Connected for seeding...');

  const restaurantId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

  // 1. Insert Samravaa Restaurant
  await client.query(`
    INSERT INTO restaurants (id, name, slug, phone, address, ordering_enabled, accept_orders, accent_color)
    VALUES ($1, 'Samravaa Restaurant', 'samravaa', '+91 98765 43210', 'Road No. 36, Jubilee Hills, Hyderabad', true, true, '#E76F2F')
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      slug = EXCLUDED.slug,
      accent_color = EXCLUDED.accent_color;
  `, [restaurantId]);
  console.log('Restaurant seeded.');

  // 2. Insert Categories
  const categories = [
    { id: '11111111-1111-1111-1111-111111111111', name: 'Starters & Tandoor', desc: 'Crispy appetizers and smokey tandoor specials', order: 1 },
    { id: '22222222-2222-2222-2222-222222222222', name: 'Main Course', desc: 'Rich, authentic regional curries and gravies', order: 2 },
    { id: '33333333-3333-3333-3333-333333333333', name: 'Biryani & Rice', desc: 'Slow-cooked aromatic dum biryanis and seasoned rice', order: 3 },
    { id: '44444444-4444-4444-4444-444444444444', name: 'Breads & Accompaniments', desc: 'Fresh clay oven tandoori rotis, naans, and sides', order: 4 },
    { id: '55555555-5555-5555-5555-555555555555', name: 'Beverages & Desserts', desc: 'Refreshing coolers, traditional lassi, and desserts', order: 5 },
  ];

  for (const cat of categories) {
    await client.query(`
      INSERT INTO categories (id, restaurant_id, name, description, display_order, is_active)
      VALUES ($1, $2, $3, $4, $5, true)
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;
    `, [cat.id, restaurantId, cat.name, cat.desc, cat.order]);
  }
  console.log('Categories seeded.');

  // 3. Insert Menu Items
  const menuItems = [
    { name: 'Paneer Tikka', catId: categories[0].id, price: 240, type: 'veg', rec: true, time: 15, desc: 'Cubes of fresh paneer marinated in spiced yogurt and grilled in clay oven' },
    { name: 'Chicken Malai Tikka', catId: categories[0].id, price: 320, type: 'non-veg', rec: true, time: 20, desc: 'Tender chicken morsels marinated with cream, cheese, and cardamom' },
    { name: 'Paneer Butter Masala', catId: categories[1].id, price: 260, type: 'veg', rec: true, time: 18, desc: 'Soft cottage cheese simmered in a silky tomato and cashew butter gravy' },
    { name: 'Butter Chicken', catId: categories[1].id, price: 340, type: 'non-veg', rec: true, time: 22, desc: 'Classic roasted chicken cooked in a rich, buttery, velvety tomato gravy' },
    { name: 'Dal Makhani', catId: categories[1].id, price: 210, type: 'veg', rec: false, time: 15, desc: 'Black lentils slow cooked overnight with butter, cream, and mild spices' },
    { name: 'Hyderabadi Chicken Dum Biryani', catId: categories[2].id, price: 310, type: 'non-veg', rec: true, time: 25, desc: 'Long-grain basmati rice and marinated chicken cooked with saffron and spices' },
    { name: 'Egg Biryani Special', catId: categories[2].id, price: 220, type: 'egg', rec: false, time: 20, desc: 'Spiced aromatic basmati rice layered with golden fried boiled eggs' },
    { name: 'Butter Garlic Naan', catId: categories[3].id, price: 65, type: 'veg', rec: false, time: 8, desc: 'Tandoor-baked flatbread brushed with crushed garlic and melted butter' },
    { name: 'Royal Mango Lassi', catId: categories[4].id, price: 120, type: 'veg', rec: true, time: 5, desc: 'Thick, creamy churned sweet yogurt blended with Alphonso mango pulp' },
  ];

  for (const item of menuItems) {
    await client.query(`
      INSERT INTO menu_items (restaurant_id, category_id, name, description, price, food_type, is_available, is_recommended, preparation_time)
      VALUES ($1, $2, $3, $4, $5, $6, true, $7, $8)
      ON CONFLICT DO NOTHING;
    `, [restaurantId, item.catId, item.name, item.desc, item.price, item.type, item.rec, item.time]);
  }
  console.log('Menu items seeded.');

  // 4. Insert Tables
  const tables = [
    { num: 'T-01', cap: 2, sec: 'Indoor Main', token: 'samravaa-t01' },
    { num: 'T-02', cap: 4, sec: 'Indoor Main', token: 'samravaa-t02' },
    { num: 'T-03', cap: 4, sec: 'Window Side', token: 'samravaa-t03' },
    { num: 'T-04', cap: 6, sec: 'Outdoor Patio', token: 'samravaa-t04' },
    { num: 'T-05', cap: 2, sec: 'Outdoor Patio', token: 'samravaa-t05' },
    { num: 'T-06', cap: 8, sec: 'VIP Lounge', token: 'samravaa-t06' },
  ];

  for (const tbl of tables) {
    await client.query(`
      INSERT INTO tables (restaurant_id, table_number, capacity, section, qr_token, status)
      VALUES ($1, $2, $3, $4, $5, 'available')
      ON CONFLICT (restaurant_id, table_number) DO UPDATE SET qr_token = EXCLUDED.qr_token;
    `, [restaurantId, tbl.num, tbl.cap, tbl.sec, tbl.token]);
  }
  console.log('Tables seeded.');

  // Check counts
  const counts = await client.query(`
    SELECT 
      (SELECT COUNT(*) FROM categories WHERE restaurant_id = $1) as cats,
      (SELECT COUNT(*) FROM menu_items WHERE restaurant_id = $1) as items,
      (SELECT COUNT(*) FROM tables WHERE restaurant_id = $1) as tables;
  `, [restaurantId]);
  console.log('Seed counts in Supabase:', counts.rows[0]);

  await client.end();
  console.log('All seeding complete!');
  process.exit(0);
}

seed().catch(err => {
  console.error('Seed error:', err);
  process.exit(1);
});
