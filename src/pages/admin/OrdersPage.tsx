import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ShoppingBag, RefreshCw, Check, X, Clock, Download, ChevronRight,
  Search, Receipt, Printer, ArrowRight, Banknote, QrCode, Layers
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { orderService, billingService, restaurantService } from '@/services'
import { supabase } from '@/lib/supabase'
import { StatusBadge, EmptyState } from '@/components/ui'
import { Dialog } from '@/components/ui/Dialog'
import { Drawer } from '@/components/ui/Drawer'
import { DataTable } from '@/components/ui/DataTable'
import { PageHeader } from '@/components/admin/PageHeader'
import { GenerateBillModal } from '@/components/billing/GenerateBillModal'
import { UPIPaymentModal } from '@/components/billing/UPIPaymentModal'
import { BillDetailModal } from '@/components/billing/BillDetailModal'
import { formatCurrency, timeAgo } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { playAdminNewOrderSound } from '@/lib/soundEffects'
import { hasPermission } from '@/lib/permissions'
import type { Order, OrderStatus, Restaurant, Bill } from '@/types/database'
import toast from 'react-hot-toast'

const statusFlow: Record<string, { next: OrderStatus; label: string; color: string }> = {
  placed: { next: 'accepted', label: 'Accept', color: 'btn-primary' },
  accepted: { next: 'preparing', label: 'Start Preparing', color: 'bg-amber-500 text-white hover:bg-amber-600' },
  preparing: { next: 'ready', label: 'Mark Ready', color: 'bg-purple-500 text-white hover:bg-purple-600' },
  ready: { next: 'served', label: 'Mark Served', color: 'bg-green-600 text-white hover:bg-green-700' },
}

const REJECTION_REASONS = [
  'Item unavailable',
  'Restaurant too busy',
  'Restaurant closing soon',
  'Kitchen equipment issue',
  'Other',
]

const filterTabs = [
  { label: 'All', value: 'all' },
  { label: 'New', value: 'placed' },
  { label: 'Accepted', value: 'accepted' },
  { label: 'Preparing', value: 'preparing' },
  { label: 'Ready', value: 'ready' },
  { label: 'Served', value: 'served' },
  { label: 'Cancelled', value: 'cancelled' },
]

