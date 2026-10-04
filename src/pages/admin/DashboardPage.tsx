import { useEffect, useState, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import {
  ShoppingBag, DollarSign, Clock, Grid3X3, TrendingUp,
  ArrowUpRight, Receipt, Smartphone, AlertCircle, XCircle, RefreshCw
} from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { analyticsService, orderService, billingService } from '@/services'
import { supabase } from '@/lib/supabase'
import { playAdminNewOrderSound } from '@/lib/soundEffects'
import { SkeletonStatCard } from '@/components/ui'
import { formatCurrency, timeAgo } from '@/lib/utils'
import { StatusBadge } from '@/components/ui'
import type { Order } from '@/types/database'
import toast from 'react-hot-toast'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar
} from 'recharts'

interface DashboardStats {
  todayOrders: number
  todayRevenue: number
  pendingOrders: number
  activeTables: number
}

interface BillingMetrics {
  todaySales: number
  todayBills: number
  todayUpi: number
  pendingPayments: number
  cancelledBills: number
}

const statCards = (stats: DashboardStats) => [
  {
    label: "Today's Orders",
    value: stats.todayOrders,
    icon: ShoppingBag,
    color: 'bg-blue-50 text-blue-600',
    change: '+12%',
    changeType: 'up',
  },
  {
    label: "Today's Revenue",
    value: formatCurrency(stats.todayRevenue),
    icon: DollarSign,
    color: 'bg-green-50 text-green-600',
    change: '+8%',
    changeType: 'up',
  },
  {
    label: 'Pending Orders',
    value: stats.pendingOrders,
    icon: Clock,
    color: 'bg-amber-50 text-amber-600',
    change: stats.pendingOrders > 0 ? 'Action needed' : 'All clear',
    changeType: stats.pendingOrders > 0 ? 'warning' : 'neutral',
  },
  {
    label: 'Active Tables',
    value: stats.activeTables,
    icon: Grid3X3,
    color: 'bg-[var(--color-accent-light)] text-[var(--color-accent)]',
    change: 'Currently occupied',
    changeType: 'neutral',
  },
]

function generateHourlyData(orders: { created_at: string; total: number; status: string }[]) {
  const hours = Array.from({ length: 24 }, (_, i) => ({ hour: i, orders: 0, revenue: 0 }))
  orders.forEach(order => {
    if (order.status !== 'cancelled') {
      const hour = new Date(order.created_at).getHours()
      hours[hour].orders += 1
      hours[hour].revenue += order.total
    }
  })
  return hours
    .filter(h => h.hour >= 7 && h.hour <= 23)
    .map(h => ({
      time: h.hour === 12 ? '12 PM' : h.hour > 12 ? `${h.hour - 12} PM` : `${h.hour} AM`,
      orders: h.orders,
      revenue: h.revenue,
    }))
}

