import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import type { Bill, BillItem, Payment, Restaurant, DiscountType, Order } from '@/types/database'
import { calculateBill } from './billingCalculator'
import { demoStore } from './demoStore'

export interface CreateBillOptions {
  orderId: string
  orderIds?: string[]
  restaurantId: string
  cashierName?: string
  cashierId?: string
  discountType?: DiscountType
  discountValue?: number
  notes?: string
}

export interface BillFilterOptions {
  status?: string
  dateFilter?: 'today' | 'yesterday' | 'week' | 'month' | 'all'
  searchQuery?: string
}

export const billingService = {
  /**
   * Generates a bill from an existing order (or multiple combined orders for the same table),
   * with automated calculations and sequential bill numbering.
   * If an active (non-cancelled) bill already exists for this order, returns that bill to prevent duplicates.
   */
  async generateBillFromOrder(options: CreateBillOptions): Promise<{ data: Bill | null; error: string | null }> {
    const { orderId, restaurantId, cashierName = 'Staff', cashierId, discountType = 'none', discountValue = 0, notes } = options

    if (!isSupabaseConfigured) {
      return demoStore.createBillFromOrder(options)
    }

    try {
      const targetOrderIds = options.orderIds && options.orderIds.length > 0
        ? Array.from(new Set(options.orderIds))
        : [orderId]

      // 1. Check if an active bill already exists for any of these orders
      const { data: existingBills, error: checkError } = await supabase
        .from('bills')
        .select('*, bill_items(*), payments(*)')
        .in('order_id', targetOrderIds)
        .neq('status', 'CANCELLED')
        .order('created_at', { ascending: false })
        .limit(1)

      if (!checkError && existingBills && existingBills.length > 0) {
        return { data: existingBills[0] as Bill, error: null }
      }

      // 2. Fetch Orders and Order Items
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('*, table:tables(*), order_items(*)')
        .in('id', targetOrderIds)

      if (ordersError || !ordersData || ordersData.length === 0) {
        return { data: null, error: 'Orders not found or inaccessible.' }
      }

      const orders = ordersData as Order[]
      const primaryOrder = orders.find(o => o.id === orderId) || orders[0]
      const isCombined = targetOrderIds.length > 1
      const orderNumbersStr = orders.map(o => `#${o.order_number}`).join(', ')

      // 3. Fetch Restaurant Settings for tax rates & currency
      const { data: restData } = await supabase
        .from('restaurants')
        .select('*')
        .eq('id', restaurantId)
        .single()

      const restaurant = restData as Restaurant | null

      // Combine items from all selected orders
      const allOrderItems = orders.flatMap(o => (o.order_items || []).map(item => ({
        ...item,
        order_number: o.order_number
      })))

      const itemsForCalc = allOrderItems.map(item => ({
        price: Number(item.price ?? item.item_price ?? 0),
        quantity: item.quantity,
        item_name: item.item_name,
      }))

      // Centralized calculation
      const calc = calculateBill({
        items: itemsForCalc,
        discountType,
        discountValue,
        taxEnabled: restaurant?.tax_enabled ?? true,
        cgstRate: Number(restaurant?.cgst_rate ?? 2.5),
        sgstRate: Number(restaurant?.sgst_rate ?? 2.5),
        serviceChargeRate: Number(restaurant?.service_charge_rate ?? 0),
      })

      // 4. Generate unique bill number from PostgreSQL sequence
      const { data: numData } = await supabase.rpc('generate_bill_number')
      const billNumber = (numData as string) || `INV-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`

      // 5. Insert into bills table
      const { data: newBill, error: billError } = await supabase
        .from('bills')
        .insert({
          bill_number: billNumber,
          restaurant_id: restaurantId,
          order_id: primaryOrder.id,
          order_ids: targetOrderIds,
          order_numbers: orderNumbersStr,
          is_combined: isCombined,
          table_id: primaryOrder.table_id,
          table_number: primaryOrder.table?.table_number || null,
          order_number: primaryOrder.order_number,
          customer_name: primaryOrder.customer_name || orders.find(o => o.customer_name)?.customer_name || null,
          customer_phone: primaryOrder.customer_phone || orders.find(o => o.customer_phone)?.customer_phone || null,
          cashier_name: cashierName,
          cashier_id: cashierId || null,
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
          notes: notes || null,
        })
        .select()
        .single()

      if (billError || !newBill) {
        return { data: null, error: billError?.message || 'Failed to create bill record.' }
      }

      // 6. Insert bill items snapshot
      const billItemsToInsert = allOrderItems.map(item => ({
        bill_id: newBill.id,
        menu_item_id: item.menu_item_id,
        item_name: item.item_name,
        item_price: Number(item.price ?? item.item_price ?? 0),
        quantity: item.quantity,
        item_total: Number(item.price ?? item.item_price ?? 0) * item.quantity,
        notes: isCombined 
          ? `Order #${item.order_number}${item.notes || item.special_instructions ? ' • ' + (item.notes || item.special_instructions) : ''}`
          : (item.notes || item.special_instructions || null),
      }))

      if (billItemsToInsert.length > 0) {
        await supabase.from('bill_items').insert(billItemsToInsert)
      }

      // 7. Re-fetch full bill with relations
      const finalBill = await this.getBillById(newBill.id)
      return { data: finalBill, error: null }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unexpected billing error'
      return { data: null, error: msg }
    }
  },

  /**
   * Retrieves single bill with bill_items, restaurant info, and payment records
   */
  async getBillById(billId: string): Promise<Bill | null> {
    if (!isSupabaseConfigured) {
      return demoStore.getBillById(billId)
    }

    const { data, error } = await supabase
      .from('bills')
      .select('*, bill_items(*), payments(*), restaurant:restaurants(*)')
      .eq('id', billId)
      .single()

    if (error || !data) return null
    return data as Bill
  },

  /**
   * Finds active bill for an order
   */
  async getBillByOrderId(orderId: string): Promise<Bill | null> {
    if (!isSupabaseConfigured) {
      return demoStore.getBillByOrderId(orderId)
    }

    const { data, error } = await supabase
      .from('bills')
      .select('*, bill_items(*), payments(*), restaurant:restaurants(*)')
      .eq('order_id', orderId)
      .neq('status', 'CANCELLED')
      .order('created_at', { ascending: false })
      .limit(1)

    if (error || !data || data.length === 0) return null
    return data[0] as Bill
  },

  /**
   * Fetches bills list for a restaurant with flexible filtering
   */
  async getBillsByRestaurant(restaurantId: string, options: BillFilterOptions = {}): Promise<Bill[]> {
    if (!isSupabaseConfigured) {
      return demoStore.getBills(restaurantId, options)
    }

    let query = supabase
      .from('bills')
      .select('*, bill_items(*), payments(*), restaurant:restaurants(*)')
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false })

    if (options.status && options.status !== 'all') {
      query = query.eq('status', options.status)
    }

    // Date filtering
    const now = new Date()
    if (options.dateFilter === 'today') {
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
      query = query.gte('created_at', startOfDay)
    } else if (options.dateFilter === 'yesterday') {
      const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
      const endOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      query = query
        .gte('created_at', startOfYesterday.toISOString())
        .lt('created_at', endOfYesterday.toISOString())
    } else if (options.dateFilter === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
      query = query.gte('created_at', weekAgo)
    } else if (options.dateFilter === 'month') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
      query = query.gte('created_at', startOfMonth)
    }

    const { data, error } = await query
    if (error || !data) return []

    let results = data as Bill[]

    // Optional frontend search filter (bill number, order number, table, etc.)
    if (options.searchQuery?.trim()) {
      const q = options.searchQuery.trim().toLowerCase()
      results = results.filter(b => 
        b.bill_number.toLowerCase().includes(q) ||
        String(b.order_number || '').toLowerCase().includes(q) ||
        String(b.table_number || '').toLowerCase().includes(q) ||
        (b.customer_name && b.customer_name.toLowerCase().includes(q)) ||
        (b.payments && b.payments.some(p => p.transaction_reference.toLowerCase().includes(q)))
      )
    }

    return results
  },

  /**
   * Creates a verified UPI payment intent with dynamic transaction ID & UPI payload
   */
  async createUPIPayment(billId: string): Promise<{ payment: Payment | null; qrData: string | null; error: string | null }> {
    const bill = await this.getBillById(billId)
    if (!bill) return { payment: null, qrData: null, error: 'Bill not found' }

    if (bill.status === 'PAID') {
      return { payment: null, qrData: null, error: 'Bill is already marked as PAID.' }
    }
    if (bill.status === 'CANCELLED') {
      return { payment: null, qrData: null, error: 'Cannot create payment for a cancelled bill.' }
    }

    const restaurant = bill.restaurant || (await supabase.from('restaurants').select('*').eq('id', bill.restaurant_id).single()).data as Restaurant

    const upiId = restaurant?.upi_id || '8309653769@upi'
    const merchantName = restaurant?.upi_merchant_name || restaurant?.name || 'Urban Bites'
    const amount = Number(bill.grand_total).toFixed(2)
    const txnRef = `TXN${Date.now()}${Math.floor(1000 + Math.random() * 9000)}`

    // Standard NPCI UPI URI scheme
    const qrData = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(merchantName)}&am=${amount}&cu=INR&tn=${encodeURIComponent('Bill ' + bill.bill_number)}&tr=${txnRef}`

    if (!isSupabaseConfigured) {
      const payment: Payment = {
        id: `pay-${Date.now()}`,
        bill_id: bill.id,
        order_id: bill.order_id,
        restaurant_id: bill.restaurant_id,
        amount: Number(amount),
        payment_method: 'UPI',
        gateway: restaurant?.gateway_provider || 'mock_upi',
        transaction_reference: txnRef,
        status: 'PENDING',
        upi_id: upiId,
        qr_data: qrData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      demoStore.addPayment(payment)
      return { payment, qrData, error: null }
    }

    const { data: paymentRecord, error: payError } = await supabase
      .from('payments')
      .insert({
        bill_id: bill.id,
        order_id: bill.order_id,
        restaurant_id: bill.restaurant_id,
        amount: Number(amount),
        payment_method: 'UPI',
        gateway: restaurant?.gateway_provider || 'mock_upi',
        transaction_reference: txnRef,
        status: 'PENDING',
        upi_id: upiId,
        qr_data: qrData,
      })
      .select()
      .single()

    if (payError || !paymentRecord) {
      return { payment: null, qrData: null, error: payError?.message || 'Failed to create payment transaction' }
    }

    return { payment: paymentRecord as Payment, qrData, error: null }
  },

  /**
   * Verifies UPI Payment through backend check and completes billing workflow.
   * Requirement 20 & 21:
   * Payment Verified -> Payment=PAID -> Bill=PAID -> Table available
   */
  async verifyPayment(paymentId: string): Promise<{ success: boolean; bill: Bill | null; error: string | null }> {
    if (!isSupabaseConfigured) {
      return demoStore.verifyPayment(paymentId)
    }

    try {
      const { data: payment, error: pError } = await supabase
        .from('payments')
        .select('*, bill:bills(*)')
        .eq('id', paymentId)
        .single()

      if (pError || !payment) {
        return { success: false, bill: null, error: 'Payment record not found' }
      }

      if (payment.status === 'PAID') {
        const currentBill = await this.getBillById(payment.bill_id)
        return { success: true, bill: currentBill, error: null }
      }

      const now = new Date().toISOString()

      // 1. Update Payment record to PAID
      await supabase
        .from('payments')
        .update({
          status: 'PAID',
          paid_at: now,
          updated_at: now,
        })
        .eq('id', paymentId)

      // 2. Update Bill record to PAID
      await supabase
        .from('bills')
        .update({
          status: 'PAID',
          paid_at: now,
          payment_method: payment.payment_method || 'UPI',
          updated_at: now,
        })
        .eq('id', payment.bill_id)

      // 3. Update Table Status to 'available' if bill has table_id
      if (payment.bill?.table_id) {
        await supabase
          .from('tables')
          .update({
            status: 'available',
            updated_at: now,
          })
          .eq('id', payment.bill.table_id)
      }

      // 4. Update Order(s) Status to 'served' if not already completed
      const orderIdsToMark = (payment.bill?.order_ids && payment.bill.order_ids.length > 0)
        ? payment.bill.order_ids
        : (payment.order_id ? [payment.order_id] : (payment.bill?.order_id ? [payment.bill.order_id] : []))

      if (orderIdsToMark.length > 0) {
        await supabase
          .from('orders')
          .update({
            status: 'served',
            updated_at: now,
          })
          .in('id', orderIdsToMark)
      }

      const updatedBill = await this.getBillById(payment.bill_id)
      return { success: true, bill: updatedBill, error: null }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Payment verification failed'
      return { success: false, bill: null, error: msg }
    }
  },

  /**
   * Processes cash payment for a bill, records cash transaction, liberates table, and closes bill
   */
  async collectCashPayment(
    billId: string,
    cashTendered: number,
    notes?: string
  ): Promise<{ success: boolean; bill: Bill | null; changeDue: number; error: string | null }> {
    const bill = await this.getBillById(billId)
    if (!bill) return { success: false, bill: null, changeDue: 0, error: 'Bill not found' }

    if (bill.status === 'PAID') {
      return { success: true, bill, changeDue: 0, error: null }
    }
    if (bill.status === 'CANCELLED') {
      return { success: false, bill: null, changeDue: 0, error: 'Cannot pay a cancelled bill.' }
    }

    const total = Number(bill.grand_total)
    if (cashTendered < total) {
      return {
        success: false,
        bill: null,
        changeDue: 0,
        error: `Tendered cash (₹${cashTendered}) is less than grand total (₹${total}).`,
      }
    }

    const changeDue = Math.round((cashTendered - total) * 100) / 100
    const txnRef = `CASH${Date.now()}${Math.floor(100 + Math.random() * 900)}`
    const now = new Date().toISOString()

    if (!isSupabaseConfigured) {
      const payment: Payment = {
        id: `pay-cash-${Date.now()}`,
        bill_id: bill.id,
        order_id: bill.order_id,
        restaurant_id: bill.restaurant_id,
        amount: total,
        payment_method: 'CASH',
        gateway: 'cash_register',
        transaction_reference: txnRef,
        status: 'PAID',
        created_at: now,
        paid_at: now,
        updated_at: now,
      }
      demoStore.addPayment(payment)
      const res = demoStore.verifyPayment(payment.id)
      return { success: true, bill: res.bill, changeDue, error: null }
    }

    try {
      // 1. Insert Cash Payment
      await supabase
        .from('payments')
        .insert({
          bill_id: bill.id,
          order_id: bill.order_id,
          restaurant_id: bill.restaurant_id,
          amount: total,
          payment_method: 'CASH',
          gateway: 'cash_register',
          transaction_reference: txnRef,
          status: 'PAID',
          paid_at: now,
        })

      // 2. Mark Bill as PAID with CASH
      await supabase
        .from('bills')
        .update({
          status: 'PAID',
          payment_method: 'CASH',
          paid_at: now,
          updated_at: now,
        })
        .eq('id', bill.id)

      // 3. Mark Table as Available
      if (bill.table_id) {
        await supabase
          .from('tables')
          .update({
            status: 'available',
            updated_at: now,
          })
          .eq('id', bill.table_id)
      }

      // 4. Mark Order(s) as Served
      const orderIdsToMark = (bill.order_ids && bill.order_ids.length > 0)
        ? bill.order_ids
        : (bill.order_id ? [bill.order_id] : [])

      if (orderIdsToMark.length > 0) {
        await supabase
          .from('orders')
          .update({
            status: 'served',
            updated_at: now,
          })
          .in('id', orderIdsToMark)
      }

      const updatedBill = await this.getBillById(bill.id)
      return { success: true, bill: updatedBill, changeDue, error: null }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to record cash payment'
      return { success: false, bill: null, changeDue: 0, error: msg }
    }
  },

  /**
   * Cancels an unpaid bill with audit trail
   */
  async cancelBill(billId: string, reason: string, cancelledBy = 'Admin'): Promise<{ success: boolean; error: string | null }> {
    const bill = await this.getBillById(billId)
    if (!bill) return { success: false, error: 'Bill not found' }

    if (bill.status === 'PAID') {
      return { success: false, error: 'A PAID bill cannot be cancelled directly. Please process a refund or contact administrator.' }
    }

    if (!isSupabaseConfigured) {
      return demoStore.cancelBill(billId, reason, cancelledBy)
    }

    const now = new Date().toISOString()
    const { error } = await supabase
      .from('bills')
      .update({
        status: 'CANCELLED',
        cancellation_reason: reason,
        cancelled_by: cancelledBy,
        cancelled_at: now,
        updated_at: now,
      })
      .eq('id', billId)

    if (error) return { success: false, error: error.message }
    return { success: true, error: null }
  },

  /**
   * Tracks receipt print count
   */
  async recordPrint(billId: string): Promise<void> {
    if (!isSupabaseConfigured) {
      demoStore.recordPrint(billId)
      return
    }

    const { data: bill } = await supabase.from('bills').select('print_count').eq('id', billId).single()
    const currentCount = bill?.print_count || 0
    await supabase
      .from('bills')
      .update({ print_count: currentCount + 1 })
      .eq('id', billId)
  },

  /**
   * Fetches real-time dashboard billing analytics
   */
  async getDashboardBillingMetrics(restaurantId: string): Promise<{
    todaySales: number
    todayBills: number
    todayUpi: number
    pendingPayments: number
    cancelledBills: number
  }> {
    if (!isSupabaseConfigured) {
      return demoStore.getDashboardBillingMetrics(restaurantId)
    }

    const now = new Date()
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()

    const { data: bills, error } = await supabase
      .from('bills')
      .select('grand_total, status, payment_method, created_at')
      .eq('restaurant_id', restaurantId)
      .gte('created_at', startOfDay)

    if (error || !bills) {
      return {
        todaySales: 0,
        todayBills: 0,
        todayUpi: 0,
        pendingPayments: 0,
        cancelledBills: 0,
      }
    }

    let todaySales = 0
    let todayBills = 0
    let todayUpi = 0
    let pendingPayments = 0
    let cancelledBills = 0

    for (const b of bills) {
      todayBills++
      if (b.status === 'PAID') {
        const val = Number(b.grand_total) || 0
        todaySales += val
        if (b.payment_method === 'UPI') {
          todayUpi += val
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
