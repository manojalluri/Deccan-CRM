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
    -- 1. Add restaurant billing settings columns
    ALTER TABLE restaurants
      ADD COLUMN IF NOT EXISTS gstin TEXT,
      ADD COLUMN IF NOT EXISTS upi_id TEXT DEFAULT 'urbanbites@upi',
      ADD COLUMN IF NOT EXISTS upi_merchant_name TEXT DEFAULT 'Urban Bites',
      ADD COLUMN IF NOT EXISTS receipt_footer TEXT DEFAULT 'Thank you for dining with us! Please visit again.',
      ADD COLUMN IF NOT EXISTS tax_enabled BOOLEAN DEFAULT true,
      ADD COLUMN IF NOT EXISTS cgst_rate DECIMAL(5,2) DEFAULT 2.50,
      ADD COLUMN IF NOT EXISTS sgst_rate DECIMAL(5,2) DEFAULT 2.50,
      ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT '₹',
      ADD COLUMN IF NOT EXISTS receipt_width TEXT DEFAULT '80mm',
      ADD COLUMN IF NOT EXISTS gateway_provider TEXT DEFAULT 'mock_upi',
      ADD COLUMN IF NOT EXISTS gateway_key_id TEXT,
      ADD COLUMN IF NOT EXISTS gateway_key_secret TEXT,
      ADD COLUMN IF NOT EXISTS gateway_mode TEXT DEFAULT 'test';

    -- Update existing restaurants with defaults if null
    UPDATE restaurants
    SET 
      upi_id = COALESCE(upi_id, 'urbanbites@upi'),
      upi_merchant_name = COALESCE(upi_merchant_name, name),
      receipt_footer = COALESCE(receipt_footer, 'Thank you for dining with us! Please visit again.'),
      tax_enabled = COALESCE(tax_enabled, true),
      cgst_rate = COALESCE(cgst_rate, 2.50),
      sgst_rate = COALESCE(sgst_rate, 2.50),
      currency = COALESCE(currency, '₹'),
      receipt_width = COALESCE(receipt_width, '80mm'),
      gateway_provider = COALESCE(gateway_provider, 'mock_upi'),
      gateway_mode = COALESCE(gateway_mode, 'test');

    -- 2. Bill Number Sequence and Generator Function
    CREATE SEQUENCE IF NOT EXISTS bill_number_seq START WITH 1001;

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

    -- 3. Bills Table
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
      print_count INTEGER DEFAULT 0,
      notes TEXT,
      cancellation_reason TEXT,
      cancelled_by TEXT,
      cancelled_at TIMESTAMPTZ,
      paid_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- 4. Bill Items Table
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

    -- 5. Payments Table
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

    -- Indexes for high-speed queries
    CREATE INDEX IF NOT EXISTS idx_bills_restaurant_id ON bills(restaurant_id);
    CREATE INDEX IF NOT EXISTS idx_bills_order_id ON bills(order_id);
    CREATE INDEX IF NOT EXISTS idx_bills_status ON bills(status);
    CREATE INDEX IF NOT EXISTS idx_bills_created_at ON bills(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_bill_items_bill_id ON bill_items(bill_id);
    CREATE INDEX IF NOT EXISTS idx_payments_bill_id ON payments(bill_id);
    CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
    CREATE INDEX IF NOT EXISTS idx_payments_restaurant_id ON payments(restaurant_id);

    -- RLS Policies
    ALTER TABLE bills ENABLE ROW LEVEL SECURITY;
    ALTER TABLE bill_items ENABLE ROW LEVEL SECURITY;
    ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "bills_staff_access" ON bills;
    CREATE POLICY "bills_staff_access" ON bills FOR ALL USING (true);

    DROP POLICY IF EXISTS "bill_items_access" ON bill_items;
    CREATE POLICY "bill_items_access" ON bill_items FOR ALL USING (true);

    DROP POLICY IF EXISTS "payments_access" ON payments;
    CREATE POLICY "payments_access" ON payments FOR ALL USING (true);

    -- Enable Realtime
    DO $$
    BEGIN
      BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE bills;
      EXCEPTION WHEN duplicate_object THEN
        -- already added
      END;
      BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE payments;
      EXCEPTION WHEN duplicate_object THEN
        -- already added
      END;
    END $$;
    `;

    console.log('Running migration...');
    await client.query(sql);
    console.log('Migration executed successfully!');

    // Check verification
    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    console.log('Tables present now:', res.rows.map(r => r.table_name));

    const billNumberCheck = await client.query('SELECT generate_bill_number() as sample_bill;');
    console.log('Sample generated bill number:', billNumberCheck.rows[0].sample_bill);

    await client.end();
    console.log('Done!');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrate();
