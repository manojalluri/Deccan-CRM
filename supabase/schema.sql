-- =============================================
-- SAMARVAA QR RESTAURANT ORDERING PLATFORM
-- Full Database Schema with RLS Policies
-- =============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- RESTAURANTS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS restaurants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  phone TEXT,
  address TEXT,
  ordering_enabled BOOLEAN NOT NULL DEFAULT true,
  accept_orders BOOLEAN NOT NULL DEFAULT true,
  auto_accept_orders BOOLEAN NOT NULL DEFAULT false,
  show_sold_out_items BOOLEAN NOT NULL DEFAULT true,
  allow_special_instructions BOOLEAN NOT NULL DEFAULT true,
  require_customer_name BOOLEAN NOT NULL DEFAULT false,
  require_customer_phone BOOLEAN NOT NULL DEFAULT false,
  accent_color TEXT DEFAULT '#f97316',
  cover_image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- PROFILES TABLE (linked to auth.users)
-- =============================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('owner', 'admin', 'manager', 'staff', 'kitchen')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- CATEGORIES TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_categories_restaurant_id ON categories(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_categories_display_order ON categories(restaurant_id, display_order);

-- =============================================
-- MENU ITEMS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS menu_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL CHECK (price >= 0),
  image_url TEXT,
  food_type TEXT NOT NULL DEFAULT 'veg' CHECK (food_type IN ('veg', 'non-veg', 'egg')),
  is_available BOOLEAN NOT NULL DEFAULT true,
  is_recommended BOOLEAN NOT NULL DEFAULT false,
  preparation_time INTEGER,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_menu_items_restaurant_id ON menu_items(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_category_id ON menu_items(category_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_available ON menu_items(restaurant_id, is_available);

-- =============================================
-- TABLES TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS tables (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  table_number TEXT NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 4,
  section TEXT,
  qr_token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'reserved', 'ordering')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(restaurant_id, table_number)
);

CREATE INDEX IF NOT EXISTS idx_tables_restaurant_id ON tables(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_tables_qr_token ON tables(qr_token);

-- =============================================
-- ORDERS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  table_id UUID NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
  order_number SERIAL,
  status TEXT NOT NULL DEFAULT 'placed' CHECK (status IN ('placed', 'accepted', 'preparing', 'ready', 'served', 'cancelled')),
  subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
  tax DECIMAL(10,2) NOT NULL DEFAULT 0,
  discount DECIMAL(10,2) NOT NULL DEFAULT 0,
  total DECIMAL(10,2) NOT NULL DEFAULT 0,
  customer_name TEXT,
  customer_phone TEXT,
  notes TEXT,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_restaurant_id ON orders(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_orders_table_id ON orders(table_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(restaurant_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(restaurant_id, created_at DESC);

-- =============================================
-- ORDER ITEMS TABLE (Price Snapshot)
-- =============================================
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id UUID REFERENCES menu_items(id) ON DELETE SET NULL,
  item_name TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL CHECK (price >= 0),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  special_instructions TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);

-- =============================================
-- UPDATED_AT TRIGGER FUNCTION
-- =============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_restaurants_updated_at BEFORE UPDATE ON restaurants FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_menu_items_updated_at BEFORE UPDATE ON menu_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tables_updated_at BEFORE UPDATE ON tables FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================

ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- =============================================
-- HELPER FUNCTION: Get user's restaurant_id
-- =============================================
CREATE OR REPLACE FUNCTION get_user_restaurant_id()
RETURNS UUID AS $$
  SELECT restaurant_id FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- =============================================
-- RESTAURANTS POLICIES
-- =============================================
CREATE POLICY "restaurants_public_read" ON restaurants FOR SELECT USING (true);
CREATE POLICY "restaurants_owner_update" ON restaurants FOR UPDATE USING (id = get_user_restaurant_id());

-- =============================================
-- PROFILES POLICIES
-- =============================================
CREATE POLICY "profiles_self_read" ON profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "profiles_self_update" ON profiles FOR UPDATE USING (id = auth.uid());
CREATE POLICY "profiles_self_insert" ON profiles FOR INSERT WITH CHECK (id = auth.uid());

-- =============================================
-- CATEGORIES POLICIES
-- =============================================
CREATE POLICY "categories_public_read" ON categories FOR SELECT USING (is_active = true);
CREATE POLICY "categories_staff_read" ON categories FOR SELECT USING (restaurant_id = get_user_restaurant_id());
CREATE POLICY "categories_staff_insert" ON categories FOR INSERT WITH CHECK (restaurant_id = get_user_restaurant_id());
CREATE POLICY "categories_staff_update" ON categories FOR UPDATE USING (restaurant_id = get_user_restaurant_id());
CREATE POLICY "categories_staff_delete" ON categories FOR DELETE USING (restaurant_id = get_user_restaurant_id());

-- =============================================
-- MENU ITEMS POLICIES
-- =============================================
CREATE POLICY "menu_items_public_read" ON menu_items FOR SELECT USING (true);
CREATE POLICY "menu_items_staff_insert" ON menu_items FOR INSERT WITH CHECK (restaurant_id = get_user_restaurant_id());
CREATE POLICY "menu_items_staff_update" ON menu_items FOR UPDATE USING (restaurant_id = get_user_restaurant_id());
CREATE POLICY "menu_items_staff_delete" ON menu_items FOR DELETE USING (restaurant_id = get_user_restaurant_id());

-- =============================================
-- TABLES POLICIES
-- =============================================
CREATE POLICY "tables_public_read" ON tables FOR SELECT USING (is_active = true);
CREATE POLICY "tables_staff_read" ON tables FOR SELECT USING (restaurant_id = get_user_restaurant_id());
CREATE POLICY "tables_staff_insert" ON tables FOR INSERT WITH CHECK (restaurant_id = get_user_restaurant_id());
CREATE POLICY "tables_staff_update" ON tables FOR UPDATE USING (restaurant_id = get_user_restaurant_id());
CREATE POLICY "tables_staff_delete" ON tables FOR DELETE USING (restaurant_id = get_user_restaurant_id());

-- =============================================
-- ORDERS POLICIES
-- =============================================
CREATE POLICY "orders_public_insert" ON orders FOR INSERT WITH CHECK (true);
CREATE POLICY "orders_public_read" ON orders FOR SELECT USING (true);
CREATE POLICY "orders_staff_update" ON orders FOR UPDATE USING (restaurant_id = get_user_restaurant_id());

-- =============================================
-- ORDER ITEMS POLICIES
-- =============================================
CREATE POLICY "order_items_public_insert" ON order_items FOR INSERT WITH CHECK (true);
CREATE POLICY "order_items_public_read" ON order_items FOR SELECT USING (true);

-- =============================================
-- REALTIME PUBLICATION
-- =============================================
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE order_items;
ALTER PUBLICATION supabase_realtime ADD TABLE menu_items;
ALTER PUBLICATION supabase_realtime ADD TABLE restaurants;

-- =============================================
-- SEED DATA
-- =============================================
INSERT INTO restaurants (id, name, slug, phone, address, ordering_enabled, accent_color)
VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'Urban Bites',
  'urban-bites',
  '+91 98765 43210',
  '42, MG Road, Bangalore, Karnataka 560001',
  true,
  '#f97316'
) ON CONFLICT DO NOTHING;

INSERT INTO tables (restaurant_id, table_number, capacity, section, qr_token, status) VALUES
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', '01', 4, 'Indoor', 'a8f92kd73x1y', 'available'),
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', '02', 2, 'Indoor', 'b7e81jc62w0z', 'available'),
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', '03', 6, 'Outdoor', 'c6d70ib51v9y', 'available'),
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', '04', 4, 'Outdoor', 'd5c69ha40u8x', 'available'),
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', '05', 8, 'Private', 'e4b58gz39t7w', 'available')
ON CONFLICT DO NOTHING;

-- =============================================
-- BILLING MODULE SCHEMA
-- =============================================

-- Restaurant billing columns
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS gstin TEXT,
  ADD COLUMN IF NOT EXISTS upi_id TEXT DEFAULT '8309653769@upi',
  ADD COLUMN IF NOT EXISTS upi_merchant_name TEXT DEFAULT 'Urban Bites',
  ADD COLUMN IF NOT EXISTS receipt_footer TEXT DEFAULT 'Thank you for dining with us! Please visit again.',
  ADD COLUMN IF NOT EXISTS tax_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS cgst_rate DECIMAL(5,2) DEFAULT 2.50,
  ADD COLUMN IF NOT EXISTS sgst_rate DECIMAL(5,2) DEFAULT 2.50,
  ADD COLUMN IF NOT EXISTS service_charge_rate DECIMAL(5,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT '₹',
  ADD COLUMN IF NOT EXISTS receipt_width TEXT DEFAULT '80mm',
  ADD COLUMN IF NOT EXISTS gateway_provider TEXT DEFAULT 'mock_upi',
  ADD COLUMN IF NOT EXISTS gateway_key_id TEXT,
  ADD COLUMN IF NOT EXISTS gateway_key_secret TEXT,
  ADD COLUMN IF NOT EXISTS gateway_mode TEXT DEFAULT 'test';

-- Sequence for bill numbers
CREATE SEQUENCE IF NOT EXISTS bill_number_seq START WITH 1001;

-- Function for bill number generation (e.g. INV-2026-001001)
CREATE OR REPLACE FUNCTION generate_bill_number()
RETURNS TEXT AS $$
DECLARE
  next_val BIGINT;
  year_val TEXT;
BEGIN
  next_val := nextval('bill_number_seq');
  year_val := to_char(CURRENT_DATE, 'YYYY');
  RETURN 'INV-' || year_val || '-' || LPAD(next_val::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- Bills Table
CREATE TABLE IF NOT EXISTS bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_number TEXT NOT NULL UNIQUE DEFAULT generate_bill_number(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  table_id UUID REFERENCES tables(id) ON DELETE SET NULL,
  table_number TEXT,
  order_number INTEGER,
  customer_name TEXT,
  customer_phone TEXT,
  cashier_name TEXT,
  cashier_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount_type TEXT DEFAULT 'none' CHECK (discount_type IN ('none', 'percentage', 'fixed')),
  discount_value NUMERIC(10,2) DEFAULT 0,
  discount_amount NUMERIC(10,2) DEFAULT 0,
  cgst_rate NUMERIC(5,2) DEFAULT 2.50,
  sgst_rate NUMERIC(5,2) DEFAULT 2.50,
  cgst_amount NUMERIC(10,2) DEFAULT 0,
  sgst_amount NUMERIC(10,2) DEFAULT 0,
  tax_amount NUMERIC(10,2) DEFAULT 0,
  round_off NUMERIC(10,2) DEFAULT 0,
  grand_total NUMERIC(10,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'PENDING_PAYMENT' CHECK (status IN ('DRAFT', 'PENDING_PAYMENT', 'PAID', 'CANCELLED', 'REFUNDED')),
  payment_method TEXT DEFAULT 'UPI',
  order_ids TEXT[],
  order_numbers TEXT,
  is_combined BOOLEAN DEFAULT false,
  print_count INTEGER DEFAULT 0,
  notes TEXT,
  cancellation_reason TEXT,
  cancelled_by TEXT,
  cancelled_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bill Items Table
CREATE TABLE IF NOT EXISTS bill_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id UUID NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  menu_item_id UUID REFERENCES menu_items(id) ON DELETE SET NULL,
  item_name TEXT NOT NULL,
  item_price NUMERIC(10,2) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  item_total NUMERIC(10,2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payments Table
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id UUID NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'UPI',
  gateway TEXT NOT NULL DEFAULT 'mock_upi',
  gateway_order_id TEXT,
  gateway_payment_id TEXT,
  transaction_reference TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'PAID', 'FAILED', 'CANCELLED', 'REFUNDED')),
  upi_id TEXT,
  qr_data TEXT,
  failure_reason TEXT,
  webhook_payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  paid_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS and Realtime
ALTER TABLE bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bills_staff_access" ON bills FOR ALL USING (true);
CREATE POLICY "bill_items_access" ON bill_items FOR ALL USING (true);
CREATE POLICY "payments_access" ON payments FOR ALL USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE bills;
ALTER PUBLICATION supabase_realtime ADD TABLE payments;

