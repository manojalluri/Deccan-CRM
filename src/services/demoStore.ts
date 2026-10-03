import type { Restaurant, Category, MenuItem, Table, Order, Bill, BillItem, Payment } from '@/types/database'
import { calculateBill } from './billingCalculator'

export const DEMO_RESTAURANT_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'

export const defaultRestaurant: Restaurant = {
  id: DEMO_RESTAURANT_ID,
  name: 'Deccan CRM',
  slug: 'samravaa',
  logo_url: null,
  phone: '+91 98765 43210',
  address: 'Road No. 36, Jubilee Hills, Hyderabad',
  ordering_enabled: true,
  accept_orders: true,
  auto_accept_orders: false,
  show_sold_out_items: true,
  allow_special_instructions: true,
  require_customer_name: true,
  require_customer_phone: false,
  accent_color: '#E76F2F',
  cover_image_url: null,
  gstin: '36AABCS1429B1Z',
  upi_id: '8309653769@upi',
  upi_merchant_name: 'Deccan CRM',
  receipt_footer: 'Thank you for dining with us! Please visit again.',
  tax_enabled: true,
  cgst_rate: 2.5,
  sgst_rate: 2.5,
  service_charge_rate: 0,
  currency: '₹',
  receipt_width: '80mm',
  gateway_provider: 'mock_upi',
  gateway_mode: 'test',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

export const defaultCategories: Category[] = [
  {
    id: 'cat-1',
    restaurant_id: DEMO_RESTAURANT_ID,
    name: 'Starters & Tandoor',
    description: 'Crispy appetizers and smokey tandoor specials',
    image_url: null,
    display_order: 1,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'cat-2',
    restaurant_id: DEMO_RESTAURANT_ID,
    name: 'Main Course',
    description: 'Rich, authentic regional curries and gravies',
    image_url: null,
    display_order: 2,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'cat-3',
    restaurant_id: DEMO_RESTAURANT_ID,
    name: 'Biryani & Rice',
    description: 'Slow-cooked aromatic dum biryanis and seasoned rice',
    image_url: null,
    display_order: 3,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'cat-4',
    restaurant_id: DEMO_RESTAURANT_ID,
    name: 'Breads & Accompaniments',
    description: 'Fresh clay oven tandoori rotis, naans, and sides',
    image_url: null,
    display_order: 4,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'cat-5',
    restaurant_id: DEMO_RESTAURANT_ID,
    name: 'Beverages & Desserts',
    description: 'Refreshing coolers, traditional lassi, and desserts',
    image_url: null,
    display_order: 5,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
]

export const defaultMenuItems: MenuItem[] = [
  {
    id: 'item-1',
    restaurant_id: DEMO_RESTAURANT_ID,
    category_id: 'cat-1',
    name: 'Paneer Tikka',
    description: 'Cubes of fresh paneer marinated in spiced yogurt and grilled in clay oven',
    price: 240,
    image_url: null,
    food_type: 'veg',
    is_available: true,
    is_recommended: true,
    preparation_time: 15,
    display_order: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'item-2',
    restaurant_id: DEMO_RESTAURANT_ID,
    category_id: 'cat-1',
    name: 'Chicken Malai Tikka',
    description: 'Tender chicken morsels marinated with cream, cheese, and cardamom',
    price: 320,
    image_url: null,
    food_type: 'non-veg',
    is_available: true,
    is_recommended: true,
    preparation_time: 20,
    display_order: 2,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'item-3',
    restaurant_id: DEMO_RESTAURANT_ID,
    category_id: 'cat-2',
    name: 'Paneer Butter Masala',
    description: 'Soft cottage cheese simmered in a silky tomato and cashew butter gravy',
    price: 260,
    image_url: null,
    food_type: 'veg',
    is_available: true,
    is_recommended: true,
    preparation_time: 18,
    display_order: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'item-4',
    restaurant_id: DEMO_RESTAURANT_ID,
    category_id: 'cat-2',
    name: 'Butter Chicken',
    description: 'Classic roasted chicken cooked in a rich, buttery, velvety tomato gravy',
    price: 340,
    image_url: null,
    food_type: 'non-veg',
    is_available: true,
    is_recommended: true,
    preparation_time: 22,
    display_order: 2,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'item-5',
    restaurant_id: DEMO_RESTAURANT_ID,
    category_id: 'cat-2',
    name: 'Dal Makhani',
    description: 'Black lentils slow cooked overnight with butter, cream, and mild spices',
    price: 210,
    image_url: null,
    food_type: 'veg',
    is_available: true,
    is_recommended: false,
    preparation_time: 15,
    display_order: 3,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'item-6',
    restaurant_id: DEMO_RESTAURANT_ID,
    category_id: 'cat-3',
    name: 'Hyderabadi Chicken Dum Biryani',
    description: 'Long-grain basmati rice and marinated chicken cooked with saffron and spices',
    price: 310,
    image_url: null,
    food_type: 'non-veg',
    is_available: true,
    is_recommended: true,
    preparation_time: 25,
    display_order: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'item-7',
    restaurant_id: DEMO_RESTAURANT_ID,
    category_id: 'cat-3',
    name: 'Egg Biryani Special',
    description: 'Spiced aromatic basmati rice layered with golden fried boiled eggs',
    price: 220,
    image_url: null,
    food_type: 'egg',
    is_available: true,
    is_recommended: false,
    preparation_time: 20,
    display_order: 2,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'item-8',
    restaurant_id: DEMO_RESTAURANT_ID,
    category_id: 'cat-4',
    name: 'Butter Garlic Naan',
    description: 'Tandoor-baked flatbread brushed with crushed garlic and melted butter',
    price: 65,
    image_url: null,
    food_type: 'veg',
    is_available: true,
    is_recommended: false,
    preparation_time: 8,
    display_order: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'item-9',
    restaurant_id: DEMO_RESTAURANT_ID,
    category_id: 'cat-5',
    name: 'Royal Mango Lassi',
    description: 'Thick, creamy churned sweet yogurt blended with Alphonso mango pulp',
    price: 120,
    image_url: null,
    food_type: 'veg',
    is_available: true,
    is_recommended: true,
    preparation_time: 5,
    display_order: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
]

export const defaultTables: Table[] = [
  {
    id: 'tbl-1',
    restaurant_id: DEMO_RESTAURANT_ID,
    table_number: 'T-01',
    capacity: 2,
    section: 'Indoor Main',
    qr_token: 'demo-t01-token',
    status: 'occupied',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'tbl-2',
    restaurant_id: DEMO_RESTAURANT_ID,
    table_number: 'T-02',
    capacity: 4,
    section: 'Indoor Main',
    qr_token: 'demo-t02-token',
    status: 'available',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'tbl-3',
    restaurant_id: DEMO_RESTAURANT_ID,
    table_number: 'T-03',
    capacity: 4,
    section: 'Window Side',
    qr_token: 'demo-t03-token',
    status: 'ordering',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'tbl-4',
    restaurant_id: DEMO_RESTAURANT_ID,
    table_number: 'T-04',
    capacity: 6,
    section: 'Outdoor Patio',
    qr_token: 'demo-t04-token',
    status: 'available',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'tbl-5',
    restaurant_id: DEMO_RESTAURANT_ID,
    table_number: 'T-05',
    capacity: 2,
    section: 'Outdoor Patio',
    qr_token: 'demo-t05-token',
    status: 'occupied',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'tbl-6',
    restaurant_id: DEMO_RESTAURANT_ID,
    table_number: 'T-06',
    capacity: 8,
    section: 'VIP Lounge',
    qr_token: 'demo-t06-token',
    status: 'reserved',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
]

export const defaultOrders: Order[] = [
  {
    id: 'ord-101',
    restaurant_id: DEMO_RESTAURANT_ID,
    table_id: 'tbl-1',
    order_number: 101,
    status: 'preparing',
    subtotal: 580,
    tax: 29,
    discount: 0,
    total: 609,
    customer_name: 'Rahul Sharma',
    customer_phone: '+91 98765 11111',
    notes: 'Less spicy please',
    rejection_reason: null,
    created_at: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
    table: defaultTables[0],
    order_items: [
      {
        id: 'oi-1',
        order_id: 'ord-101',
        menu_item_id: 'item-3',
        item_name: 'Paneer Butter Masala',
        item_price: 260,
        quantity: 1,
        food_type: 'veg',
        variant_name: null,
        addons: null,
        notes: null,
        subtotal: 260,
      },
      {
        id: 'oi-2',
        order_id: 'ord-101',
        menu_item_id: 'item-8',
        item_name: 'Butter Garlic Naan',
        item_price: 65,
        quantity: 2,
        food_type: 'veg',
        variant_name: null,
        addons: null,
        notes: null,
        subtotal: 130,
      },
      {
        id: 'oi-3',
        order_id: 'ord-101',
        menu_item_id: 'item-9',
        item_name: 'Royal Mango Lassi',
        item_price: 120,
        quantity: 1,
        food_type: 'veg',
        variant_name: null,
        addons: null,
        notes: null,
        subtotal: 120,
      },
    ],
  },
  {
    id: 'ord-102',
    restaurant_id: DEMO_RESTAURANT_ID,
    table_id: 'tbl-5',
    order_number: 102,
    status: 'accepted',
    subtotal: 660,
    tax: 33,
    discount: 0,
    total: 693,
    customer_name: 'Priya Patel',
    customer_phone: '+91 98765 22222',
    notes: null,
    rejection_reason: null,
    created_at: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
    table: defaultTables[4],
    order_items: [
      {
        id: 'oi-4',
        order_id: 'ord-102',
        menu_item_id: 'item-4',
        item_name: 'Butter Chicken',
        item_price: 340,
        quantity: 1,
        food_type: 'non-veg',
        variant_name: null,
        addons: null,
        notes: null,
        subtotal: 340,
      },
      {
        id: 'oi-5',
        order_id: 'ord-102',
        menu_item_id: 'item-2',
        item_name: 'Chicken Malai Tikka',
        item_price: 320,
        quantity: 1,
        food_type: 'non-veg',
        variant_name: null,
        addons: null,
        notes: null,
        subtotal: 320,
      },
    ],
  },
  {
    id: 'ord-103',
    restaurant_id: DEMO_RESTAURANT_ID,
    table_id: 'tbl-3',
    order_number: 103,
    status: 'placed',
    subtotal: 310,
    tax: 15.5,
    discount: 0,
    total: 325.5,
    customer_name: 'Anand Kumar',
    customer_phone: '+91 98765 33333',
    notes: 'Extra raita',
    rejection_reason: null,
    created_at: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
    table: defaultTables[2],
    order_items: [
      {
        id: 'oi-6',
        order_id: 'ord-103',
        menu_item_id: 'item-6',
        item_name: 'Hyderabadi Chicken Dum Biryani',
        item_price: 310,
        quantity: 1,
        food_type: 'non-veg',
        variant_name: null,
        addons: null,
        notes: null,
        subtotal: 310,
      },
    ],
  },
  {
    id: 'ord-104',
    restaurant_id: DEMO_RESTAURANT_ID,
    table_id: 'tbl-2',
    order_number: 104,
    status: 'ready',
    subtotal: 515,
    tax: 25.75,
    discount: 0,
    total: 540.75,
    customer_name: 'Sneha Reddy',
    customer_phone: null,
    notes: null,
    rejection_reason: null,
    created_at: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
    table: defaultTables[1],
    order_items: [
      {
        id: 'oi-7',
        order_id: 'ord-104',
        menu_item_id: 'item-1',
        item_name: 'Paneer Tikka',
        item_price: 240,
        quantity: 1,
        food_type: 'veg',
        variant_name: null,
        addons: null,
        notes: null,
        subtotal: 240,
      },
      {
        id: 'oi-8',
        order_id: 'ord-104',
        menu_item_id: 'item-5',
        item_name: 'Dal Makhani',
        item_price: 210,
        quantity: 1,
        food_type: 'veg',
        variant_name: null,
        addons: null,
        notes: null,
        subtotal: 210,
      },
      {
        id: 'oi-9',
        order_id: 'ord-104',
        menu_item_id: 'item-8',
        item_name: 'Butter Garlic Naan',
        item_price: 65,
        quantity: 1,
        food_type: 'veg',
        variant_name: null,
        addons: null,
        notes: null,
        subtotal: 65,
      },
    ],
  },
]

// Helper to get / set demo store from localStorage
function getLocal<T>(key: string, defaultVal: T): T {
  try {
    const raw = localStorage.getItem(`samravaa_${key}`)
    if (!raw) return defaultVal
    return JSON.parse(raw) as T
  } catch {
    return defaultVal
  }
}

function setLocal<T>(key: string, val: T): void {
  try {
    localStorage.setItem(`samravaa_${key}`, JSON.stringify(val))
  } catch {
    // Ignore storage quota errors
  }
}

export const demoStore = {
  getRestaurant: () => getLocal('restaurant', defaultRestaurant),
  updateRestaurant: (updates: Partial<Restaurant>) => {
    const current = getLocal('restaurant', defaultRestaurant)
    const updated = { ...current, ...updates, updated_at: new Date().toISOString() }
    setLocal('restaurant', updated)
    return updated
  },

  getCategories: () => getLocal('categories', defaultCategories),
  setCategories: (cats: Category[]) => setLocal('categories', cats),

  getMenuItems: () => {
    const items = getLocal('menu_items', defaultMenuItems)
    const cats = getLocal('categories', defaultCategories)
    const catMap = new Map(cats.map(c => [c.id, c]))
    return items.map(item => ({
      ...item,
      category: catMap.get(item.category_id) || item.category,
    }))
  },
  setMenuItems: (items: MenuItem[]) => setLocal('menu_items', items),

  getTables: () => getLocal('tables', defaultTables),
  setTables: (tbls: Table[]) => setLocal('tables', tbls),

  getOrders: () => {
    const orders = getLocal('orders', defaultOrders)
    const tables = getLocal('tables', defaultTables)
    const tblMap = new Map(tables.map(t => [t.id, t]))
    return orders.map(ord => ({
      ...ord,
      table: tblMap.get(ord.table_id) || ord.table,
    }))
  },
  setOrders: (ords: Order[]) => setLocal('orders', ords),

  // ============================================
  // DEMO BILLING & PAYMENTS
  // ============================================
  getBills: (restaurantId: string, options: { status?: string; dateFilter?: string; searchQuery?: string } = {}) => {
    let list = getLocal<Bill[]>('bills', [])
    list = list.filter(b => b.restaurant_id === restaurantId)

    if (options.status && options.status !== 'all') {
      list = list.filter(b => b.status === options.status)
    }

    const now = new Date()
    if (options.dateFilter === 'today') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
      list = list.filter(b => new Date(b.created_at).getTime() >= start)
    } else if (options.dateFilter === 'yesterday') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).getTime()
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
      list = list.filter(b => {
        const t = new Date(b.created_at).getTime()
        return t >= start && t < end
      })
    } else if (options.dateFilter === 'week') {
      const weekAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000
      list = list.filter(b => new Date(b.created_at).getTime() >= weekAgo)
    } else if (options.dateFilter === 'month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
      list = list.filter(b => new Date(b.created_at).getTime() >= start)
    }

    if (options.searchQuery?.trim()) {
      const q = options.searchQuery.trim().toLowerCase()
      list = list.filter(b =>
        b.bill_number.toLowerCase().includes(q) ||
        String(b.order_number || '').toLowerCase().includes(q) ||
        String(b.table_number || '').toLowerCase().includes(q) ||
        (b.customer_name && b.customer_name.toLowerCase().includes(q))
      )
    }

    return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  },

  getBillById: (billId: string): Bill | null => {
    const list = getLocal<Bill[]>('bills', [])
    const found = list.find(b => b.id === billId)
    if (!found) return null
    const payments = getLocal<Payment[]>('payments', []).filter(p => p.bill_id === billId)
    const rest = getLocal('restaurant', defaultRestaurant)
    return { ...found, payments, restaurant: rest }
  },

  getBillByOrderId: (orderId: string): Bill | null => {
    const list = getLocal<Bill[]>('bills', [])
    const found = list.find(b => (b.order_id === orderId || (b.order_ids && b.order_ids.includes(orderId))) && b.status !== 'CANCELLED')
    if (!found) return null
    const payments = getLocal<Payment[]>('payments', []).filter(p => p.bill_id === found.id)
    const rest = getLocal('restaurant', defaultRestaurant)
    return { ...found, payments, restaurant: rest }
  },

  createBillFromOrder: (options: {
    orderId: string
    orderIds?: string[]
    restaurantId: string
    cashierName?: string
    cashierId?: string
    discountType?: string
    discountValue?: number
    notes?: string
  }): { data: Bill | null; error: string | null } => {
    const allOrders = demoStore.getOrders()
    const targetOrderIds = options.orderIds && options.orderIds.length > 0
      ? Array.from(new Set(options.orderIds))
      : [options.orderId]

    const matchedOrders = allOrders.filter(o => targetOrderIds.includes(o.id))
    const primaryOrder = matchedOrders.find(o => o.id === options.orderId) || matchedOrders[0]

    if (!primaryOrder) return { data: null, error: 'Order not found in demo store.' }

    // Check existing bill
    for (const tid of targetOrderIds) {
      const existing = demoStore.getBillByOrderId(tid)
      if (existing) return { data: existing, error: null }
    }

    const rest = demoStore.getRestaurant()
    
    // Combine items from all selected orders
    const combinedOrderItems = matchedOrders.flatMap(o => (o.order_items || []).map(item => ({
      ...item,
      order_number: o.order_number
    })))

    const itemsForCalc = combinedOrderItems.map(item => ({
      price: Number(item.price ?? item.item_price ?? 0),
      quantity: item.quantity,
      item_name: item.item_name,
    }))

    const calc = calculateBill({
      items: itemsForCalc,
      discountType: (options.discountType as any) || 'none',
      discountValue: options.discountValue || 0,
      taxEnabled: rest.tax_enabled ?? true,
      cgstRate: Number(rest.cgst_rate ?? 2.5),
      sgstRate: Number(rest.sgst_rate ?? 2.5),
      serviceChargeRate: Number(rest.service_charge_rate ?? 0),
    })

    const allBills = getLocal<Bill[]>('bills', [])
    const nextSeq = allBills.length + 1001
    const billNumber = `INV-${new Date().getFullYear()}-${String(nextSeq).padStart(6, '0')}`

    const billId = `bill-${Date.now()}`
    const isCombined = targetOrderIds.length > 1
    const orderNumbersStr = matchedOrders.map(o => `#${o.order_number}`).join(', ')

    const billItems: BillItem[] = combinedOrderItems.map(item => ({
      id: `bi-${Date.now()}-${Math.random()}`,
      bill_id: billId,
      menu_item_id: item.menu_item_id,
      item_name: item.item_name,
      item_price: Number(item.price ?? item.item_price ?? 0),
      quantity: item.quantity,
      item_total: Number(item.price ?? item.item_price ?? 0) * item.quantity,
      notes: isCombined ? `Order #${item.order_number}${item.notes ? ' • ' + item.notes : ''}` : (item.notes || null),
      created_at: new Date().toISOString(),
    }))

    const newBill: Bill = {
      id: billId,
      bill_number: billNumber,
      restaurant_id: options.restaurantId,
      order_id: primaryOrder.id,
      order_ids: targetOrderIds,
      order_numbers: orderNumbersStr,
      is_combined: isCombined,
      table_id: primaryOrder.table_id,
      table_number: primaryOrder.table?.table_number || null,
      order_number: primaryOrder.order_number,
      customer_name: primaryOrder.customer_name || matchedOrders.find(o => o.customer_name)?.customer_name || null,
      customer_phone: primaryOrder.customer_phone || matchedOrders.find(o => o.customer_phone)?.customer_phone || null,
      cashier_name: options.cashierName || 'Staff',
      cashier_id: options.cashierId || null,
      subtotal: calc.subtotal,
      discount_type: calc.discountType,
      discount_value: calc.discountValue,
      discount_amount: calc.discountAmount,
      cgst_rate: calc.cgstRate,
      sgst_rate: calc.sgstRate,
      cgst_amount: calc.cgstAmount,
      sgst_amount: calc.sgstAmount,
      tax_amount: calc.taxAmount,
      round_off: calc.roundOff,
      grand_total: calc.grandTotal,
      status: 'PENDING_PAYMENT',
      payment_method: 'UPI',
      print_count: 0,
      notes: options.notes || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      bill_items: billItems,
      payments: [],
      restaurant: rest,
    }

    allBills.push(newBill)
    setLocal('bills', allBills)
    return { data: newBill, error: null }
  },

  addPayment: (payment: Payment) => {
    const list = getLocal<Payment[]>('payments', [])
    list.push(payment)
    setLocal('payments', list)
  },

  verifyPayment: (paymentId: string): { success: boolean; bill: Bill | null; error: string | null } => {
    const payments = getLocal<Payment[]>('payments', [])
    const pIdx = payments.findIndex(p => p.id === paymentId)
    if (pIdx === -1) return { success: false, bill: null, error: 'Payment record not found' }

    const now = new Date().toISOString()
    payments[pIdx].status = 'PAID'
    payments[pIdx].paid_at = now
    payments[pIdx].updated_at = now
    setLocal('payments', payments)

    const billId = payments[pIdx].bill_id
    const bills = getLocal<Bill[]>('bills', [])
    const bIdx = bills.findIndex(b => b.id === billId)
    if (bIdx !== -1) {
      bills[bIdx].status = 'PAID'
      bills[bIdx].paid_at = now
      bills[bIdx].updated_at = now
      setLocal('bills', bills)

      // Free table
      if (bills[bIdx].table_id) {
        const tables = demoStore.getTables()
        const tIdx = tables.findIndex(t => t.id === bills[bIdx].table_id)
        if (tIdx !== -1) {
          tables[tIdx].status = 'available'
          demoStore.setTables(tables)
        }
      }

      // Mark order(s) served
      const oidsToMark = bills[bIdx].order_ids && bills[bIdx].order_ids.length > 0
        ? bills[bIdx].order_ids
        : (bills[bIdx].order_id ? [bills[bIdx].order_id] : [])

      if (oidsToMark.length > 0) {
        const orders = demoStore.getOrders()
        let updated = false
        for (const oid of oidsToMark) {
          const oIdx = orders.findIndex(o => o.id === oid)
          if (oIdx !== -1) {
            orders[oIdx].status = 'served'
            updated = true
          }
        }
        if (updated) demoStore.setOrders(orders)
      }
    }

    const fullBill = demoStore.getBillById(billId)
    return { success: true, bill: fullBill, error: null }
  },

  cancelBill: (billId: string, reason: string, cancelledBy = 'Admin') => {
    const bills = getLocal<Bill[]>('bills', [])
    const idx = bills.findIndex(b => b.id === billId)
    if (idx === -1) return { success: false, error: 'Bill not found' }
    if (bills[idx].status === 'PAID') return { success: false, error: 'Cannot cancel a paid bill' }

    bills[idx].status = 'CANCELLED'
    bills[idx].cancellation_reason = reason
    bills[idx].cancelled_by = cancelledBy
    bills[idx].cancelled_at = new Date().toISOString()
    bills[idx].updated_at = new Date().toISOString()
    setLocal('bills', bills)
    return { success: true, error: null }
  },

  recordPrint: (billId: string) => {
    const bills = getLocal<Bill[]>('bills', [])
    const idx = bills.findIndex(b => b.id === billId)
    if (idx !== -1) {
      bills[idx].print_count = (bills[idx].print_count || 0) + 1
      setLocal('bills', bills)
    }
  },

  getDashboardBillingMetrics: (restaurantId: string) => {
    const bills = demoStore.getBills(restaurantId, { dateFilter: 'today' })
    let todaySales = 0
    let todayBills = 0
    let todayUpi = 0
    let pendingPayments = 0
    let cancelledBills = 0

    for (const b of bills) {
      todayBills++
      if (b.status === 'PAID') {
        todaySales += Number(b.grand_total) || 0
        if (b.payment_method === 'UPI') {
          todayUpi += Number(b.grand_total) || 0
        }
      } else if (b.status === 'PENDING_PAYMENT') {
        pendingPayments++
      } else if (b.status === 'CANCELLED') {
        cancelledBills++
      }
    }

    return {
      todaySales,
      todayBills,
      todayUpi,
      pendingPayments,
      cancelledBills,
    }
  },
}

