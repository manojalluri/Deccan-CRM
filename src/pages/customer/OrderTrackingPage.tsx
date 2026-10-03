import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CheckCircle, Circle, Clock, ChefHat, Bell, XCircle, ArrowLeft } from 'lucide-react'
import { orderService } from '@/services'
import { supabase } from '@/lib/supabase'
import { formatCurrency, cn } from '@/lib/utils'
import { playCustomerOrderConfirmedSound } from '@/lib/soundEffects'
import type { Order, OrderStatus } from '@/types/database'
import toast from 'react-hot-toast'

const statusSteps: { status: OrderStatus; label: string; description: string; icon: typeof Clock }[] = [
  { status: 'placed', label: 'Order Placed', description: 'Your order has been sent to the restaurant', icon: Clock },
  { status: 'accepted', label: 'Accepted', description: 'Restaurant has accepted your order', icon: CheckCircle },
  { status: 'preparing', label: 'Preparing', description: 'The kitchen is preparing your food', icon: ChefHat },
  { status: 'ready', label: 'Ready', description: 'Your order is ready for pickup', icon: Bell },
  { status: 'served', label: 'Served', description: 'Enjoy your meal! 🎉', icon: CheckCircle },
]

const statusOrder: OrderStatus[] = ['placed', 'accepted', 'preparing', 'ready', 'served']

function getStepIndex(status: OrderStatus) {
  return statusOrder.indexOf(status)
}

