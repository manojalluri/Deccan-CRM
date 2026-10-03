import { useEffect, useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Receipt, Search, RefreshCw, Printer, Eye,
  XCircle, Filter, Download, ArrowUpRight, CheckCircle2,
  Calendar, CreditCard, ChevronRight, FileText
} from 'lucide-react'
import { PageHeader } from '@/components/admin/PageHeader'
import { EmptyState } from '@/components/ui'
import { BillDetailModal } from '@/components/billing/BillDetailModal'
import { UPIPaymentModal } from '@/components/billing/UPIPaymentModal'
import { useAuth } from '@/contexts/AuthContext'
import { billingService, restaurantService } from '@/services'
import type { Bill, Restaurant } from '@/types/database'
import { formatCurrency } from '@/lib/utils'
import toast from 'react-hot-toast'

const dateTabs = [
  { label: 'Today', value: 'today' },
  { label: 'Yesterday', value: 'yesterday' },
  { label: 'This Week', value: 'week' },
  { label: 'This Month', value: 'month' },
  { label: 'All Time', value: 'all' },
] as const

const statusTabs = [
  { label: 'All Statuses', value: 'all' },
  { label: 'Paid', value: 'PAID' },
  { label: 'Pending', value: 'PENDING_PAYMENT' },
  { label: 'Cancelled', value: 'CANCELLED' },
]

