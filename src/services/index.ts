import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import type { Restaurant, Category, MenuItem, Table, Order, CartItem } from '@/types/database'
import { generateQRToken } from '@/lib/utils'
import { demoStore, DEMO_RESTAURANT_ID } from './demoStore'

// ============================================
// RESTAURANT SERVICES
// ============================================

export const restaurantService = {
  async getBySlug(slug: string): Promise<Restaurant | null> {
    if (!isSupabaseConfigured) {
      return demoStore.getRestaurant()
    }

    // 1. Try exact slug match
    let { data } = await supabase
      .from('restaurants')
      .select('*')
      .eq('slug', slug)
      .maybeSingle()

    // 2. Fallback: match by known slugs or retrieve primary restaurant
    if (!data) {
      const fallback = await supabase
        .from('restaurants')
        .select('*')
        .or('slug.eq.deccan-crm,slug.eq.samravaa,slug.eq.urban-bites')
        .limit(1)
        .maybeSingle()
      data = fallback.data
    }

    // 3. Fallback: retrieve the first available restaurant
    if (!data) {
      const first = await supabase
        .from('restaurants')
        .select('*')
        .limit(1)
        .maybeSingle()
      data = first.data
    }

    return data
  },

  async getById(id: string): Promise<Restaurant | null> {
    if (!isSupabaseConfigured) {
      return demoStore.getRestaurant()
    }

    let { data } = await supabase
      .from('restaurants')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (!data) {
      const first = await supabase
        .from('restaurants')
        .select('*')
        .limit(1)
        .maybeSingle()
      data = first.data
    }

    return data
  },

  async update(id: string, updates: Partial<Restaurant>): Promise<{ error: Error | null }> {
    if (!isSupabaseConfigured) {
      demoStore.updateRestaurant(updates)
      return { error: null }
    }

    const { error } = await supabase
      .from('restaurants')
      .update(updates)
      .eq('id', id)

    return { error: error as Error | null }
  },
}

// ============================================
// CATEGORY SERVICES
// ============================================

