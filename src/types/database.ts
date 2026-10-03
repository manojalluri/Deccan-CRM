export type FoodType = 'veg' | 'non-veg' | 'egg'
export type OrderStatus = 'placed' | 'accepted' | 'preparing' | 'ready' | 'served' | 'cancelled'
export type TableStatus = 'available' | 'occupied' | 'reserved' | 'ordering'
export type StaffRole = 'owner' | 'admin' | 'manager' | 'staff' | 'kitchen'

export interface Restaurant {
  id: string
  name: string
  slug: string
  logo_url: string | null
  phone: string | null
  address: string | null
  ordering_enabled: boolean
  accept_orders: boolean
  auto_accept_orders: boolean
  show_sold_out_items: boolean
  allow_special_instructions: boolean
  require_customer_name: boolean
  require_customer_phone: boolean
  accent_color: string | null
  cover_image_url: string | null
  // Billing settings
  gstin?: string | null
  upi_id?: string | null
  upi_merchant_name?: string | null
  receipt_footer?: string | null
  tax_enabled?: boolean
  cgst_rate?: number
  sgst_rate?: number
  service_charge_rate?: number
  currency?: string
  receipt_width?: '80mm' | '58mm'
  gateway_provider?: 'mock_upi' | 'razorpay' | 'cashfree' | 'phonepe'
  gateway_key_id?: string | null
  gateway_key_secret?: string | null
  gateway_mode?: 'test' | 'live'
  created_at: string
  updated_at: string
}

export interface Profile {
  id: string
  restaurant_id: string | null
  name: string
  email: string
  role: StaffRole
  created_at: string
}

export interface Category {
  id: string
  restaurant_id: string
  name: string
  description: string | null
  image_url: string | null
  display_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface MenuItem {
  id: string
  restaurant_id: string
  category_id: string
  name: string
  description: string | null
  price: number
  image_url: string | null
  food_type: FoodType
  is_available: boolean
  is_recommended: boolean
  preparation_time: number | null
  display_order: number
  created_at: string
  updated_at: string
  category?: Category
}

export interface MenuItemVariant {
  id: string
  menu_item_id: string
  name: string
  price: number
  display_order: number
}

export interface MenuItemAddon {
  id: string
  menu_item_id: string
  name: string
  price: number
  display_order: number
}

export interface Table {
  id: string
  restaurant_id: string
  table_number: string
  capacity: number
  section: string | null
  qr_token: string
  status: TableStatus
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Order {
  id: string
  restaurant_id: string
  table_id: string
  order_number: number
  status: OrderStatus
  subtotal: number
  tax: number
  discount: number
  total: number
  customer_name: string | null
  customer_phone: string | null
  notes: string | null
  rejection_reason: string | null
  created_at: string
  updated_at: string
  table?: Table
  order_items?: OrderItem[]
}

export interface OrderItem {
  id: string
  order_id: string
  menu_item_id: string | null
  item_name: string
  price?: number
  item_price?: number
  quantity: number
  special_instructions?: string | null
  notes?: string | null
  created_at?: string
  food_type?: string
  variant_name?: string | null
  addons?: unknown[] | null
  subtotal?: number
}

export interface CartItem {
  menuItemId: string
  name: string
  price: number
  quantity: number
  specialInstructions?: string
  image_url?: string | null
  food_type: FoodType
}

export type BillStatus = 'DRAFT' | 'PENDING_PAYMENT' | 'PAID' | 'CANCELLED' | 'REFUNDED'
export type PaymentStatus = 'PENDING' | 'PROCESSING' | 'PAID' | 'FAILED' | 'CANCELLED' | 'REFUNDED'
export type PaymentMethod = 'UPI' | 'CASH' | 'CARD'
export type DiscountType = 'none' | 'percentage' | 'fixed'

export interface BillItem {
  id: string
  bill_id: string
  menu_item_id: string | null
  item_name: string
  item_price: number
  quantity: number
  item_total: number
  notes?: string | null
  created_at?: string
}

export interface Payment {
  id: string
  bill_id: string
  order_id: string | null
  restaurant_id: string
  amount: number
  payment_method: PaymentMethod | string
  gateway: string
  gateway_order_id?: string | null
  gateway_payment_id?: string | null
  transaction_reference: string
  status: PaymentStatus
  upi_id?: string | null
  qr_data?: string | null
  failure_reason?: string | null
  webhook_payload?: Record<string, unknown> | null
  created_at: string
  paid_at?: string | null
  updated_at: string
}

export interface Bill {
  id: string
  bill_number: string
  restaurant_id: string
  order_id: string | null
  table_id: string | null
  table_number?: string | null
  order_number?: number | null
  customer_name?: string | null
  customer_phone?: string | null
  cashier_name?: string | null
  cashier_id?: string | null
  subtotal: number
  discount_type: DiscountType
  discount_value: number
  discount_amount: number
  cgst_rate: number
  sgst_rate: number
  cgst_amount: number
  sgst_amount: number
  tax_amount: number
  round_off: number
  grand_total: number
  status: BillStatus
  payment_method: PaymentMethod | string
  order_ids?: string[] | null
  order_numbers?: string | null
  is_combined?: boolean | null
  print_count: number
  notes?: string | null
  cancellation_reason?: string | null
  cancelled_by?: string | null
  cancelled_at?: string | null
  paid_at?: string | null
  created_at: string
  updated_at: string
  // Joined fields
  restaurant?: Restaurant
  bill_items?: BillItem[]
  payments?: Payment[]
}

// Database types for Supabase
export type Database = {
  public: {
    Tables: {
      restaurants: {
        Row: Restaurant
        Insert: Omit<Restaurant, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Restaurant, 'id' | 'created_at'>>
      }
      profiles: {
        Row: Profile
        Insert: Omit<Profile, 'id' | 'created_at'>
        Update: Partial<Omit<Profile, 'id' | 'created_at'>>
      }
      categories: {
        Row: Category
        Insert: Omit<Category, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Category, 'id' | 'created_at'>>
      }
      menu_items: {
        Row: MenuItem
        Insert: Omit<MenuItem, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<MenuItem, 'id' | 'created_at'>>
      }
      tables: {
        Row: Table
        Insert: Omit<Table, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Table, 'id' | 'created_at'>>
      }
      orders: {
        Row: Order
        Insert: Omit<Order, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Order, 'id' | 'created_at'>>
      }
      order_items: {
        Row: OrderItem
        Insert: Omit<OrderItem, 'id' | 'created_at'>
        Update: Partial<Omit<OrderItem, 'id' | 'created_at'>>
      }
      bills: {
        Row: Bill
        Insert: Omit<Bill, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Bill, 'id' | 'created_at'>>
      }
      bill_items: {
        Row: BillItem
        Insert: Omit<BillItem, 'id' | 'created_at'>
        Update: Partial<Omit<BillItem, 'id' | 'created_at'>>
      }
      payments: {
        Row: Payment
        Insert: Omit<Payment, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Payment, 'id' | 'created_at'>>
      }
    }
  }
}