export function DashboardPage() {
  const { profile } = useAuth()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [billingMetrics, setBillingMetrics] = useState<BillingMetrics | null>(null)
  const [recentOrders, setRecentOrders] = useState<Order[]>([])
  const [hourlyData, setHourlyData] = useState<{ time: string; orders: number; revenue: number }[]>([])
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const lastKnownOrderCount = useRef<number>(0)

  const activeRestaurantId = (profile?.restaurant_id && profile.restaurant_id !== 'a1b2c3d4-e5f6-7890-abcd-ef1234567890')
    ? profile.restaurant_id
    : 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'

  const fetchDashboardData = useCallback(async (showLoadingSpinner = false) => {
    if (showLoadingSpinner) setLoading(true)
    setIsRefreshing(true)

    try {
      const [dashStats, orders, billStats] = await Promise.all([
        analyticsService.getDashboardStats(activeRestaurantId),
        orderService.getByRestaurant(activeRestaurantId, 10),
        billingService.getDashboardBillingMetrics(activeRestaurantId),
      ])

      setStats({
        todayOrders: dashStats.todayOrders,
        todayRevenue: dashStats.todayRevenue,
        pendingOrders: dashStats.pendingOrders,
        activeTables: dashStats.activeTables,
      })
      setBillingMetrics(billStats)
      setRecentOrders(orders.slice(0, 5))
      setHourlyData(generateHourlyData(dashStats.orders))
      lastKnownOrderCount.current = dashStats.todayOrders
    } catch (err) {
      console.error('Error fetching dashboard stats:', err)
    } finally {
      if (showLoadingSpinner) setLoading(false)
      setIsRefreshing(false)
    }
  }, [activeRestaurantId])

  // Initial load
  useEffect(() => {
    fetchDashboardData(true)
  }, [fetchDashboardData])

  // Real-time synchronization
  useEffect(() => {
    // 1. Supabase Postgres Realtime Subscription for incoming orders & status updates
    const channel = supabase
      .channel('dashboard-live-orders')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
        },
        (payload) => {
          const rec = (payload.new || payload.old) as any
          if (!rec || !rec.restaurant_id || rec.restaurant_id === activeRestaurantId) {
            if (payload.eventType === 'INSERT') {
              playAdminNewOrderSound()
              toast.success(`🛎️ New Order Received! Order #${payload.new?.order_number || ''}`, {
                icon: '🍽️',
                duration: 5000,
              })
            }
            // Seamlessly re-fetch dashboard metrics
            fetchDashboardData(false)
          }
        }
      )
      .subscribe()

    // 2. BroadcastChannel for instant zero-latency cross-tab syncing
    let bc: BroadcastChannel | null = null
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        bc = new BroadcastChannel('deccan_order_sync')
        bc.onmessage = (event) => {
          if (event.data?.type === 'ORDER_PLACED') {
            playAdminNewOrderSound()
            toast.success(`🛎️ New Order Received! Order #${event.data.order?.order_number || ''}`, {
              icon: '🍽️',
              duration: 5000,
            })
            fetchDashboardData(false)
          }
        }
      } catch (err) {
        console.warn('BroadcastChannel error in Dashboard:', err)
      }
    }

    // 3. Continuous 3-second polling interval (fail-safe for networks & local store)
    const interval = setInterval(() => {
      fetchDashboardData(false)
    }, 3000)

    // 4. Cross-tab & local storage events
    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === 'deccan_latest_order' || e.key === 'deccan_order_event' || e.key === 'samravaa_demo_orders') {
        playAdminNewOrderSound()
        fetchDashboardData(false)
      }
    }

    const handleCustomOrderEvent = () => {
      playAdminNewOrderSound()
      fetchDashboardData(false)
    }

    window.addEventListener('storage', handleStorageEvent)
    window.addEventListener('deccan-order-placed', handleCustomOrderEvent)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(interval)
      bc?.close()
      window.removeEventListener('storage', handleStorageEvent)
      window.removeEventListener('deccan-order-placed', handleCustomOrderEvent)
    }
  }, [activeRestaurantId, fetchDashboardData])

  const cards = stats ? statCards(stats) : []

  return (
    <div className="page-content space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Dashboard</h1>
          <p className="text-[var(--color-text-secondary)] mt-0.5 text-xs sm:text-sm">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchDashboardData(false)}
            disabled={isRefreshing}
            className="btn btn-secondary btn-sm text-xs flex items-center gap-1.5"
            title="Refresh dashboard stats"
          >
            <RefreshCw size={13} className={isRefreshing ? 'animate-spin text-[var(--color-accent)]' : ''} />
            <span className="hidden sm:inline">Sync Live</span>
          </button>
          <NavLink
            to="/admin/billing"
            className="btn btn-primary btn-sm text-xs flex items-center gap-1.5 shadow-xs"
          >
            <Receipt size={14} />
            <span>POS Billing</span>
          </NavLink>
        </div>
      </div>

      {/* POS Billing Overview (Requirement 15) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[var(--color-accent)]" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
              POS Billing & UPI Collections (Today)
            </h2>
          </div>
          <NavLink
            to="/admin/billing"
            className="text-xs text-[var(--color-accent)] font-semibold hover:underline flex items-center gap-1"
          >
            <span>View All Invoices</span>
            <ArrowUpRight size={13} />
          </NavLink>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* Today's Sales */}
          <div className="p-4 bg-white rounded-2xl border border-[var(--color-border)] shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider">Today's Sales</span>
              <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <DollarSign size={14} />
              </div>
            </div>
            <div className="text-xl font-extrabold text-stone-900 mt-2 font-mono">
              {formatCurrency(billingMetrics?.todaySales || 0)}
            </div>
            <div className="text-[10px] text-emerald-700 font-medium mt-1">Paid Invoices</div>
          </div>

          {/* UPI Collections */}
          <div className="p-4 bg-white rounded-2xl border border-[var(--color-border)] shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider">UPI Payments</span>
              <div className="w-7 h-7 rounded-lg bg-orange-50 text-[var(--color-accent)] flex items-center justify-center">
                <Smartphone size={14} />
              </div>
            </div>
            <div className="text-xl font-extrabold text-[var(--color-accent)] mt-2 font-mono">
              {formatCurrency(billingMetrics?.todayUpi || 0)}
            </div>
            <div className="text-[10px] text-stone-500 font-medium mt-1">Direct Bank QR</div>
          </div>

          {/* Today's Bills */}
          <div className="p-4 bg-white rounded-2xl border border-[var(--color-border)] shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider">Today's Bills</span>
              <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <Receipt size={14} />
              </div>
            </div>
            <div className="text-xl font-extrabold text-stone-900 mt-2 font-mono">
              {billingMetrics?.todayBills || 0}
            </div>
            <div className="text-[10px] text-stone-500 font-medium mt-1">Generated bills</div>
          </div>

          {/* Pending Payments */}
          <div className="p-4 bg-white rounded-2xl border border-[var(--color-border)] shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider">Pending</span>
              <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                <Clock size={14} />
              </div>
            </div>
            <div className="text-xl font-extrabold text-amber-600 mt-2 font-mono">
              {billingMetrics?.pendingPayments || 0}
            </div>
            <div className="text-[10px] text-amber-700 font-medium mt-1">Awaiting collection</div>
          </div>

          {/* Cancelled Bills */}
          <div className="p-4 bg-white rounded-2xl border border-[var(--color-border)] shadow-xs col-span-2 sm:col-span-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider">Cancelled Bills</span>
              <div className="w-7 h-7 rounded-lg bg-red-50 text-red-600 flex items-center justify-center">
                <XCircle size={14} />
              </div>
            </div>
            <div className="text-xl font-extrabold text-red-600 mt-2 font-mono">
              {billingMetrics?.cancelledBills || 0}
            </div>
            <div className="text-[10px] text-red-700 font-medium mt-1">Voided bills</div>
          </div>
        </div>
      </div>


      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => <SkeletonStatCard key={i} />)
          : cards.map((card, i) => (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="stat-card"
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${card.color}`}>
                  <card.icon size={20} />
                </div>
                <span className={`text-xs font-medium px-2 py-1 rounded-lg flex items-center gap-1 ${
                  card.changeType === 'up' ? 'text-green-600 bg-green-50' :
                  card.changeType === 'warning' ? 'text-amber-600 bg-amber-50' :
                  'text-[var(--color-text-tertiary)] bg-[var(--color-background)]'
                }`}>
                  {card.changeType === 'up' && <ArrowUpRight size={12} />}
                  {card.change}
                </span>
              </div>
              <div className="text-3xl font-bold text-[var(--color-text-primary)] mb-1">
                {card.value}
              </div>
              <div className="text-sm text-[var(--color-text-secondary)]">{card.label}</div>
            </motion.div>
          ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Orders by Hour Chart */}
        <div className="card p-6 xl:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-semibold text-[var(--color-text-primary)]">Orders Today</h2>
              <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">Hourly order volume</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-[var(--color-text-tertiary)]">
              <div className="w-3 h-3 rounded-sm bg-[var(--color-accent)] opacity-60" />
              Orders
            </div>
          </div>
          {loading ? (
            <div className="skeleton h-48 w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={hourlyData}>
                <defs>
                  <linearGradient id="colorOrders" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0ede8" />
                <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#9c9690' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#9c9690' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    background: 'white',
                    border: '1px solid #e8e6e1',
                    borderRadius: '12px',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.06)',
                    fontSize: '13px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="orders"
                  stroke="#f97316"
                  strokeWidth={2}
                  fill="url(#colorOrders)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Revenue by Hour */}
        <div className="card p-6">
          <div className="mb-6">
            <h2 className="font-semibold text-[var(--color-text-primary)]">Revenue Today</h2>
            <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">By hour</p>
          </div>
          {loading ? (
            <div className="skeleton h-48 w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={hourlyData.slice(-8)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0ede8" />
                <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#9c9690' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#9c9690' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    background: 'white',
                    border: '1px solid #e8e6e1',
                    borderRadius: '12px',
                    fontSize: '12px',
                  }}
                  formatter={(value: any) => [formatCurrency(Number(value) || 0), 'Revenue']}
                />
                <Bar dataKey="revenue" fill="#f97316" radius={[4, 4, 0, 0]} opacity={0.85} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Recent Orders */}
      <div className="card">
        <div className="flex items-center justify-between p-6 border-b border-[var(--color-border-subtle)]">
          <h2 className="font-semibold text-[var(--color-text-primary)]">Recent Orders</h2>
          <a href="/admin/orders" className="text-sm text-[var(--color-accent)] hover:underline flex items-center gap-1">
            View all <TrendingUp size={14} />
          </a>
        </div>

        {loading ? (
          <div className="divide-y divide-[var(--color-border-subtle)]">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="p-4 flex items-center gap-4">
                <div className="skeleton h-10 w-10 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-4 w-40" />
                  <div className="skeleton h-3 w-60" />
                </div>
                <div className="skeleton h-6 w-20" />
              </div>
            ))}
          </div>
        ) : recentOrders.length === 0 ? (
          <div className="p-12 text-center">
            <ShoppingBag size={40} className="text-[var(--color-text-tertiary)] mx-auto mb-3" />
            <p className="text-[var(--color-text-secondary)] font-medium">No orders yet today</p>
            <p className="text-sm text-[var(--color-text-tertiary)]">Orders will appear here as customers scan QR codes</p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--color-border-subtle)]">
            {recentOrders.map((order) => (
              <div key={order.id} className="p-4 flex items-center gap-4 hover:bg-[var(--color-background)] transition-colors">
                <div className="w-10 h-10 bg-[var(--color-background)] rounded-xl flex items-center justify-center text-sm font-bold text-[var(--color-accent)]">
                  #{order.order_number}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-[var(--color-text-primary)]">
                    Table {order.table?.table_number}
                  </div>
                  <div className="text-xs text-[var(--color-text-tertiary)]">
                    {order.order_items?.length} items · {timeAgo(order.created_at)}
                  </div>
                </div>
                <div className="text-sm font-semibold text-[var(--color-text-primary)]">
                  {formatCurrency(order.total)}
                </div>
                <StatusBadge status={order.status} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