export const categoryService = {
  async getByRestaurant(restaurantId: string): Promise<Category[]> {
    if (!isSupabaseConfigured) {
      return demoStore.getCategories()
    }

    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('display_order', { ascending: true })

    if (error) return []
    return data
  },

  async getActive(restaurantId: string): Promise<Category[]> {
    if (!isSupabaseConfigured) {
      return demoStore.getCategories().filter(c => c.is_active)
    }

    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('is_active', true)
      .order('display_order', { ascending: true })

    if (error) return []
    return data
  },

  async create(category: Omit<Category, 'id' | 'created_at' | 'updated_at'>): Promise<{ data: Category | null; error: Error | null }> {
    if (!isSupabaseConfigured) {
      const newCat: Category = {
        ...category,
        id: `cat-${Date.now()}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      const cats = [...demoStore.getCategories(), newCat]
      demoStore.setCategories(cats)
      return { data: newCat, error: null }
    }

    const { data, error } = await supabase
      .from('categories')
      .insert(category)
      .select()
      .single()

    return { data, error: error as Error | null }
  },

  async update(id: string, updates: Partial<Category>): Promise<{ error: Error | null }> {
    if (!isSupabaseConfigured) {
      const cats = demoStore.getCategories().map(c => c.id === id ? { ...c, ...updates, updated_at: new Date().toISOString() } : c)
      demoStore.setCategories(cats)
      return { error: null }
    }

    const { error } = await supabase
      .from('categories')
      .update(updates)
      .eq('id', id)

    return { error: error as Error | null }
  },

  async delete(id: string): Promise<{ error: Error | null }> {
    if (!isSupabaseConfigured) {
      const cats = demoStore.getCategories().filter(c => c.id !== id)
      demoStore.setCategories(cats)
      return { error: null }
    }

    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id)

    return { error: error as Error | null }
  },

  async reorder(categories: { id: string; display_order: number }[]): Promise<void> {
    if (!isSupabaseConfigured) {
      const current = demoStore.getCategories()
      const orderMap = new Map(categories.map(c => [c.id, c.display_order]))
      const updated = current.map(c => orderMap.has(c.id) ? { ...c, display_order: orderMap.get(c.id)! } : c)
      updated.sort((a, b) => a.display_order - b.display_order)
      demoStore.setCategories(updated)
      return
    }

    await Promise.all(
      categories.map(({ id, display_order }) =>
        supabase.from('categories').update({ display_order }).eq('id', id)
      )
    )
  },
}

// ============================================
// MENU ITEM SERVICES
// ============================================

export const menuItemService = {
  async getByRestaurant(restaurantId: string): Promise<MenuItem[]> {
    if (!isSupabaseConfigured) {
      return demoStore.getMenuItems()
    }

    const { data, error } = await supabase
      .from('menu_items')
      .select('*, category:categories(*)')
      .eq('restaurant_id', restaurantId)
      .order('display_order', { ascending: true })

    if (error) return []
    return data as MenuItem[]
  },

  async getByCategory(categoryId: string, restaurantId: string): Promise<MenuItem[]> {
    if (!isSupabaseConfigured) {
      return demoStore.getMenuItems().filter(i => i.category_id === categoryId)
    }

    const { data, error } = await supabase
      .from('menu_items')
      .select('*')
      .eq('category_id', categoryId)
      .eq('restaurant_id', restaurantId)
      .order('display_order', { ascending: true })

    if (error) return []
    return data
  },

  async create(item: Omit<MenuItem, 'id' | 'created_at' | 'updated_at' | 'category'>): Promise<{ data: MenuItem | null; error: Error | null }> {
    if (!isSupabaseConfigured) {
      const cats = demoStore.getCategories()
      const category = cats.find(c => c.id === item.category_id)
      const newItem: MenuItem = {
        ...item,
        id: `item-${Date.now()}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        category,
      }
      const items = [...demoStore.getMenuItems(), newItem]
      demoStore.setMenuItems(items)
      return { data: newItem, error: null }
    }

    const { data, error } = await supabase
      .from('menu_items')
      .insert(item)
      .select()
      .single()

    return { data, error: error as Error | null }
  },

  async update(id: string, updates: Partial<MenuItem>): Promise<{ error: Error | null }> {
    if (!isSupabaseConfigured) {
      const cats = demoStore.getCategories()
      const items = demoStore.getMenuItems().map(item => {
        if (item.id !== id) return item
        const updated = { ...item, ...updates, updated_at: new Date().toISOString() }
        if (updates.category_id) {
          updated.category = cats.find(c => c.id === updates.category_id)
        }
        return updated
      })
      demoStore.setMenuItems(items)
      return { error: null }
    }

    const { error } = await supabase
      .from('menu_items')
      .update(updates)
      .eq('id', id)

    return { error: error as Error | null }
  },

  async toggleAvailability(id: string, isAvailable: boolean): Promise<{ error: Error | null }> {
    if (!isSupabaseConfigured) {
      const items = demoStore.getMenuItems().map(item =>
        item.id === id ? { ...item, is_available: isAvailable, updated_at: new Date().toISOString() } : item
      )
      demoStore.setMenuItems(items)
      return { error: null }
    }

    const { error } = await supabase
      .from('menu_items')
      .update({ is_available: isAvailable })
      .eq('id', id)

    return { error: error as Error | null }
  },

  async delete(id: string): Promise<{ error: Error | null }> {
    if (!isSupabaseConfigured) {
      const items = demoStore.getMenuItems().filter(i => i.id !== id)
      demoStore.setMenuItems(items)
      return { error: null }
    }

    const { error } = await supabase
      .from('menu_items')
      .delete()
      .eq('id', id)

    return { error: error as Error | null }
  },

  async uploadImage(file: File, restaurantId: string): Promise<{ url: string | null; error: Error | null }> {
    if (!isSupabaseConfigured) {
      // In demo mode, convert to object URL so it displays instantly
      return { url: URL.createObjectURL(file), error: null }
    }

    const fileExt = file.name.split('.').pop() || 'jpg'
    const fileName = `${restaurantId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`

    try {
      const { error: uploadError } = await supabase.storage
        .from('menu-images')
        .upload(fileName, file, { 
          upsert: true,
          contentType: file.type || 'image/jpeg'
        })

      if (uploadError) {
        console.warn('Storage upload error, falling back to data URL:', uploadError)
        return new Promise((resolve) => {
          const reader = new FileReader()
          reader.onload = () => resolve({ url: reader.result as string, error: null })
          reader.onerror = () => resolve({ url: null, error: uploadError as Error })
          reader.readAsDataURL(file)
        })
      }

      const { data } = supabase.storage.from('menu-images').getPublicUrl(fileName)
      return { url: data.publicUrl, error: null }
    } catch (err) {
      console.warn('Exception during image upload, using Data URL fallback:', err)
      return new Promise((resolve) => {
        const reader = new FileReader()
        reader.onload = () => resolve({ url: reader.result as string, error: null })
        reader.onerror = () => resolve({ url: null, error: err as Error })
        reader.readAsDataURL(file)
      })
    }
  },
}

