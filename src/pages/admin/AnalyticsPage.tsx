import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import { Calendar, DollarSign, ShoppingBag, Users, Activity, CreditCard } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { analyticsService } from '@/services'
import { formatCurrency } from '@/lib/utils'
import { PageHeader } from '@/components/admin/PageHeader'
import { DataTable } from '@/components/ui/DataTable'
import { StatusBadge } from '@/components/ui'
import type { Order } from '@/types/database'

const PIE_COLORS = ['#E76F2F', '#3b82f6', '#22c55e', '#a855f7', '#ef4444', '#6b7280']

export function AnalyticsPage() {
  const { profile } = useAuth()
  const [stats, setStats] = useState<{
    todayOrders: number
    todayRevenue: number
    pendingOrders: number
    activeTables: number
    orders: Order[]
  } | null>(null)
  const [popularItems, setPopularItems] = useState<{ name: string; count: number }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile?.restaurant_id) return
    const load = async () => {
      const [s, items] = await Promise.all([
        analyticsService.getDashboardStats(profile.restaurant_id!),
        analyticsService.getPopularItems(profile.restaurant_id!),
      ])
      setStats(s as any)
      setPopularItems(items)
      setLoading(false)
    }
    load()
  }, [profile?.restaurant_id])

  const hourlyData = stats ? (() => {
    const hours = Array.from({ length: 24 }, (_, i) => ({ hour: i, orders: 0, revenue: 0 }))
    stats.orders.forEach(o => {
      if (o.status !== 'cancelled') {
        const h = new Date(o.created_at).getHours()
        hours[h].orders += 1
        hours[h].revenue += o.total
      }
    })
    return hours.filter(h => h.hour >= 7 || h.orders > 0).map(h => ({
      time: h.hour === 12 ? '12PM' : h.hour > 12 ? `${h.hour - 12}PM` : `${h.hour}AM`,
      orders: h.orders,
      revenue: Math.round(h.revenue),
    }))
  })() : []

  const statusData = stats ? (() => {
    const counts: Record<string, number> = {}
    stats.orders.forEach(o => { counts[o.status] = (counts[o.status] || 0) + 1 })
    return Object.entries(counts).map(([name, value]) => ({ name, value }))
  })() : []

  const averageOrderValue = stats?.todayOrders ? (stats.todayRevenue / stats.todayOrders) : 0

  const transactionColumns = [
    { header: 'Order ID', cell: (order: Order) => <span className="font-semibold">#{order.order_number}</span> },
    { header: 'Date', cell: (order: Order) => <span className="text-[var(--color-text-secondary)]">{new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span> },
    { header: 'Amount', cell: (order: Order) => <span className="font-medium text-[var(--color-text-primary)]">{formatCurrency(order.total)}</span> },
    { header: 'Status', cell: (order: Order) => <StatusBadge status={order.status} /> }
  ]

  return (
    <div>
      <PageHeader
        title="Analytics"
        description="Track your restaurant's performance."
        action={
          <div className="flex items-center gap-2 px-4 py-2 bg-white border border-[var(--color-border)] rounded-[12px] text-sm font-medium text-[var(--color-text-primary)] shadow-sm">
            <Calendar size={16} className="text-[var(--color-text-secondary)]" />
            Today, {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[
          { label: "Total Revenue", value: formatCurrency(stats?.todayRevenue || 0), icon: DollarSign, color: 'text-green-600 bg-green-50' },
          { label: "Total Orders", value: stats?.todayOrders || 0, icon: ShoppingBag, color: 'text-blue-600 bg-blue-50' },
          { label: "Avg. Order Value", value: formatCurrency(averageOrderValue), icon: Activity, color: 'text-purple-600 bg-purple-50' },
          { label: 'Active Tables', value: stats?.activeTables || 0, icon: Users, color: 'text-orange-600 bg-orange-50' },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="card p-6"
          >
            <div className="flex justify-between items-start mb-4">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${stat.color}`}>
                <stat.icon size={24} />
              </div>
            </div>
            <div className="text-3xl font-black text-[var(--color-text-primary)] mb-1">
              {loading ? '—' : stat.value}
            </div>
            <div className="text-sm font-medium text-[var(--color-text-secondary)]">{stat.label}</div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-8">
        {/* Revenue Over Time */}
        <div className="card p-6 xl:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-bold text-lg">Revenue Over Time</h2>
              <p className="text-sm text-[var(--color-text-secondary)]">Today's hourly revenue</p>
            </div>
          </div>
          {loading ? (
            <div className="skeleton h-64" />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={hourlyData}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" vertical={false} />
                <XAxis dataKey="time" tick={{ fontSize: 12, fill: 'var(--color-text-tertiary)' }} axisLine={false} tickLine={false} dy={10} />
                <YAxis tick={{ fontSize: 12, fill: 'var(--color-text-tertiary)' }} axisLine={false} tickLine={false} dx={-10} tickFormatter={(val) => `₹${val}`} />
                <Tooltip contentStyle={{ background: 'white', border: '1px solid var(--color-border)', borderRadius: '12px', fontSize: '13px', boxShadow: 'var(--shadow-md)' }} />
                <Area type="monotone" dataKey="revenue" stroke="#22c55e" strokeWidth={3} fill="url(#colorRev)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Order Status Distribution */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-bold text-lg">Status Distribution</h2>
              <p className="text-sm text-[var(--color-text-secondary)]">Order split by status</p>
            </div>
          </div>
          {loading ? (
            <div className="skeleton h-64" />
          ) : statusData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-[var(--color-text-tertiary)] text-sm">
              No orders today
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {statusData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: 'white', border: '1px solid var(--color-border)', borderRadius: '12px', fontSize: '13px', boxShadow: 'var(--shadow-md)' }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '13px' }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Popular Items */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-bold text-lg">Popular Items</h2>
              <p className="text-sm text-[var(--color-text-secondary)]">Top selling items today</p>
            </div>
          </div>
          {loading ? (
            <div className="skeleton h-64" />
          ) : popularItems.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-[var(--color-text-tertiary)] text-sm">No data</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={popularItems} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 12, fill: 'var(--color-text-tertiary)' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: 'var(--color-text-secondary)', fontWeight: 500 }} axisLine={false} tickLine={false} width={100} />
                <Tooltip cursor={{ fill: 'var(--color-background)' }} contentStyle={{ background: 'white', border: '1px solid var(--color-border)', borderRadius: '12px', fontSize: '13px', boxShadow: 'var(--shadow-md)' }} />
                <Bar dataKey="count" fill="var(--color-accent)" radius={[0, 6, 6, 0]} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Recent Transactions */}
        <div className="card p-0 flex flex-col">
          <div className="p-6 border-b border-[var(--color-border-subtle)]">
            <h2 className="font-bold text-lg flex items-center gap-2">
              <CreditCard size={20} className="text-[var(--color-text-secondary)]" />
              Recent Transactions
            </h2>
            <p className="text-sm text-[var(--color-text-secondary)] mt-1">Latest successful orders</p>
          </div>
          <div className="flex-1 overflow-hidden">
            {loading ? (
              <div className="p-6 space-y-4">
                <div className="skeleton h-10 w-full" />
                <div className="skeleton h-10 w-full" />
                <div className="skeleton h-10 w-full" />
              </div>
            ) : (
              <DataTable
                data={stats?.orders.filter(o => o.status !== 'cancelled').slice(0, 5) || []}
                columns={transactionColumns}
                emptyState={
                  <div className="p-12 text-center text-[var(--color-text-tertiary)]">
                    No recent transactions
                  </div>
                }
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