export function BillingHistoryPage() {
  const { profile } = useAuth()
  const [bills, setBills] = useState<Bill[]>([])
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [loading, setLoading] = useState(true)
  const [dateFilter, setDateFilter] = useState<'today' | 'yesterday' | 'week' | 'month' | 'all'>('today')
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null)
  const [payBill, setPayBill] = useState<Bill | null>(null)

  const fetchBillsAndRestaurant = async () => {
    if (!profile?.restaurant_id) return
    setLoading(true)

    const [billsData, restData] = await Promise.all([
      billingService.getBillsByRestaurant(profile.restaurant_id, {
        dateFilter,
        status: statusFilter,
        searchQuery,
      }),
      restaurantService.getById(profile.restaurant_id),
    ])

    setBills(billsData)
    if (restData) setRestaurant(restData)
    setLoading(false)
  }

  useEffect(() => {
    fetchBillsAndRestaurant()
  }, [profile?.restaurant_id, dateFilter, statusFilter])

  // Aggregate summary metrics
  const stats = useMemo(() => {
    let totalSales = 0
    let paidCount = 0
    let pendingCount = 0
    let upiTotal = 0

    for (const b of bills) {
      if (b.status === 'PAID') {
        const val = Number(b.grand_total) || 0
        totalSales += val
        paidCount++
        if (b.payment_method === 'UPI') {
          upiTotal += val
        }
      } else if (b.status === 'PENDING_PAYMENT') {
        pendingCount++
      }
    }

    return {
      totalSales,
      totalBills: bills.length,
      paidCount,
      pendingCount,
      upiTotal,
    }
  }, [bills])

  const filteredBills = useMemo(() => {
    if (!searchQuery.trim()) return bills
    const q = searchQuery.toLowerCase().trim()
    return bills.filter(b =>
      b.bill_number.toLowerCase().includes(q) ||
      String(b.order_number || '').toLowerCase().includes(q) ||
      String(b.table_number || '').toLowerCase().includes(q) ||
      (b.customer_name && b.customer_name.toLowerCase().includes(q)) ||
      (b.payments && b.payments.some(p => p.transaction_reference.toLowerCase().includes(q)))
    )
  }, [bills, searchQuery])

  const handleExportCSV = () => {
    if (bills.length === 0) {
      toast.error('No bills to export')
      return
    }

    const headers = ['Bill Number', 'Date', 'Order #', 'Table', 'Cashier', 'Subtotal', 'Tax', 'Discount', 'Grand Total', 'Status', 'Payment Method']
    const rows = bills.map(b => [
      b.bill_number,
      new Date(b.created_at).toLocaleString(),
      b.order_number || '',
      b.table_number || '',
      b.cashier_name || '',
      b.subtotal,
      b.tax_amount,
      b.discount_amount,
      b.grand_total,
      b.status,
      b.payment_method || 'UPI',
    ])

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `bills_${dateFilter}_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success('Bills exported as CSV')
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="POS Billing & Invoices"
        description="Review generated invoices, track UPI payment collections, print and reprint receipts."
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="btn btn-secondary btn-sm h-9 px-3 text-xs flex items-center gap-1.5"
            >
              <Download size={14} />
              <span>Export CSV</span>
            </button>
            <button
              onClick={fetchBillsAndRestaurant}
              className="btn btn-secondary btn-icon-sm h-9 w-9 text-xs"
              title="Refresh bills"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        }
      />

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-xs">
          <div className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
            Total Revenue
          </div>
          <div className="text-2xl font-bold text-[var(--color-text-primary)] mt-1">
            {formatCurrency(stats.totalSales)}
          </div>
          <div className="text-[11px] text-emerald-600 font-medium mt-1">
            {stats.paidCount} Paid Invoices
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-xs">
          <div className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
            UPI Collections
          </div>
          <div className="text-2xl font-bold text-[var(--color-accent)] mt-1">
            {formatCurrency(stats.upiTotal)}
          </div>
          <div className="text-[11px] text-[var(--color-text-tertiary)] font-medium mt-1">
            Direct Bank QR
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-xs">
          <div className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
            Total Invoices
          </div>
          <div className="text-2xl font-bold text-[var(--color-text-primary)] mt-1">
            {stats.totalBills}
          </div>
          <div className="text-[11px] text-[var(--color-text-tertiary)] font-medium mt-1">
            In selected timeframe
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-xs">
          <div className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
            Pending Payment
          </div>
          <div className="text-2xl font-bold text-amber-600 mt-1">
            {stats.pendingCount}
          </div>
          <div className="text-[11px] text-amber-700 font-medium mt-1">
            Requires cashier collection
          </div>
        </div>
      </div>

      {/* Filters & Search Controls */}
      <div className="space-y-3">
        {/* Date Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] pb-3">
          <div className="flex items-center gap-1.5 p-1 bg-[var(--color-surface-subtle)] border border-[var(--color-border)] rounded-xl">
            {dateTabs.map(tab => (
              <button
                key={tab.value}
                onClick={() => setDateFilter(tab.value)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                  dateFilter === tab.value
                    ? 'bg-white text-[var(--color-text-primary)] font-semibold shadow-xs'
                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Bar */}
          <div className="relative w-full sm:w-72">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              placeholder="Search bill#, order#, table..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full h-9 pl-9 pr-3 text-xs bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl outline-none focus:border-[var(--color-accent)] transition-all"
            />
          </div>
        </div>

        {/* Status Filter Badges */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {statusTabs.map(tab => (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={`px-3 py-1 text-xs rounded-full border transition-all ${
                statusFilter === tab.value
                  ? 'bg-stone-900 text-white font-semibold border-stone-900'
                  : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Bills Data Table */}
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-12 text-center text-xs text-stone-500 flex items-center justify-center gap-2">
            <RefreshCw className="animate-spin" size={16} />
            <span>Loading bills...</span>
          </div>
        ) : filteredBills.length === 0 ? (
          <EmptyState
            icon={<Receipt size={28} />}
            title="No Invoices Found"
            description="No bills have been generated for this time range or filter query."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[var(--color-surface-subtle)] border-b border-[var(--color-border)] text-stone-500 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3.5 px-4">Bill No</th>
                  <th className="py-3.5 px-4">Order / Table</th>
                  <th className="py-3.5 px-4">Date & Time</th>
                  <th className="py-3.5 px-4">Items</th>
                  <th className="py-3.5 px-4">Grand Total</th>
                  <th className="py-3.5 px-4">Payment Method</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border-subtle)] font-medium">
                {filteredBills.map(bill => (
                  <tr
                    key={bill.id}
                    className="hover:bg-[var(--color-surface-subtle)]/70 transition-colors"
                  >
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-[var(--color-text-primary)] font-mono">
                        {bill.bill_number}
                      </div>
                      <div className="text-[10px] text-stone-400">
                        Cashier: {bill.cashier_name || 'Staff'}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-stone-800">
                        Table {bill.table_number || '-'}
                      </div>
                      <div className="text-[11px] text-stone-500 flex items-center gap-1">
                        <span>{bill.order_numbers ? `Orders ${bill.order_numbers}` : `Order #${bill.order_number || '-'}`}</span>
                        {bill.is_combined && (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-amber-100 text-amber-800 font-bold border border-amber-200">
                            Combined
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-stone-600">
                      <div>
                        {new Date(bill.created_at).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                        })}
                      </div>
                      <div className="text-[11px] text-stone-400">
                        {new Date(bill.created_at).toLocaleTimeString('en-IN', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-stone-600">
                      {bill.bill_items?.length || 0} items
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-extrabold text-[var(--color-text-primary)] font-mono text-sm">
                        {formatCurrency(bill.grand_total)}
                      </div>
                      {bill.discount_amount > 0 && (
                        <div className="text-[10px] text-emerald-600 font-semibold">
                          Disc: -{formatCurrency(bill.discount_amount)}
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-stone-100 text-stone-700 font-semibold text-[11px]">
                        <CreditCard size={12} className="text-[var(--color-accent)]" />
                        {bill.payment_method || 'UPI'}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                          bill.status === 'PAID'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : bill.status === 'CANCELLED'
                            ? 'bg-red-50 text-red-700 border border-red-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {bill.status === 'PAID' && <CheckCircle2 size={12} />}
                        <span>{bill.status}</span>
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {bill.status === 'PENDING_PAYMENT' && (
                          <button
                            onClick={() => setPayBill(bill)}
                            className="btn btn-primary btn-sm h-8 px-2.5 text-xs flex items-center gap-1"
                          >
                            <span>Collect</span>
                            <ArrowUpRight size={13} />
                          </button>
                        )}

                        <button
                          onClick={() => setSelectedBill(bill)}
                          className="btn btn-secondary btn-sm h-8 px-2.5 text-xs flex items-center gap-1 hover:border-[var(--color-accent)]"
                          title="View & Print Bill"
                        >
                          <Printer size={13} />
                          <span>{bill.print_count > 0 ? 'Reprint' : 'Print'}</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Bill Detail / Reprint Modal */}
      {selectedBill && (
        <BillDetailModal
          open={!!selectedBill}
          onClose={() => setSelectedBill(null)}
          bill={selectedBill}
          restaurant={restaurant}
          onBillUpdated={fetchBillsAndRestaurant}
        />
      )}

      {/* UPI Payment Modal */}
      {payBill && (
        <UPIPaymentModal
          open={!!payBill}
          onClose={() => setPayBill(null)}
          bill={payBill}
          restaurant={restaurant}
          onPaymentSuccess={() => {
            fetchBillsAndRestaurant()
          }}
        />
      )}
    </div>
  )
}