// ============================================
// TABLE SERVICES
// ============================================

export const tableService = {
  async getByRestaurant(restaurantId: string): Promise<Table[]> {
    if (!isSupabaseConfigured) {
      return demoStore.getTables()
    }

    const { data, error } = await supabase
      .from('tables')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('table_number', { ascending: true })

    if (error) return []
    return data
  },

  async getByToken(token: string): Promise<Table | null> {
    if (!isSupabaseConfigured) {
      const tables = demoStore.getTables()
      return tables.find(t => t.qr_token === token && t.is_active) || tables[0] || null
    }

    const { data, error } = await supabase
      .from('tables')
      .select('*')
      .eq('qr_token', token)
      .eq('is_active', true)
      .single()

    if (error) return null
    return data
  },

  async create(table: Omit<Table, 'id' | 'created_at' | 'updated_at' | 'qr_token'>): Promise<{ data: Table | null; error: Error | null }> {
    const qr_token = generateQRToken()

    if (!isSupabaseConfigured) {
      const newTable: Table = {
        ...table,
        id: `tbl-${Date.now()}`,
        qr_token,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      const tables = [...demoStore.getTables(), newTable]
      demoStore.setTables(tables)
      return { data: newTable, error: null }
    }

    const { data, error } = await supabase
      .from('tables')
      .insert({ ...table, qr_token })
      .select()
      .single()

    return { data, error: error as Error | null }
  },

  async update(id: string, updates: Partial<Table>): Promise<{ error: Error | null }> {
    if (!isSupabaseConfigured) {
      const tables = demoStore.getTables().map(t => t.id === id ? { ...t, ...updates, updated_at: new Date().toISOString() } : t)
      demoStore.setTables(tables)
      return { error: null }
    }

    const { error } = await supabase
      .from('tables')
      .update(updates)
      .eq('id', id)

    return { error: error as Error | null }
  },

  async delete(id: string): Promise<{ error: Error | null }> {
    if (!isSupabaseConfigured) {
      const tables = demoStore.getTables().filter(t => t.id !== id)
      demoStore.setTables(tables)
      return { error: null }
    }

    const { error } = await supabase
      .from('tables')
      .delete()
      .eq('id', id)

    return { error: error as Error | null }
  },

  async regenerateQR(id: string): Promise<{ token: string | null; error: Error | null }> {
    const qr_token = generateQRToken()

    if (!isSupabaseConfigured) {
      const tables = demoStore.getTables().map(t => t.id === id ? { ...t, qr_token, updated_at: new Date().toISOString() } : t)
      demoStore.setTables(tables)
      return { token: qr_token, error: null }
    }

    const { error } = await supabase
      .from('tables')
      .update({ qr_token })
      .eq('id', id)

    return { token: error ? null : qr_token, error: error as Error | null }
  },
}

// ============================================
// ORDER SERVICES
// ============================================

export const orderService = {
  async getByRestaurant(restaurantId: string, limit = 50): Promise<Order[]> {
    if (!isSupabaseConfigured) {
      return demoStore.getOrders().slice(0, limit)
    }

    const { data, error } = await supabase
      .from('orders')
      .select('*, table:tables(*), order_items(*)')
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) return []
    return data as Order[]
  },

  async getById(orderId: string): Promise<Order | null> {
    if (!isSupabaseConfigured) {
      return demoStore.getOrders().find(o => o.id === orderId) || null
    }

    const { data, error } = await supabase
      .from('orders')
      .select('*, table:tables(*), order_items(*)')
      .eq('id', orderId)
      .single()

    if (error) return null
    return data as Order
  },

  async getTodaysByRestaurant(restaurantId: string): Promise<Order[]> {
    if (!isSupabaseConfigured) {
      return demoStore.getOrders()
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const { data, error } = await supabase
      .from('orders')
      .select('*, table:tables(*), order_items(*)')
      .eq('restaurant_id', restaurantId)
      .gte('created_at', today.toISOString())
      .order('created_at', { ascending: false })

    if (error) return []
    return data as Order[]
  },

  async place(params: {
    restaurantId: string
    tableId: string
    items: CartItem[]
    customerName?: string
    customerPhone?: string
    notes?: string
  }): Promise<{ data: Order | null; error: string | null }> {
    if (!isSupabaseConfigured) {
      const tables = demoStore.getTables()
      const table = tables.find(t => t.id === params.tableId) || tables[0]
      const menuItems = demoStore.getMenuItems()

      const subtotal = params.items.reduce((sum, item) => {
        const mi = menuItems.find(m => m.id === item.menuItemId)
        return sum + (mi?.price || item.price) * item.quantity
      }, 0)
      const rest = demoStore.getRestaurant()
      const isTax = rest.tax_enabled ?? true
      const cgst = isTax ? Number(rest.cgst_rate ?? 2.5) : 0
      const sgst = isTax ? Number(rest.sgst_rate ?? 2.5) : 0
      const srvCharge = Number(rest.service_charge_rate ?? 0)
      const tax = Math.round((subtotal * (cgst + sgst) / 100) * 100) / 100
      const total = Math.round(subtotal + tax + (subtotal * srvCharge / 100))

      const newOrder: Order = {
        id: `ord-${Date.now()}`,
        restaurant_id: DEMO_RESTAURANT_ID,
        table_id: table.id,
        order_number: 100 + demoStore.getOrders().length + 1,
        status: 'placed',
        subtotal,
        tax,
        discount: 0,
        total,
        customer_name: params.customerName || 'Customer',
        customer_phone: params.customerPhone || null,
        notes: params.notes || null,
        rejection_reason: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        table,
        order_items: params.items.map((item, idx) => ({
          id: `oi-${Date.now()}-${idx}`,
          order_id: `ord-${Date.now()}`,
          menu_item_id: item.menuItemId,
          item_name: item.name,
          item_price: item.price,
          quantity: item.quantity,
          food_type: 'veg',
          variant_name: null,
          addons: null,
          notes: item.specialInstructions || null,
          subtotal: item.price * item.quantity,
        })),
      }

      const orders = [newOrder, ...demoStore.getOrders()]
      demoStore.setOrders(orders)
      return { data: newOrder, error: null }
    }

    // Validate restaurant
    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('ordering_enabled, accept_orders, auto_accept_orders, tax_enabled, cgst_rate, sgst_rate, service_charge_rate')
      .eq('id', params.restaurantId)
      .single()

    if (!restaurant) return { data: null, error: 'Restaurant not found' }
    if (!restaurant.ordering_enabled) return { data: null, error: 'Restaurant is not accepting orders currently' }

    // Validate table
    const { data: table } = await supabase
      .from('tables')
      .select('*')
      .eq('id', params.tableId)
      .eq('is_active', true)
      .single()

    if (!table) return { data: null, error: 'Invalid table' }

    // Validate items are available
    const itemIds = params.items.map(i => i.menuItemId)
    const { data: menuItems } = await supabase
      .from('menu_items')
      .select('id, name, price, is_available')
      .in('id', itemIds)
      .eq('restaurant_id', params.restaurantId)

    if (!menuItems || menuItems.length !== itemIds.length) {
      return { data: null, error: 'Some items are no longer available' }
    }

    const unavailable = menuItems.filter(mi => !mi.is_available)
    if (unavailable.length > 0) {
      return { data: null, error: `${unavailable.map(i => i.name).join(', ')} ${unavailable.length > 1 ? 'are' : 'is'} currently unavailable` }
    }

    const subtotal = params.items.reduce((sum, item) => {
      const menuItem = menuItems.find(mi => mi.id === item.menuItemId)
      return sum + (menuItem?.price || item.price) * item.quantity
    }, 0)

    const isTax = restaurant.tax_enabled ?? true
    const cgst = isTax ? Number(restaurant.cgst_rate ?? 2.5) : 0
    const sgst = isTax ? Number(restaurant.sgst_rate ?? 2.5) : 0
    const srvCharge = Number(restaurant.service_charge_rate ?? 0)
    const tax = Math.round((subtotal * (cgst + sgst) / 100) * 100) / 100
    const total = Math.round(subtotal + tax + (subtotal * srvCharge / 100))

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        restaurant_id: params.restaurantId,
        table_id: params.tableId,
        status: restaurant.auto_accept_orders ? 'accepted' : 'placed',
        subtotal,
        tax,
        discount: 0,
        total,
        customer_name: params.customerName || null,
        customer_phone: params.customerPhone || null,
        notes: params.notes || null,
      })
      .select()
      .single()

    if (orderError || !order) {
      return { data: null, error: 'Failed to place order. Please try again.' }
    }

    const orderItemsPayload = params.items.map(item => {
      const menuItem = menuItems.find(mi => mi.id === item.menuItemId)
      return {
        order_id: order.id,
        menu_item_id: item.menuItemId,
        item_name: item.name,
        price: menuItem?.price || item.price,
        quantity: item.quantity,
        special_instructions: item.specialInstructions || null,
      }
    })

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItemsPayload)

    if (itemsError) {
      await supabase.from('orders').delete().eq('id', order.id)
      return { data: null, error: 'Failed to place order. Please try again.' }
    }

    // Broadcast order placement across tabs and windows
    try {
      localStorage.setItem('deccan_latest_order', JSON.stringify({
        id: order.id,
        restaurant_id: order.restaurant_id,
        timestamp: Date.now()
      }))
      window.dispatchEvent(new CustomEvent('deccan-order-placed', { detail: order }))
    } catch {
      // Ignored
    }

    return { data: order as Order, error: null }
  },

  async updateStatus(
    orderId: string,
    status: string,
    rejectionReason?: string
  ): Promise<{ error: Error | null }> {
    if (!isSupabaseConfigured) {
      const orders = demoStore.getOrders().map(o =>
        o.id === orderId
          ? {
              ...o,
              status: status as Order['status'],
              rejection_reason: rejectionReason || o.rejection_reason,
              updated_at: new Date().toISOString(),
            }
          : o
      )
      demoStore.setOrders(orders)
      return { error: null }
    }

    const updates: Record<string, unknown> = { status }
    if (rejectionReason) updates.rejection_reason = rejectionReason

    const { error } = await supabase
      .from('orders')
      .update(updates)
      .eq('id', orderId)

    return { error: error as Error | null }
  },

  async cancelOrder(orderId: string, reason = 'Cancelled by customer'): Promise<{ error: Error | null }> {
    return this.updateStatus(orderId, 'cancelled', reason)
  },

  async deleteOrder(orderId: string): Promise<{ error: Error | null }> {
    if (!isSupabaseConfigured) {
      const orders = demoStore.getOrders().filter(o => o.id !== orderId)
      demoStore.setOrders(orders)
      return { error: null }
    }

    // Try deleting order_items first
    await supabase.from('order_items').delete().eq('order_id', orderId)
    const { error } = await supabase.from('orders').delete().eq('id', orderId)
    if (error) {
      // If foreign key constraint or bill attached, gracefully fallback to cancelling
      return this.updateStatus(orderId, 'cancelled', 'Cancelled and removed')
    }
    return { error: null }
  },

  async getAllByTable(tableId: string): Promise<Order[]> {
    if (!isSupabaseConfigured) {
      return demoStore.getOrders().filter(o => o.table_id === tableId)
    }

    const { data, error } = await supabase
      .from('orders')
      .select('*, order_items(*), table:tables(*)')
      .eq('table_id', tableId)
      .order('created_at', { ascending: false })

    if (error) return []
    return data as Order[]
  },

  async getActiveByTable(tableId: string): Promise<Order[]> {
    if (!isSupabaseConfigured) {
      return demoStore.getOrders().filter(o =>
        o.table_id === tableId && o.status !== 'served' && o.status !== 'cancelled'
      )
    }

    const { data, error } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('table_id', tableId)
      .not('status', 'in', '("served","cancelled")')
      .order('created_at', { ascending: false })

    if (error) return []
    return data as Order[]
  },
}

