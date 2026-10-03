import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Trash2, MessageSquare, ShoppingBag } from 'lucide-react'
import { useCartStore } from '@/store/cartStore'
import { orderService, restaurantService, tableService } from '@/services'
import { FoodTypeIndicator } from '@/components/ui'
import { Button } from '@/components/ui/Button'
import { formatCurrency } from '@/lib/utils'
import { playCustomerOrderConfirmedSound } from '@/lib/soundEffects'
import type { Restaurant } from '@/types/database'
import toast from 'react-hot-toast'

export function CartPage() {
  const navigate = useNavigate()
  const { restaurantSlug, tableToken } = useParams<{ restaurantSlug: string; tableToken: string }>()
  const {
    items, updateQuantity, removeItem, updateInstructions,
    restaurantId, tableId, clearCart, tableNumber, setTableContext
  } = useCartStore()
  const [loading, setLoading] = useState(false)
  const [customerName, setCustomerName] = useState('')
  const [notes, setNotes] = useState('')
  const [editingInstructions, setEditingInstructions] = useState<string | null>(null)
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)

  useEffect(() => {
    const resolveContext = async () => {
      let r = restaurant
      if (!r) {
        if (restaurantId) {
          r = await restaurantService.getById(restaurantId)
        } else {
          r = await restaurantService.getBySlug(restaurantSlug || 'deccan-crm')
        }
        if (r) setRestaurant(r)
      }

      // Auto restore table context if lost or on refresh
      if (r && (!restaurantId || !tableId)) {
        const token = tableToken || 'samravaa-t01'
        let tbl = await tableService.getByToken(token)
        if (!tbl) {
          const allTables = await tableService.getByRestaurant(r.id)
          tbl = allTables[0] || null
        }
        if (tbl) {
          setTableContext({
            restaurantId: r.id,
            tableId: tbl.id,
            tableToken: tbl.qr_token,
            restaurantSlug: r.slug,
            tableNumber: tbl.table_number,
          })
        }
      }
    }
    resolveContext()
  }, [restaurantId, tableId, restaurantSlug, tableToken, setTableContext])

  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0)
  
  // Dynamic Tax Calculation from Restaurant Profile
  const taxEnabled = restaurant?.tax_enabled ?? true
  const cgstRate = taxEnabled ? Number(restaurant?.cgst_rate ?? 2.5) : 0
  const sgstRate = taxEnabled ? Number(restaurant?.sgst_rate ?? 2.5) : 0
  const totalTaxRate = cgstRate + sgstRate
  const tax = taxEnabled ? Math.round((subtotal * totalTaxRate / 100) * 100) / 100 : 0
  
  // Optional Service Charge / Additional Fee
  const serviceChargeRate = Number(restaurant?.service_charge_rate ?? 0)
  const serviceCharge = serviceChargeRate > 0 ? Math.round((subtotal * serviceChargeRate / 100) * 100) / 100 : 0
  
  const total = Math.round(subtotal + tax + serviceCharge)

  const handlePlaceOrder = async () => {
    if (items.length === 0) return

    let activeRestId = restaurantId || restaurant?.id
    let activeTableId = tableId

    if (!activeRestId) {
      const r = await restaurantService.getBySlug(restaurantSlug || 'deccan-crm')
      if (r) activeRestId = r.id
    }

    if (!activeTableId && activeRestId) {
      const token = tableToken || 'samravaa-t01'
      let tbl = await tableService.getByToken(token)
      if (!tbl) {
        const all = await tableService.getByRestaurant(activeRestId)
        tbl = all[0] || null
      }
      if (tbl) activeTableId = tbl.id
    }

    if (!activeRestId || !activeTableId) {
      toast.error('Unable to verify table session. Please re-scan table QR code.')
      return
    }

    setLoading(true)
    const { data: order, error } = await orderService.place({
      restaurantId: activeRestId,
      tableId: activeTableId,
      items,
      customerName: customerName || undefined,
      notes: notes || undefined,
    })
    setLoading(false)

    if (error) {
      toast.error(error)
    } else if (order) {
      // Save order to customer local session history for this table
      try {
        const key = `customer_orders_${tableId}`
        const existing = JSON.parse(localStorage.getItem(key) || '[]')
        if (!existing.includes(order.id)) {
          existing.push(order.id)
          localStorage.setItem(key, JSON.stringify(existing))
        }
      } catch (err) {
        console.error('Failed to save order to session:', err)
      }

      playCustomerOrderConfirmedSound()
      clearCart()
      navigate(`/menu/${restaurantSlug}/table/${tableToken}/order/${order.id}`)
    }
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-[var(--color-background)] flex flex-col">
        <div className="bg-[var(--color-surface)] px-4 py-4 border-b border-[var(--color-border-subtle)] flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="btn btn-ghost btn-icon"
            aria-label="Go back"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="font-semibold text-lg">Your Cart</h1>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <div className="w-20 h-20 bg-[var(--color-background)] rounded-2xl border-2 border-dashed border-[var(--color-border)] flex items-center justify-center mb-4">
            <ShoppingBag size={32} className="text-[var(--color-text-tertiary)]" />
          </div>
          <h2 className="text-lg font-semibold mb-2">Your cart is empty</h2>
          <p className="text-[var(--color-text-secondary)] text-sm mb-6">
            Add items from the menu to get started
          </p>
          <Button onClick={() => navigate(-1)}>
            Browse Menu
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--color-background)] pb-32">
      {/* Header */}
      <div className="bg-[var(--color-surface)]/90 backdrop-blur-md px-4 py-4 border-b border-[var(--color-border-subtle)] sticky top-0 z-40 flex items-center gap-3 shadow-sm transition-all">
        <button onClick={() => navigate(-1)} className="btn btn-ghost btn-icon hover:bg-[var(--color-background)]" aria-label="Go back">
          <ArrowLeft size={20} className="text-[var(--color-text-primary)]" />
        </button>
        <div>
          <h1 className="font-semibold text-[var(--color-text-primary)] text-lg leading-tight">Your Order</h1>
          <p className="text-xs text-[var(--color-text-tertiary)] font-medium">Table {tableNumber}</p>
        </div>
      </div>

      <div className="px-4 py-6 space-y-6 max-w-2xl mx-auto">
        {/* Cart Items */}
        <div className="card overflow-hidden border border-[var(--color-border-subtle)] shadow-sm">
          <AnimatePresence>
            {items.map((item, i) => (
              <motion.div
                key={item.menuItemId}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className={i > 0 ? 'border-t border-[var(--color-border-subtle)]' : ''}
              >
                <div className="p-5">
                  <div className="flex items-start gap-4">
                    {/* Image */}
                    {item.image_url && (
                      <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 border border-[var(--color-border-subtle)] bg-[var(--color-background)]">
                        <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                      </div>
                    )}

                    {/* Details */}
                    <div className="flex-1 min-w-0 pt-0.5">
                      <div className="flex items-start gap-2 mb-1">
                        <div className="mt-0.5">
                          <FoodTypeIndicator type={item.food_type} />
                        </div>
                        <span className="font-medium text-[var(--color-text-primary)] text-sm leading-snug">{item.name}</span>
                      </div>
                      <div className="text-sm font-semibold text-[var(--color-text-primary)] mt-1">
                        {formatCurrency(item.price)}
                      </div>
                    </div>

                    {/* Quantity Controls */}
                    <div className="flex items-center gap-3 bg-[var(--color-background)] p-1 rounded-xl border border-[var(--color-border-subtle)] flex-shrink-0">
                      <button
                        onClick={() => updateQuantity(item.menuItemId, item.quantity - 1)}
                        className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center font-bold text-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
                        aria-label="Decrease quantity"
                      >
                        −
                      </button>
                      <span className="w-4 text-center font-semibold text-sm">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.menuItemId, item.quantity + 1)}
                        className="w-8 h-8 rounded-lg bg-[var(--color-accent)] shadow-sm text-white flex items-center justify-center font-bold text-lg hover:bg-[var(--color-accent-hover)] transition-colors"
                        aria-label="Increase quantity"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Item total & actions */}
                  <div className="flex items-center justify-between mt-4">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setEditingInstructions(
                          editingInstructions === item.menuItemId ? null : item.menuItemId
                        )}
                        className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] transition-colors"
                      >
                        <MessageSquare size={14} />
                        {item.specialInstructions ? 'Edit Note' : 'Add Note'}
                      </button>
                      <div className="w-1 h-1 rounded-full bg-[var(--color-border)]" />
                      <button
                        onClick={() => removeItem(item.menuItemId)}
                        className="flex items-center gap-1.5 text-xs font-medium text-red-400 hover:text-red-600 transition-colors"
                      >
                        <Trash2 size={14} />
                        Remove
                      </button>
                    </div>
                    <span className="text-sm font-bold text-[var(--color-text-primary)]">
                      {formatCurrency(item.price * item.quantity)}
                    </span>
                  </div>

                  {/* Instructions input */}
                  <AnimatePresence>
                    {editingInstructions === item.menuItemId && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-4"
                      >
                        <input
                          className="input text-sm bg-[var(--color-background)] border-[var(--color-border-subtle)] focus:bg-white"
                          placeholder="Any special instructions? (e.g., less spicy)"
                          value={item.specialInstructions || ''}
                          onChange={(e) => updateInstructions(item.menuItemId, e.target.value)}
                          autoFocus
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Order Notes */}
        <div className="card p-5 border border-[var(--color-border-subtle)] shadow-sm">
          <label className="label text-sm font-semibold mb-3 flex items-center gap-2">
            <MessageSquare size={16} className="text-[var(--color-text-tertiary)]" />
            Order Notes (Optional)
          </label>
          <textarea
            className="input resize-none text-sm min-h-[90px] bg-[var(--color-background)] border-[var(--color-border-subtle)] focus:bg-white transition-colors"
            placeholder="Any special requests for the entire order?"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {/* Bill Summary */}
        <div className="card p-5 border border-[var(--color-border-subtle)] shadow-sm space-y-4">
          <h3 className="font-semibold text-base text-[var(--color-text-primary)]">Bill Summary</h3>
          <div className="space-y-2.5">
            <div className="flex justify-between text-sm">
              <span className="text-[var(--color-text-secondary)]">Item Total</span>
              <span className="font-medium text-[var(--color-text-primary)]">{formatCurrency(subtotal)}</span>
            </div>

            {taxEnabled && totalTaxRate > 0 ? (
              <div className="flex justify-between text-sm">
                <span className="text-[var(--color-text-secondary)]">
                  GST ({totalTaxRate}% — {cgstRate}% CGST + {sgstRate}% SGST)
                </span>
                <span className="font-medium text-[var(--color-text-primary)]">{formatCurrency(tax)}</span>
              </div>
            ) : (
              <div className="flex justify-between text-sm">
                <span className="text-[var(--color-text-secondary)]">Taxes</span>
                <span className="font-medium text-emerald-600">₹0.00 (Exempt)</span>
              </div>
            )}

            {serviceCharge > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-[var(--color-text-secondary)]">
                  Service / Additional Fee ({serviceChargeRate}%)
                </span>
                <span className="font-medium text-[var(--color-text-primary)]">{formatCurrency(serviceCharge)}</span>
              </div>
            )}

            <hr className="divider my-3" />
            <div className="flex justify-between items-center">
              <span className="font-bold text-base text-[var(--color-text-primary)]">Grand Total</span>
              <span className="text-lg font-bold text-[var(--color-accent)]">{formatCurrency(total)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Place Order Footer */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-[var(--color-surface)]/95 backdrop-blur-md border-t border-[var(--color-border-subtle)] z-50 shadow-[0_-4px_20px_rgba(0,0,0,0.04)]">
        <div className="max-w-2xl mx-auto">
          <Button
            onClick={handlePlaceOrder}
            loading={loading}
            className="w-full shadow-md text-base"
            size="lg"
            id="place-order-btn"
          >
            {loading ? 'Placing Order...' : `Place Order — ${formatCurrency(total)}`}
          </Button>
        </div>
      </div>
    </div>
  )
}
