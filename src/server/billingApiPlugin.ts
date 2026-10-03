import type { Plugin, ViteDevServer } from 'vite'
import { Client } from 'pg'
import type { IncomingMessage, ServerResponse } from 'http'

// Database credentials
const PG_CONFIG = {
  host: 'aws-0-ap-southeast-1.pooler.supabase.com',
  port: 5432,
  user: 'postgres.dryjlcidublougfnpypn',
  password: 'Manoj@minnu27',
  database: 'postgres',
  ssl: { rejectUnauthorized: false },
}

async function getPgClient() {
  const client = new Client(PG_CONFIG)
  await client.connect()
  return client
}

function parseJsonBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve) => {
    let body = ''
    req.on('data', chunk => { body += chunk })
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {})
      } catch {
        resolve({})
      }
    })
  })
}

function sendJson(res: ServerResponse, statusCode: number, data: any) {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(data))
}

export function billingApiPlugin(): Plugin {
  return {
    name: 'vite-billing-api-plugin',
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) {
          return next()
        }

        const url = new URL(req.url, 'http://localhost')
        const pathname = url.pathname
        const method = req.method

        try {
          // 1. GET /api/bills
          if (pathname === '/api/bills' && method === 'GET') {
            const restaurantId = url.searchParams.get('restaurant_id')
            const status = url.searchParams.get('status')
            const client = await getPgClient()
            try {
              let query = `
                SELECT b.*, 
                  COALESCE(json_agg(bi.*) FILTER (WHERE bi.id IS NOT NULL), '[]') as bill_items,
                  COALESCE(json_agg(p.*) FILTER (WHERE p.id IS NOT NULL), '[]') as payments
                FROM bills b
                LEFT JOIN bill_items bi ON bi.bill_id = b.id
                LEFT JOIN payments p ON p.bill_id = b.id
              `
              const params: any[] = []
              const where: string[] = []

              if (restaurantId) {
                params.push(restaurantId)
                where.push(`b.restaurant_id = $${params.length}`)
              }
              if (status && status !== 'all') {
                params.push(status)
                where.push(`b.status = $${params.length}`)
              }

              if (where.length > 0) {
                query += ' WHERE ' + where.join(' AND ')
              }
              query += ' GROUP BY b.id ORDER BY b.created_at DESC LIMIT 100;'

              const result = await client.query(query, params)
              return sendJson(res, 200, { success: true, data: result.rows })
            } finally {
              await client.end()
            }
          }

          // 2. GET /api/bills/:id
          const singleBillMatch = pathname.match(/^\/api\/bills\/([a-zA-Z0-9-]+)$/)
          if (singleBillMatch && method === 'GET') {
            const billId = singleBillMatch[1]
            const client = await getPgClient()
            try {
              const bRes = await client.query('SELECT * FROM bills WHERE id = $1;', [billId])
              if (bRes.rows.length === 0) {
                return sendJson(res, 404, { success: false, error: 'Bill not found' })
              }
              const bill = bRes.rows[0]
              const itemsRes = await client.query('SELECT * FROM bill_items WHERE bill_id = $1;', [billId])
              const payRes = await client.query('SELECT * FROM payments WHERE bill_id = $1;', [billId])
              const restRes = await client.query('SELECT * FROM restaurants WHERE id = $1;', [bill.restaurant_id])
              return sendJson(res, 200, {
                success: true,
                data: {
                  ...bill,
                  bill_items: itemsRes.rows,
                  payments: payRes.rows,
                  restaurant: restRes.rows[0] || null,
                },
              })
            } finally {
              await client.end()
            }
          }

          // 3. POST /api/bills (Generate bill)
          if (pathname === '/api/bills' && method === 'POST') {
            const body = await parseJsonBody(req)
            const { order_id, restaurant_id, cashier_name, discount_type = 'none', discount_value = 0 } = body
            if (!order_id || !restaurant_id) {
              return sendJson(res, 400, { success: false, error: 'Missing order_id or restaurant_id' })
            }

            const client = await getPgClient()
            try {
              // Check existing
              const existing = await client.query(
                "SELECT id, bill_number FROM bills WHERE order_id = $1 AND status != 'CANCELLED' LIMIT 1;",
                [order_id]
              )
              if (existing.rows.length > 0) {
                return sendJson(res, 200, { success: true, data: existing.rows[0], message: 'Bill already exists' })
              }

              // Fetch order & items
              const ordRes = await client.query('SELECT * FROM orders WHERE id = $1;', [order_id])
              if (ordRes.rows.length === 0) {
                return sendJson(res, 404, { success: false, error: 'Order not found' })
              }
              const order = ordRes.rows[0]
              const itemsRes = await client.query('SELECT * FROM order_items WHERE order_id = $1;', [order_id])
              const restRes = await client.query('SELECT * FROM restaurants WHERE id = $1;', [restaurant_id])
              const rest = restRes.rows[0]

              // Calculate
              let subtotal = 0
              for (const it of itemsRes.rows) {
                subtotal += Number(it.price || it.item_price || 0) * it.quantity
              }
              let discAmount = 0
              if (discount_type === 'percentage') {
                discAmount = (subtotal * Math.min(Number(discount_value) || 0, 100)) / 100
              } else if (discount_type === 'fixed') {
                discAmount = Math.min(Number(discount_value) || 0, subtotal)
              }
              const taxable = Math.max(0, subtotal - discAmount)
              const cgstRate = rest?.tax_enabled ? Number(rest.cgst_rate || 2.5) : 0
              const sgstRate = rest?.tax_enabled ? Number(rest.sgst_rate || 2.5) : 0
              const cgstAmount = Math.round(((taxable * cgstRate) / 100) * 100) / 100
              const sgstAmount = Math.round(((taxable * sgstRate) / 100) * 100) / 100
              const taxAmount = cgstAmount + sgstAmount
              const totalPreRound = taxable + taxAmount
              const grandTotal = Math.round(totalPreRound)
              const roundOff = Math.round((grandTotal - totalPreRound) * 100) / 100

              // Generate bill number
              const numRes = await client.query('SELECT generate_bill_number() as num;')
              const billNumber = numRes.rows[0].num

              // Insert bill
              const insBill = await client.query(`
                INSERT INTO bills (
                  bill_number, restaurant_id, order_id, table_id,
                  order_number, cashier_name, subtotal, discount_type,
                  discount_value, discount_amount, cgst_rate, sgst_rate,
                  cgst_amount, sgst_amount, tax_amount, round_off,
                  grand_total, status, payment_method
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, 'PENDING_PAYMENT', 'UPI')
                RETURNING *;
              `, [
                billNumber, restaurant_id, order.id, order.table_id,
                order.order_number, cashier_name || 'Staff', subtotal, discount_type,
                discount_value, discAmount, cgstRate, sgstRate,
                cgstAmount, sgstAmount, taxAmount, roundOff,
                grandTotal
              ])

              const bill = insBill.rows[0]

              // Insert bill items
              for (const it of itemsRes.rows) {
                const itemPrice = Number(it.price || it.item_price || 0)
                await client.query(`
                  INSERT INTO bill_items (bill_id, menu_item_id, item_name, item_price, quantity, item_total)
                  VALUES ($1, $2, $3, $4, $5, $6);
                `, [bill.id, it.menu_item_id, it.item_name, itemPrice, it.quantity, itemPrice * it.quantity])
              }

              return sendJson(res, 201, { success: true, data: bill })
            } finally {
              await client.end()
            }
          }

          // 4. POST /api/payments/create
          if (pathname === '/api/payments/create' && method === 'POST') {
            const body = await parseJsonBody(req)
            const { bill_id } = body
            if (!bill_id) return sendJson(res, 400, { success: false, error: 'Missing bill_id' })

            const client = await getPgClient()
            try {
              const bRes = await client.query('SELECT * FROM bills WHERE id = $1;', [bill_id])
              if (bRes.rows.length === 0) return sendJson(res, 404, { success: false, error: 'Bill not found' })
              const bill = bRes.rows[0]
              const restRes = await client.query('SELECT * FROM restaurants WHERE id = $1;', [bill.restaurant_id])
              const rest = restRes.rows[0]

              const upiId = rest?.upi_id || '8309653769@upi'
              const merchant = rest?.upi_merchant_name || rest?.name || 'Restaurant'
              const txnRef = `TXN${Date.now()}${Math.floor(1000 + Math.random() * 9000)}`
              const qrData = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(merchant)}&am=${Number(bill.grand_total).toFixed(2)}&cu=INR&tn=${encodeURIComponent('Bill ' + bill.bill_number)}&tr=${txnRef}`

              const pIns = await client.query(`
                INSERT INTO payments (
                  bill_id, order_id, restaurant_id, amount,
                  payment_method, gateway, transaction_reference,
                  status, upi_id, qr_data
                ) VALUES ($1, $2, $3, $4, 'UPI', $5, $6, 'PENDING', $7, $8)
                RETURNING *;
              `, [
                bill.id, bill.order_id, bill.restaurant_id, bill.grand_total,
                rest?.gateway_provider || 'mock_upi', txnRef, upiId, qrData
              ])

              return sendJson(res, 200, { success: true, payment: pIns.rows[0], qrData })
            } finally {
              await client.end()
            }
          }

          // 5. GET /api/payments/:id/status
          const payStatusMatch = pathname.match(/^\/api\/payments\/([a-zA-Z0-9-]+)\/status$/)
          if (payStatusMatch && method === 'GET') {
            const paymentId = payStatusMatch[1]
            const client = await getPgClient()
            try {
              const pRes = await client.query('SELECT * FROM payments WHERE id = $1;', [paymentId])
              if (pRes.rows.length === 0) return sendJson(res, 404, { success: false, error: 'Payment not found' })
              return sendJson(res, 200, { success: true, data: pRes.rows[0] })
            } finally {
              await client.end()
            }
          }

          // 6. POST /api/payments/webhook
          if (pathname === '/api/payments/webhook' && method === 'POST') {
            const body = await parseJsonBody(req)
            const { payment_id, transaction_reference, status = 'PAID' } = body
            const client = await getPgClient()
            try {
              let pRes
              if (payment_id) {
                pRes = await client.query('SELECT * FROM payments WHERE id = $1;', [payment_id])
              } else if (transaction_reference) {
                pRes = await client.query('SELECT * FROM payments WHERE transaction_reference = $1;', [transaction_reference])
              }
              if (!pRes || pRes.rows.length === 0) {
                return sendJson(res, 404, { success: false, error: 'Payment not found for webhook' })
              }
              const payment = pRes.rows[0]

              // Idempotency: If already marked as paid
              if (payment.status === 'PAID') {
                return sendJson(res, 200, { success: true, message: 'Already processed (idempotent)' })
              }

              const now = new Date()
              await client.query("UPDATE payments SET status = $1, paid_at = $2, updated_at = $2 WHERE id = $3;", [status, now, payment.id])

              if (status === 'PAID') {
                await client.query("UPDATE bills SET status = 'PAID', paid_at = $1, updated_at = $1 WHERE id = $2;", [now, payment.bill_id])
                if (payment.order_id) {
                  await client.query("UPDATE orders SET status = 'served', updated_at = $1 WHERE id = $2;", [now, payment.order_id])
                }
                const bCheck = await client.query('SELECT table_id FROM bills WHERE id = $1;', [payment.bill_id])
                if (bCheck.rows[0]?.table_id) {
                  await client.query("UPDATE tables SET status = 'available', updated_at = $1 WHERE id = $2;", [now, bCheck.rows[0].table_id])
                }
              }

              return sendJson(res, 200, { success: true, message: 'Webhook processed successfully' })
            } finally {
              await client.end()
            }
          }

          // 7. POST /api/bills/:id/print or reprint
          const printMatch = pathname.match(/^\/api\/bills\/([a-zA-Z0-9-]+)\/(print|reprint)$/)
          if (printMatch && method === 'POST') {
            const billId = printMatch[1]
            const client = await getPgClient()
            try {
              const resUpdate = await client.query(
                'UPDATE bills SET print_count = COALESCE(print_count, 0) + 1, updated_at = NOW() WHERE id = $1 RETURNING print_count;',
                [billId]
              )
              return sendJson(res, 200, { success: true, print_count: resUpdate.rows[0]?.print_count || 1 })
            } finally {
              await client.end()
            }
          }

          // 8. POST /api/bills/:id/cancel
          const cancelMatch = pathname.match(/^\/api\/bills\/([a-zA-Z0-9-]+)\/cancel$/)
          if (cancelMatch && method === 'POST') {
            const billId = cancelMatch[1]
            const body = await parseJsonBody(req)
            const { reason = 'Cancelled by staff', cancelled_by = 'Admin' } = body
            const client = await getPgClient()
            try {
              const chk = await client.query('SELECT status FROM bills WHERE id = $1;', [billId])
              if (chk.rows.length === 0) return sendJson(res, 404, { success: false, error: 'Bill not found' })
              if (chk.rows[0].status === 'PAID') {
                return sendJson(res, 400, { success: false, error: 'Paid bills cannot be cancelled directly.' })
              }

              await client.query(`
                UPDATE bills SET 
                  status = 'CANCELLED',
                  cancellation_reason = $1,
                  cancelled_by = $2,
                  cancelled_at = NOW(),
                  updated_at = NOW()
                WHERE id = $3;
              `, [reason, cancelled_by, billId])

              return sendJson(res, 200, { success: true, message: 'Bill cancelled' })
            } finally {
              await client.end()
            }
          }

          return next()
        } catch (err: any) {
          console.error('API Error:', err.message)
          return sendJson(res, 500, { success: false, error: err.message })
        }
      })
    }
  }
}