// ============================================
// ANALYTICS SERVICES
// ============================================

export const analyticsService = {
  async getDashboardStats(restaurantId: string) {
    if (!isSupabaseConfigured) {
      const orders = demoStore.getOrders()
      const tables = demoStore.getTables()

      const todayRevenue = orders
        .filter(o => o.status !== 'cancelled')
        .reduce((sum, o) => sum + (o.total || 0), 0)

      const pendingOrders = orders.filter(o =>
        ['placed', 'accepted', 'preparing'].includes(o.status)
      ).length

      const activeTables = tables.filter(
        t => t.status === 'occupied' || t.status === 'ordering'
      ).length

      return {
        todayOrders: orders.length,
        todayRevenue,
        pendingOrders,
        activeTables,
        orders,
      }
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const [ordersResult, pendingResult, tablesResult] = await Promise.all([
      supabase
        .from('orders')
        .select('total, status, created_at')
        .eq('restaurant_id', restaurantId)
        .gte('created_at', today.toISOString()),
      supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('restaurant_id', restaurantId)
        .in('status', ['placed', 'accepted', 'preparing']),
      supabase
        .from('tables')
        .select('status')
        .eq('restaurant_id', restaurantId)
        .eq('is_active', true),
    ])

    const orders = ordersResult.data || []
    const todayRevenue = orders
      .filter(o => o.status !== 'cancelled')
      .reduce((sum, o) => sum + (o.total || 0), 0)

    const activeTables = (tablesResult.data || []).filter(
      t => t.status === 'occupied' || t.status === 'ordering'
    ).length

    return {
      todayOrders: orders.length,
      todayRevenue,
      pendingOrders: pendingResult.count || 0,
      activeTables,
      orders,
    }
  },

  async getPopularItems(restaurantId: string, limit = 5) {
    if (!isSupabaseConfigured) {
      const orders = demoStore.getOrders()
      const aggregated: Record<string, number> = {}

      orders.forEach(o => {
        o.order_items?.forEach(i => {
          aggregated[i.item_name] = (aggregated[i.item_name] || 0) + i.quantity
        })
      })

      return Object.entries(aggregated)
        .sort(([, a], [, b]) => b - a)
        .slice(0, limit)
        .map(([name, count]) => ({ name, count }))
    }

    const { data, error } = await supabase
      .from('order_items')
      .select('item_name, quantity')
      .order('quantity', { ascending: false })

    if (error || !data) return []

    const aggregated = data.reduce((acc, item) => {
      if (!acc[item.item_name]) acc[item.item_name] = 0
      acc[item.item_name] += item.quantity
      return acc
    }, {} as Record<string, number>)

    return Object.entries(aggregated)
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([name, count]) => ({ name, count }))
  },
}

// Re-export billing services and calculations
export { billingService } from './billingService'
export { calculateBill } from './billingCalculator'
export { thermalPrinterService } from './printerService'
export { staffService } from './staffService'