export function OrdersPage() {
  const { profile } = useAuth()
  const canGenerateBill = hasPermission(profile?.role, 'generate_bill')
  const [orders, setOrders] = useState<Order[]>([])
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [billsMap, setBillsMap] = useState<Record<string, Bill>>({})
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [selectedOrderBill, setSelectedOrderBill] = useState<Bill | null>(null)
  const [rejectOrder, setRejectOrder] = useState<Order | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [otherReason, setOtherReason] = useState('')
  const [rejecting, setRejecting] = useState(false)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  // Billing Modals State
  const [billModalOrder, setBillModalOrder] = useState<Order | null>(null)
  const [upiModalBill, setUpiModalBill] = useState<Bill | null>(null)
  const [paymentInitialMode, setPaymentInitialMode] = useState<'UPI' | 'CASH'>('UPI')
  const [detailModalBill, setDetailModalBill] = useState<Bill | null>(null)

  const activeRestaurantId = (profile?.restaurant_id && profile.restaurant_id !== 'a1b2c3d4-e5f6-7890-abcd-ef1234567890')
    ? profile.restaurant_id
    : 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'

  const fetchOrders = async () => {
    const [ordersData, restData, billsData] = await Promise.all([
      orderService.getByRestaurant(activeRestaurantId, 200),
      restaurantService.getById(activeRestaurantId),
      billingService.getBillsByRestaurant(activeRestaurantId, { status: 'all' }),
    ])

    setOrders(ordersData)
    if (restData) setRestaurant(restData)

    const map: Record<string, Bill> = {}
    for (const b of billsData) {
      if (b.status !== 'CANCELLED') {
        if (b.order_id) map[b.order_id] = b
        if (b.order_ids && Array.isArray(b.order_ids)) {
          for (const oid of b.order_ids) {
            map[oid] = b
          }
        }
      }
    }
    setBillsMap(map)
    setLoading(false)
  }

  useEffect(() => {
    fetchOrders()
  }, [activeRestaurantId])

  useEffect(() => {
    if (selectedOrder) {
      setSelectedOrderBill(billsMap[selectedOrder.id] || null)
    } else {
      setSelectedOrderBill(null)
    }
  }, [selectedOrder, billsMap])


  useEffect(() => {
    // 1. Live Realtime Supabase Subscription
    const channel = supabase
      .channel('admin-orders')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
        },
        async (payload) => {
          const rec = (payload.new || payload.old) as any
          if (!rec || !rec.restaurant_id || rec.restaurant_id === activeRestaurantId) {
            if (payload.eventType === 'INSERT') {
              playAdminNewOrderSound()
              const newOrder = await orderService.getById(payload.new.id)
              if (newOrder) {
                setOrders(prev => [newOrder, ...prev.filter(o => o.id !== newOrder.id)])
                toast.success(`New Order #${newOrder.order_number} — Table ${newOrder.table?.table_number || ''}`, {
                  icon: '🛎️',
                  duration: 6000,
                })
              } else {
                fetchOrders()
              }
            } else if (payload.eventType === 'UPDATE') {
              setOrders(prev => prev.map(o =>
                o.id === payload.new.id ? { ...o, ...payload.new } : o
              ))
              if (selectedOrder?.id === payload.new.id) {
                setSelectedOrder(prev => prev ? { ...prev, ...payload.new } : null)
              }
            }
          }
        }
      )
      .subscribe()

    // 2. BroadcastChannel for instant cross-tab sync
    let bc: BroadcastChannel | null = null
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        bc = new BroadcastChannel('deccan_order_sync')
        bc.onmessage = (event) => {
          if (event.data?.type === 'ORDER_PLACED') {
            playAdminNewOrderSound()
            fetchOrders()
          }
        }
      } catch (err) {
        console.warn('BroadcastChannel error in OrdersPage:', err)
      }
    }

    // 3. 3-second background polling interval
    const interval = setInterval(() => {
      fetchOrders()
    }, 3000)

    // 4. Cross-tab and local storage events
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'deccan_latest_order' || e.key === 'deccan_order_event' || e.key === 'samravaa_demo_orders') {
        fetchOrders()
      }
    }
    const handleCustomOrder = () => {
      fetchOrders()
    }

    window.addEventListener('storage', handleStorage)
    window.addEventListener('deccan-order-placed', handleCustomOrder)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(interval)
      bc?.close()
      window.removeEventListener('storage', handleStorage)
      window.removeEventListener('deccan-order-placed', handleCustomOrder)
    }
  }, [activeRestaurantId, selectedOrder?.id])

  const handleStatusUpdate = async (order: Order, newStatus: OrderStatus) => {
    setUpdatingId(order.id)
    const { error } = await orderService.updateStatus(order.id, newStatus)
    setUpdatingId(null)

    if (error) {
      toast.error('Failed to update order status')
    } else {
      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: newStatus } : o))
      if (selectedOrder?.id === order.id) {
        setSelectedOrder(prev => prev ? { ...prev, status: newStatus } : null)
      }
      toast.success('Status updated')
    }
  }

  const handleReject = async () => {
    if (!rejectOrder) return
    const reason = rejectionReason === 'Other' ? otherReason : rejectionReason
    if (!reason) {
      toast.error('Please select a reason')
      return
    }

    setRejecting(true)
    const { error } = await orderService.updateStatus(rejectOrder.id, 'cancelled', reason)
    setRejecting(false)

    if (error) {
      toast.error('Failed to reject order')
    } else {
      setOrders(prev => prev.map(o =>
        o.id === rejectOrder.id ? { ...o, status: 'cancelled', rejection_reason: reason } : o
      ))
      if (selectedOrder?.id === rejectOrder.id) {
        setSelectedOrder(prev => prev ? { ...prev, status: 'cancelled', rejection_reason: reason } : null)
      }
      toast.success('Order rejected')
      setRejectOrder(null)
      setRejectionReason('')
      setOtherReason('')
    }
  }

  const filteredOrders = orders.filter(o => {
    const matchesFilter = filter === 'all' || o.status === filter
    const searchLower = searchQuery.toLowerCase()
    const matchesSearch = searchQuery === '' || 
      String(o.order_number).includes(searchLower) ||
      String(o.table?.table_number).includes(searchLower)
    return matchesFilter && matchesSearch
  })

  const newOrdersCount = orders.filter(o => o.status === 'placed').length
  const acceptedCount = orders.filter(o => o.status === 'accepted').length
  const preparingCount = orders.filter(o => o.status === 'preparing').length
  const readyCount = orders.filter(o => o.status === 'ready').length

  const columns = [
    {
      header: 'Order',
      cell: (order: Order) => <span className="font-medium">#{order.order_number}</span>
    },
    {
      header: 'Table',
      cell: (order: Order) => <span>Table {order.table?.table_number || '-'}</span>
    },
    {
      header: 'Items',
      cell: (order: Order) => <span className="text-[var(--color-text-secondary)]">{order.order_items?.reduce((acc, item) => acc + item.quantity, 0)} items</span>
    },
    {
      header: 'Amount',
      cell: (order: Order) => <span className="font-medium">{formatCurrency(order.total)}</span>
    },
    {
      header: 'Status',
      cell: (order: Order) => <StatusBadge status={order.status} />
    },
    {
      header: 'Time',
      cell: (order: Order) => <span className="text-[var(--color-text-secondary)]">{timeAgo(order.created_at)}</span>
    },
    {
      header: 'Billing',
      cell: (order: Order) => {
        const bill = billsMap[order.id]
        if (bill) {
          return (
            <button
              onClick={(e) => {
                e.stopPropagation()
                setDetailModalBill(bill)
              }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-stone-100 hover:bg-stone-200 transition-colors border border-stone-200"
            >
              <Receipt size={13} className="text-[var(--color-accent)]" />
              <span className="font-mono">{bill.bill_number}</span>
              {bill.is_combined && (
                <span className="text-[9px] px-1 py-0.2 rounded bg-amber-100 text-amber-900 font-bold border border-amber-200">
                  Combined
                </span>
              )}
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full uppercase font-bold ${
                  bill.status === 'PAID'
                    ? 'bg-emerald-100 text-emerald-800'
                    : bill.status === 'CANCELLED'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {bill.status === 'PAID' ? 'Paid' : 'Pending'}
              </span>
            </button>
          )
        }
        if (order.status === 'cancelled' || !canGenerateBill) {
          return <span className="text-stone-400 text-xs">-</span>
        }

        // Check if there are other unbilled orders for this table
        const siblingTableOrdersCount = orders.filter(o =>
          o.id !== order.id &&
          o.table_id === order.table_id &&
          o.status !== 'cancelled' &&
          (!billsMap[o.id] || billsMap[o.id].status !== 'PAID')
        ).length

        return (
          <button
            onClick={(e) => {
              e.stopPropagation()
              setBillModalOrder(order)
            }}
            className={`btn btn-secondary btn-sm h-7 px-2 text-xs flex items-center gap-1 ${
              siblingTableOrdersCount > 0
                ? 'border-amber-300 bg-amber-50/80 text-amber-900 hover:bg-amber-100 font-semibold'
                : 'hover:border-[var(--color-accent)]'
            }`}
            title={siblingTableOrdersCount > 0 ? `${siblingTableOrdersCount + 1} orders from this table will be tallied together` : 'Generate bill'}
          >
            {siblingTableOrdersCount > 0 ? (
              <>
                <Layers size={13} className="text-amber-700" />
                <span>Combine Bill ({siblingTableOrdersCount + 1})</span>
              </>
            ) : (
              <>
                <Receipt size={13} className="text-[var(--color-accent)]" />
                <span>Generate Bill</span>
              </>
            )}
          </button>
        )
      }
    },
    {
      header: 'Actions',
      cell: (order: Order) => (
        <span className="text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] font-medium flex items-center gap-1">
          View <ChevronRight size={14} />
        </span>
      )
    }
  ]

  return (
    <div>
      <PageHeader
        title="Orders"
        description="Manage incoming restaurant orders."
        action={
          <button className="btn btn-secondary" onClick={fetchOrders}>
            <RefreshCw size={16} />
            Refresh
          </button>
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'New Orders', value: newOrdersCount, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Accepted', value: acceptedCount, color: 'text-orange-600', bg: 'bg-orange-50' },
          { label: 'Preparing', value: preparingCount, color: 'text-purple-600', bg: 'bg-purple-50' },
          { label: 'Ready', value: readyCount, color: 'text-green-600', bg: 'bg-green-50' },
        ].map(stat => (
          <div key={stat.label} className="card p-5 flex flex-col justify-between">
            <span className="text-sm font-medium text-[var(--color-text-secondary)]">{stat.label}</span>
            <div className={`mt-3 text-3xl font-bold ${stat.color}`}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2.5 px-4 py-2.5 bg-white rounded-xl border border-[var(--color-border)] w-full md:w-[320px] shadow-sm">
          <Search size={16} className="text-[var(--color-text-tertiary)] flex-shrink-0" />
          <input
            placeholder="Search order number or table..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="bg-transparent text-sm outline-none flex-1 text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)]"
          />
        </div>
        <div className="tab-group flex-shrink-0">
          {filterTabs.map(tab => (
            <button
              key={tab.value}
              onClick={() => setFilter(tab.value)}
              className={cn(
                'tab-item',
                filter === tab.value && 'active'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Data Table */}
      {loading ? (
        <div className="card p-8 flex justify-center">
          <div className="animate-pulse flex flex-col items-center gap-4">
            <div className="w-8 h-8 border-4 border-[var(--color-border)] border-t-[var(--color-accent)] rounded-full animate-spin" />
            <div className="text-[var(--color-text-secondary)] text-sm">Loading orders...</div>
          </div>
        </div>
      ) : (
        <div className="hidden md:block">
          <DataTable
            data={filteredOrders}
            columns={columns}
            onRowClick={setSelectedOrder}
            emptyState={
              <div className="card">
                <EmptyState
                  icon={<ShoppingBag size={28} />}
                  title="No orders found"
                  description="Try adjusting your filters or search query."
                />
              </div>
            }
          />
        </div>
      )}

      {/* Mobile Grid */}
      <div className="md:hidden space-y-4">
        {filteredOrders.map(order => (
          <div key={order.id} onClick={() => setSelectedOrder(order)} className="card p-4 active:scale-[0.98] transition-transform">
            <div className="flex justify-between items-start mb-3">
              <div>
                <div className="font-bold">#{order.order_number}</div>
                <div className="text-sm text-[var(--color-text-secondary)]">Table {order.table?.table_number}</div>
              </div>
              <StatusBadge status={order.status} />
            </div>
            <div className="flex justify-between items-center text-sm pt-3 border-t border-[var(--color-border)]">
              <span className="font-semibold">{formatCurrency(order.total)}</span>
              <span className="text-[var(--color-text-tertiary)]">{timeAgo(order.created_at)}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Order Detail Drawer */}
      <Drawer
        open={!!selectedOrder}
        onClose={() => setSelectedOrder(null)}
        title={`Order #${selectedOrder?.order_number}`}
        footer={
          selectedOrder && (
            <div className="space-y-2.5 w-full">
              {/* Billing Quick Action Row in Drawer Footer */}
              {canGenerateBill && selectedOrder.status !== 'cancelled' && (
                <div className="flex gap-2">
                  {selectedOrderBill ? (
                    <button
                      onClick={() => setDetailModalBill(selectedOrderBill)}
                      className="btn btn-secondary flex-1 text-xs flex items-center justify-center gap-1.5 h-10 border-[var(--color-accent)] text-[var(--color-accent)] hover:bg-[var(--color-accent-light)]"
                    >
                      <Receipt size={15} />
                      <span>View Bill ({selectedOrderBill.bill_number})</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => setBillModalOrder(selectedOrder)}
                      className="btn btn-secondary flex-1 text-xs flex items-center justify-center gap-1.5 h-10 bg-[var(--color-accent-light)] border-[var(--color-accent)] text-[var(--color-accent)] font-semibold hover:bg-[var(--color-accent)] hover:text-white transition-colors"
                    >
                      <Receipt size={15} />
                      <span>Generate Bill</span>
                    </button>
                  )}

                  {selectedOrderBill && selectedOrderBill.status === 'PENDING_PAYMENT' && (
                    <div className="flex gap-2 flex-1">
                      <button
                        onClick={() => {
                          setPaymentInitialMode('CASH')
                          setUpiModalBill(selectedOrderBill)
                        }}
                        className="btn btn-secondary flex-1 text-xs flex items-center justify-center gap-1.5 h-10 border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 font-semibold"
                      >
                        <Banknote size={15} />
                        <span>Cash</span>
                      </button>
                      <button
                        onClick={() => {
                          setPaymentInitialMode('UPI')
                          setUpiModalBill(selectedOrderBill)
                        }}
                        className="btn btn-primary flex-1 text-xs flex items-center justify-center gap-1.5 h-10 shadow-xs"
                      >
                        <QrCode size={14} />
                        <span>UPI</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Order Status Progression */}
              {statusFlow[selectedOrder.status] && (
                <div className="flex gap-3">
                  {selectedOrder.status === 'placed' && (
                    <button
                      onClick={() => setRejectOrder(selectedOrder)}
                      className="btn btn-secondary flex-1 text-red-600 hover:bg-red-50 hover:border-red-200"
                    >
                      Reject Order
                    </button>
                  )}
                  <button
                    onClick={() => handleStatusUpdate(selectedOrder, statusFlow[selectedOrder.status].next)}
                    disabled={updatingId === selectedOrder.id}
                    className={cn(
                      'btn flex-[2]',
                      statusFlow[selectedOrder.status].color
                    )}
                  >
                    {updatingId === selectedOrder.id ? 'Updating...' : statusFlow[selectedOrder.status].label}
                  </button>
                </div>
              )}
            </div>
          )
        }
      >
        {selectedOrder && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-[var(--color-text-secondary)]">Table</div>
                <div className="text-xl font-bold">{selectedOrder.table?.table_number || '-'}</div>
              </div>
              <div className="text-right">
                <div className="text-sm text-[var(--color-text-secondary)]">Time</div>
                <div className="font-medium text-[var(--color-text-primary)]">
                  {new Date(selectedOrder.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>

            {/* Timeline & Status */}
            <div className="bg-[#FAFAF8] rounded-xl p-4 border border-[var(--color-border)]">
              <div className="text-sm font-semibold mb-3">Status</div>
              <div className="flex items-center gap-2">
                <StatusBadge status={selectedOrder.status} />
              </div>
              {selectedOrder.rejection_reason && (
                <div className="mt-3 text-sm text-red-600 bg-red-50 p-2 rounded-lg">
                  Reason: {selectedOrder.rejection_reason}
                </div>
              )}
            </div>

            {/* Billing Snapshot Block inside Drawer */}
            <div className="bg-stone-50 rounded-xl p-4 border border-stone-200">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-semibold uppercase tracking-wider text-stone-600 flex items-center gap-1.5">
                  <Receipt size={14} className="text-[var(--color-accent)]" />
                  <span>Billing & Payment</span>
                </div>
                {selectedOrderBill && (
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                      selectedOrderBill.status === 'PAID'
                        ? 'bg-emerald-100 text-emerald-800'
                        : selectedOrderBill.status === 'CANCELLED'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {selectedOrderBill.status}
                  </span>
                )}
              </div>

              {selectedOrderBill ? (
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-stone-500">Invoice:</span>
                    <span className="font-mono font-bold text-stone-900">{selectedOrderBill.bill_number}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-500">Grand Total:</span>
                    <span className="font-mono font-bold text-stone-900">{formatCurrency(selectedOrderBill.grand_total)}</span>
                  </div>
                  <div className="flex gap-2 pt-2 border-t border-stone-200">
                    <button
                      onClick={() => setDetailModalBill(selectedOrderBill)}
                      className="btn btn-secondary btn-sm flex-1 text-xs flex items-center justify-center gap-1"
                    >
                      <Printer size={13} />
                      <span>{selectedOrderBill.print_count > 0 ? 'Reprint Bill' : 'Print Bill'}</span>
                    </button>
                    {selectedOrderBill.status === 'PENDING_PAYMENT' && (
                      <button
                        onClick={() => {
                          setPaymentInitialMode('CASH')
                          setUpiModalBill(selectedOrderBill)
                        }}
                        className="btn btn-primary btn-sm flex-1 text-xs flex items-center justify-center gap-1"
                      >
                        <span>Collect Payment</span>
                        <ArrowRight size={13} />
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-xs text-stone-500 flex items-center justify-between">
                  <span>No bill generated yet.</span>
                  {canGenerateBill && selectedOrder.status !== 'cancelled' && (
                    <button
                      onClick={() => setBillModalOrder(selectedOrder)}
                      className="text-xs font-semibold text-[var(--color-accent)] hover:underline flex items-center gap-1"
                    >
                      <span>Generate Bill</span>
                      <ArrowRight size={12} />
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Items */}
            <div>
              <div className="text-sm font-semibold mb-4 text-[var(--color-text-secondary)] uppercase tracking-wider">Items</div>
              <div className="space-y-4">
                {selectedOrder.order_items?.map(item => (
                  <div key={item.id} className="flex justify-between">
                    <div className="flex gap-3">
                      <div className="font-semibold text-[var(--color-text-secondary)]">{item.quantity}×</div>
                      <div>
                        <div className="font-medium text-[var(--color-text-primary)]">{item.item_name}</div>
                        {item.notes && <div className="text-sm text-[var(--color-text-tertiary)] italic">{item.notes}</div>}
                      </div>
                    </div>
                    <div className="font-medium">{formatCurrency((item.price ?? item.item_price ?? 0) * item.quantity)}</div>
                  </div>
                ))}
              </div>
            </div>

            {selectedOrder.notes && (
              <div className="bg-amber-50 p-4 rounded-xl border border-amber-100">
                <div className="text-xs font-semibold text-amber-800 uppercase tracking-wider mb-1">Customer Notes</div>
                <div className="text-sm text-amber-900">{selectedOrder.notes}</div>
              </div>
            )}

            <div className="border-t border-[var(--color-border)] pt-4 space-y-2">
              <div className="flex justify-between text-sm text-[var(--color-text-secondary)]">
                <span>Subtotal</span>
                <span>{formatCurrency(selectedOrder.total)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold pt-2 border-t border-[var(--color-border-subtle)]">
                <span>Total</span>
                <span>{formatCurrency(selectedOrder.total)}</span>
              </div>
            </div>
          </div>
        )}
      </Drawer>

      {/* Reject Dialog */}
      <Dialog
        open={!!rejectOrder}
        onClose={() => { setRejectOrder(null); setRejectionReason(''); setOtherReason('') }}
        title="Reject Order"
        description={`Order #${rejectOrder?.order_number} — Table ${rejectOrder?.table?.table_number}`}
        size="sm"
      >
        <div className="space-y-3 -mt-2">
          <p className="text-sm text-[var(--color-text-secondary)]">Select a reason for rejection:</p>
          <div className="space-y-2">
            {REJECTION_REASONS.map(reason => (
              <button
                key={reason}
                onClick={() => setRejectionReason(reason)}
                className={cn(
                  'w-full text-left px-4 py-3 rounded-[10px] text-sm border transition-all',
                  rejectionReason === reason
                    ? 'border-red-300 bg-red-50 text-red-700 font-medium'
                    : 'border-[var(--color-border)] hover:bg-[var(--color-background)]'
                )}
              >
                {reason}
              </button>
            ))}
          </div>
          {rejectionReason === 'Other' && (
            <textarea
              className="input min-h-[80px] resize-none text-sm mt-2"
              placeholder="Describe the reason..."
              value={otherReason}
              onChange={(e) => setOtherReason(e.target.value)}
            />
          )}
          <div className="flex gap-3 pt-4 border-t border-[var(--color-border)] mt-4">
            <button onClick={() => { setRejectOrder(null); setRejectionReason(''); setOtherReason('') }} className="btn btn-secondary flex-1">
              Cancel
            </button>
            <button onClick={handleReject} disabled={rejecting || !rejectionReason} className="btn btn-danger flex-1">
              {rejecting ? 'Rejecting...' : 'Reject Order'}
            </button>
          </div>
        </div>
      </Dialog>

      {/* Generate Bill Modal */}
      {billModalOrder && (
        <GenerateBillModal
          open={!!billModalOrder}
          onClose={() => setBillModalOrder(null)}
          order={billModalOrder}
          allOrders={orders}
          orderBills={billsMap}
          restaurant={restaurant}
          cashierName={profile?.name || 'Staff'}
          onBillGenerated={(newBill, mode) => {
            fetchOrders()
            if (mode === 'UPI' || mode === 'CASH') {
              setPaymentInitialMode(mode)
              setUpiModalBill(newBill)
            } else {
              setDetailModalBill(newBill)
            }
          }}
        />
      )}

      {/* Payment Modal (UPI & Cash) */}
      {upiModalBill && (
        <UPIPaymentModal
          open={!!upiModalBill}
          onClose={() => setUpiModalBill(null)}
          bill={upiModalBill}
          restaurant={restaurant}
          initialMethod={paymentInitialMode}
          onPaymentSuccess={() => {
            fetchOrders()
          }}
        />
      )}

      {/* Bill Detail & Reprint Modal */}
      {detailModalBill && (
        <BillDetailModal
          open={!!detailModalBill}
          onClose={() => setDetailModalBill(null)}
          bill={detailModalBill}
          restaurant={restaurant}
          onBillUpdated={fetchOrders}
        />
      )}
    </div>
  )
}