export function OrderTrackingPage() {
  const { orderId, restaurantSlug, tableToken } = useParams<{
    orderId: string
    restaurantSlug: string
    tableToken: string
  }>()
  const navigate = useNavigate()
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState(false)

  const handleCancelOrder = async () => {
    if (!order) return
    if (!window.confirm(`Are you sure you want to cancel Order #${order.order_number}? This will notify the kitchen immediately.`)) return
    setCancelling(true)
    const { error } = await orderService.cancelOrder(order.id, 'Cancelled by customer')
    setCancelling(false)
    if (error) {
      toast.error('Could not cancel order. Please inform restaurant staff.')
    } else {
      toast.success(`Order #${order.order_number} cancelled`)
      setOrder(prev => prev ? { ...prev, status: 'cancelled', rejection_reason: 'Cancelled by customer' } : null)
    }
  }

  useEffect(() => {
    if (!orderId) return

    const load = async () => {
      const data = await orderService.getById(orderId)
      setOrder(data)
      setLoading(false)
    }

    load()
  }, [orderId])

  // Realtime status updates
  useEffect(() => {
    if (!orderId) return

    const channel = supabase
      .channel(`order-${orderId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` },
        (payload) => {
          const updated = payload.new as Order
          if (updated.status === 'accepted') {
            playCustomerOrderConfirmedSound()
            toast.success('Your order was accepted by the kitchen! 👨‍🍳', { icon: '🔥' })
          } else if (updated.status === 'ready') {
            playCustomerOrderConfirmedSound()
            toast.success('Your order is fresh & ready! 🍽️', { icon: '✨' })
          }
          setOrder(prev => prev ? { ...prev, ...payload.new } : null)
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [orderId])

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-background)] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[var(--color-text-secondary)]">Loading order...</p>
        </div>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-[var(--color-background)] flex items-center justify-center p-6">
        <div className="text-center">
          <XCircle size={48} className="text-red-400 mx-auto mb-3" />
          <h2 className="text-lg font-semibold mb-2">Order not found</h2>
          <button onClick={() => navigate(-1)} className="btn btn-primary btn-sm">Go Back</button>
        </div>
      </div>
    )
  }

  const isCancelled = order.status === 'cancelled'
  const currentStepIndex = getStepIndex(order.status as OrderStatus)

  return (
    <div className="min-h-screen bg-[var(--color-background)] pb-12">
      {/* Header */}
      <div className="bg-[var(--color-surface)]/90 backdrop-blur-md border-b border-[var(--color-border-subtle)] px-4 py-4 flex items-center gap-3 sticky top-0 z-40 shadow-sm">
        <button
          onClick={() => navigate(`/menu/${restaurantSlug}/table/${tableToken}`)}
          className="btn btn-ghost btn-icon hover:bg-[var(--color-background)]"
          aria-label="Back to menu"
        >
          <ArrowLeft size={20} className="text-[var(--color-text-primary)]" />
        </button>
        <div>
          <h1 className="font-semibold text-[var(--color-text-primary)] text-lg leading-tight">Order Tracking</h1>
          <p className="text-xs text-[var(--color-text-tertiary)] font-medium">Table {order.table?.table_number}</p>
        </div>
      </div>

      <div className="px-4 py-6 space-y-6 max-w-xl mx-auto">
        {/* Success/Status Banner */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className={cn(
            'card p-6 text-center border shadow-sm',
            isCancelled ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'
          )}
        >
          <div className={cn(
            'w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4',
            isCancelled ? 'bg-red-100' : 'bg-green-100'
          )}>
            {isCancelled
              ? <XCircle size={32} className="text-red-500" />
              : <CheckCircle size={32} className="text-green-500" />
            }
          </div>
          <h2 className="text-xl font-bold mb-1 text-[var(--color-text-primary)]">
            {isCancelled ? 'Order Cancelled' : 'Order Placed!'}
          </h2>
          <p className="text-sm font-medium text-[var(--color-text-secondary)]">
            Order #{order.order_number}
          </p>
          {isCancelled && order.rejection_reason && (
            <div className="mt-4 text-sm text-red-700 bg-red-100/50 border border-red-200 px-4 py-3 rounded-xl font-medium">
              Reason: {order.rejection_reason}
            </div>
          )}
        </motion.div>

        {/* Status Timeline */}
        {!isCancelled && (
          <div className="card p-6 border border-[var(--color-border-subtle)] shadow-sm">
            <h3 className="font-bold text-base text-[var(--color-text-primary)] mb-6">Order Status</h3>
            <div className="space-y-0">
              {statusSteps.map((step, i) => {
                const isCompleted = currentStepIndex >= i
                const isCurrent = currentStepIndex === i
                const isLast = i === statusSteps.length - 1

                return (
                  <div key={step.status} className="flex gap-5">
                    {/* Icon column */}
                    <div className="flex flex-col items-center">
                      <motion.div
                        initial={false}
                        animate={isCompleted ? { scale: [1, 1.15, 1] } : {}}
                        className={cn(
                          'w-9 h-9 rounded-full flex items-center justify-center transition-all duration-500 shadow-sm z-10',
                          isCompleted
                            ? isCurrent
                              ? 'bg-[var(--color-accent)] text-white shadow-md ring-4 ring-[var(--color-accent)]/20'
                              : 'bg-green-500 text-white'
                            : 'bg-white border-2 border-[var(--color-border)] text-[var(--color-text-tertiary)]'
                        )}
                      >
                        {isCompleted && !isCurrent
                          ? <CheckCircle size={18} />
                          : isCurrent
                          ? <step.icon size={18} className={cn(isCurrent && 'animate-pulse')} />
                          : <Circle size={14} />
                        }
                      </motion.div>
                      {!isLast && (
                        <div className={cn(
                          'w-0.5 flex-1 my-1 min-h-[32px] transition-all duration-500',
                          currentStepIndex > i ? 'bg-green-400' : 'bg-[var(--color-border)]'
                        )} />
                      )}
                    </div>

                    {/* Content */}
                    <div className={cn('pb-6 pt-1.5', isLast && 'pb-0')}>
                      <div className={cn(
                        'font-bold text-sm transition-colors',
                        isCompleted ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-tertiary)]'
                      )}>
                        {step.label}
                      </div>
                      <div className={cn(
                        'text-xs mt-1 transition-colors font-medium leading-relaxed',
                        isCompleted ? 'text-[var(--color-text-secondary)]' : 'text-[var(--color-text-tertiary)]/70'
                      )}>
                        {step.description}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Order Items */}
        <div className="card p-6 border border-[var(--color-border-subtle)] shadow-sm space-y-4">
          <h3 className="font-bold text-base text-[var(--color-text-primary)]">Your Order</h3>
          <div className="space-y-3">
            {order.order_items?.map(item => (
              <div key={item.id} className="flex justify-between text-sm">
                <span className="text-[var(--color-text-secondary)] font-medium flex gap-2">
                  <span className="text-[var(--color-text-tertiary)]">{item.quantity}×</span>
                  <span className="text-[var(--color-text-primary)]">{item.item_name}</span>
                </span>
                <span className="font-semibold text-[var(--color-text-primary)]">{formatCurrency(((item.price ?? item.item_price ?? 0)) * item.quantity)}</span>
              </div>
            ))}
          </div>
          <hr className="divider my-4" />
          <div className="flex justify-between items-center">
            <span className="font-bold text-base text-[var(--color-text-primary)]">Total Paid</span>
            <span className="text-lg font-bold text-[var(--color-accent)]">{formatCurrency(order.total)}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          {order.status === 'placed' && (
            <button
              onClick={handleCancelOrder}
              disabled={cancelling}
              className="btn btn-outline border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400 w-full py-3 text-sm font-semibold flex items-center justify-center gap-2"
            >
              <XCircle size={16} />
              {cancelling ? 'Cancelling...' : 'Cancel Order'}
            </button>
          )}

          <button
            onClick={() => navigate(`/menu/${restaurantSlug}/table/${tableToken}`)}
            className="btn btn-secondary w-full shadow-sm text-base py-3.5"
          >
            Back to Menu
          </button>
        </div>
      </div>
    </div>
  )
}
