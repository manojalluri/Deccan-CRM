import { useState, useMemo, useEffect } from 'react'
import {
  Receipt, Percent, Tag, Banknote, Smartphone,
  Layers, Split, CheckSquare, Square, Info, Sparkles
} from 'lucide-react'
import { Dialog } from '@/components/ui/Dialog'
import { calculateBill } from '@/services'
import { billingService } from '@/services'
import type { Order, Restaurant, Bill, DiscountType } from '@/types/database'
import { formatCurrency, timeAgo } from '@/lib/utils'
import toast from 'react-hot-toast'

interface GenerateBillModalProps {
  open: boolean
  onClose: () => void
  order: Order | null
  allOrders?: Order[]
  orderBills?: Record<string, Bill>
  restaurant?: Restaurant | null
  cashierName?: string
  onBillGenerated: (bill: Bill, paymentMode: 'UPI' | 'CASH' | 'NONE') => void
}

export function GenerateBillModal({
  open,
  onClose,
  order,
  allOrders = [],
  orderBills = {},
  restaurant,
  cashierName = 'Staff',
  onBillGenerated,
}: GenerateBillModalProps) {
  const [discountType, setDiscountType] = useState<DiscountType>('none')
  const [discountValue, setDiscountValue] = useState<number>(0)
  const [notes, setNotes] = useState('')
  const [generating, setGenerating] = useState(false)

  // 1. Discover all active unbilled orders for this table/sitting
  const eligibleTableOrders = useMemo(() => {
    if (!order) return []
    // Filter orders matching table_id (or table_number), not cancelled, and not already attached to a PAID bill
    const matches = allOrders.filter(o => {
      const isSameTable = (o.table_id && o.table_id === order.table_id) ||
        (o.table?.table_number && order.table?.table_number && o.table.table_number === order.table.table_number)
      if (!isSameTable) return false
      if (o.status === 'cancelled') return false

      const existingBill = orderBills[o.id]
      if (existingBill && existingBill.status === 'PAID') return false
      return true
    })

    // Ensure currently selected order is included
    if (!matches.some(o => o.id === order.id)) {
      matches.unshift(order)
    }

    // Sort by order_number ascending
    return matches.sort((a, b) => a.order_number - b.order_number)
  }, [order, allOrders, orderBills])

  // 2. Selection state: by default, combine ALL active orders for this table!
  const hasMultipleTableOrders = eligibleTableOrders.length > 1
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([])
  const [billMode, setBillMode] = useState<'combined' | 'separate'>('combined')

  // Initialize selection whenever modal opens or order changes
  useEffect(() => {
    if (order) {
      if (hasMultipleTableOrders) {
        // DEFAULT REQUIREMENT: Tally all orders from the table together!
        setSelectedOrderIds(eligibleTableOrders.map(o => o.id))
        setBillMode('combined')
      } else {
        setSelectedOrderIds([order.id])
        setBillMode('separate')
      }
    }
  }, [order, hasMultipleTableOrders, eligibleTableOrders])

  const handleToggleOrder = (orderId: string) => {
    setSelectedOrderIds(prev => {
      let next: string[]
      if (prev.includes(orderId)) {
        if (prev.length <= 1) {
          toast.error('At least one order must be selected for the bill.')
          return prev
        }
        next = prev.filter(id => id !== orderId)
      } else {
        next = [...prev, orderId]
      }
      return next
    })
  }

  const handleSelectAll = () => {
    setSelectedOrderIds(eligibleTableOrders.map(o => o.id))
    setBillMode('combined')
  }

  const handleSelectCurrentOnly = () => {
    if (!order) return
    setSelectedOrderIds([order.id])
    setBillMode('separate')
  }

  // Active orders selected for this bill
  const activeOrdersForBill = useMemo(() => {
    return eligibleTableOrders.filter(o => selectedOrderIds.includes(o.id))
  }, [eligibleTableOrders, selectedOrderIds])

  // Collect all items across selected orders
  const allSelectedItems = useMemo(() => {
    return activeOrdersForBill.flatMap(o =>
      (o.order_items || []).map(item => ({
        ...item,
        order_number: o.order_number,
        order_id: o.id,
      }))
    )
  }, [activeOrdersForBill])

  // Centralized Financial Calculation
  const calculation = useMemo(() => {
    if (allSelectedItems.length === 0) {
      return {
        subtotal: 0,
        discountType: 'none' as DiscountType,
        discountValue: 0,
        discountAmount: 0,
        taxableAmount: 0,
        cgstRate: 2.5,
        sgstRate: 2.5,
        cgstAmount: 0,
        sgstAmount: 0,
        taxAmount: 0,
        roundOff: 0,
        grandTotal: 0,
      }
    }

    const items = allSelectedItems.map(i => ({
      price: Number(i.price ?? i.item_price ?? 0),
      quantity: i.quantity,
      item_name: i.item_name,
    }))

    return calculateBill({
      items,
      discountType,
      discountValue,
      taxEnabled: restaurant?.tax_enabled ?? true,
      cgstRate: Number(restaurant?.cgst_rate ?? 2.5),
      sgstRate: Number(restaurant?.sgst_rate ?? 2.5),
      serviceChargeRate: Number(restaurant?.service_charge_rate ?? 0),
    })
  }, [allSelectedItems, discountType, discountValue, restaurant])

  const handleGenerate = async (paymentMode: 'UPI' | 'CASH' | 'NONE') => {
    if (!order || !restaurant || selectedOrderIds.length === 0) return

    setGenerating(true)
    const isCombinedBill = selectedOrderIds.length > 1
    const { data: bill, error } = await billingService.generateBillFromOrder({
      orderId: order.id,
      orderIds: selectedOrderIds,
      restaurantId: restaurant.id,
      cashierName,
      discountType,
      discountValue,
      notes: notes || (isCombinedBill ? `Combined table sitting (${activeOrdersForBill.map(o => `#${o.order_number}`).join(', ')})` : undefined),
    })
    setGenerating(false)

    if (error || !bill) {
      toast.error(error || 'Failed to generate bill')
      return
    }

    toast.success(
      isCombinedBill
        ? `Combined Bill ${bill.bill_number} Generated for ${selectedOrderIds.length} orders!`
        : `Bill ${bill.bill_number} Generated!`
    )
    onClose()
    onBillGenerated(bill, paymentMode)
  }

  if (!order) return null

  const isMultipleSelected = selectedOrderIds.length > 1

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isMultipleSelected ? 'Generate Combined Table Bill' : 'Generate Restaurant Bill'}
      description={`Table ${order.table?.table_number || '-'} • ${
        isMultipleSelected
          ? `${selectedOrderIds.length} Orders Combined (Tallied Together)`
          : `Order #${order.order_number}`
      }`}
      size="md"
    >
      <div className="space-y-2.5 -mt-2">
        {/* Table Orders Detected Banner (Compact & Sleek) */}
        {hasMultipleTableOrders && (
          <div className="p-2.5 bg-gradient-to-r from-amber-50 to-orange-50/60 border border-amber-200/90 rounded-xl space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <Layers size={14} className="text-amber-600 shrink-0" />
                <span className="text-xs font-bold text-amber-950 truncate">
                  Table Orders ({eligibleTableOrders.length})
                </span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-200 text-amber-900 font-extrabold uppercase shrink-0">
                  Combined
                </span>
              </div>

              {/* Compact Mode Switch */}
              <div className="inline-flex p-0.5 rounded-lg bg-amber-200/60 border border-amber-300 text-[11px] shrink-0">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className={`px-2 py-0.5 rounded-md font-semibold transition-all ${
                    isMultipleSelected && billMode === 'combined'
                      ? 'bg-amber-600 text-white shadow-2xs'
                      : 'text-amber-900 hover:text-amber-950'
                  }`}
                >
                  All ({eligibleTableOrders.length})
                </button>
                <button
                  type="button"
                  onClick={handleSelectCurrentOnly}
                  className={`px-2 py-0.5 rounded-md font-semibold transition-all ${
                    !isMultipleSelected || billMode === 'separate'
                      ? 'bg-stone-800 text-white shadow-2xs'
                      : 'text-amber-900 hover:text-amber-950'
                  }`}
                >
                  Separate
                </button>
              </div>
            </div>

            {/* Compact Order Chips / Selectors */}
            <div className="flex flex-wrap gap-1.5">
              {eligibleTableOrders.map(tOrder => {
                const isChecked = selectedOrderIds.includes(tOrder.id)
                const itemsCount = tOrder.order_items?.length || 0
                const isPrimary = tOrder.id === order.id
                return (
                  <button
                    key={tOrder.id}
                    type="button"
                    onClick={() => handleToggleOrder(tOrder.id)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs transition-all ${
                      isChecked
                        ? 'bg-white border-amber-400 text-stone-900 shadow-2xs font-semibold'
                        : 'bg-amber-50/40 border-amber-200/70 text-stone-400 hover:bg-white'
                    }`}
                  >
                    {isChecked ? (
                      <CheckSquare size={13} className="text-amber-600 shrink-0" />
                    ) : (
                      <Square size={13} className="text-stone-300 shrink-0" />
                    )}
                    <span>Order #{tOrder.order_number}</span>
                    {isPrimary && (
                      <span className="text-[9px] px-1 py-0.2 rounded bg-amber-100 text-amber-800 font-bold">
                        Current
                      </span>
                    )}
                    <span className="text-[11px] font-normal text-stone-500">
                      ({itemsCount})
                    </span>
                    <span className="font-mono font-bold text-stone-800 ml-0.5">
                      {formatCurrency(Number(tOrder.total || 0))}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Ordered items breakdown */}
        <div className="bg-[var(--color-surface-subtle)] border border-[var(--color-border)] rounded-xl p-2.5 max-h-36 overflow-y-auto space-y-1.5">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-1 flex justify-between">
            <span className="flex items-center gap-1.5">
              <span>Ordered Items</span>
              {isMultipleSelected && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 font-bold normal-case">
                  {selectedOrderIds.length} orders
                </span>
              )}
            </span>
            <span>{allSelectedItems.length} items</span>
          </div>

          {allSelectedItems.map((item, idx) => (
            <div key={`${item.id}-${idx}`} className="flex justify-between items-center text-xs py-0.5">
              <div className="flex items-center gap-2 flex-1 truncate pr-2">
                {isMultipleSelected && (
                  <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-amber-100/90 text-amber-900 font-bold border border-amber-200 shrink-0">
                    #{item.order_number}
                  </span>
                )}
                <span className="font-semibold text-stone-700 shrink-0">{item.quantity}×</span>
                <span className="truncate text-stone-900 font-medium">{item.item_name}</span>
              </div>
              <span className="font-medium font-mono text-stone-800 shrink-0">
                {formatCurrency(Number(item.price ?? item.item_price ?? 0) * item.quantity)}
              </span>
            </div>
          ))}
        </div>

        {/* Discount controls */}
        <div className="p-2.5 bg-stone-50 border border-stone-200/80 rounded-xl space-y-2">
          <div className="text-xs font-semibold text-stone-800 flex items-center gap-1.5">
            <Tag size={13} className="text-[var(--color-accent)]" />
            <span>Apply Bill Discount</span>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setDiscountType('none'); setDiscountValue(0) }}
              className={`flex-1 py-1 text-xs rounded-lg border transition-all ${
                discountType === 'none'
                  ? 'bg-stone-800 text-white font-semibold border-stone-800'
                  : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-100'
              }`}
            >
              No Discount
            </button>
            <button
              type="button"
              onClick={() => { setDiscountType('percentage'); if (!discountValue) setDiscountValue(10) }}
              className={`flex-1 py-1 text-xs rounded-lg border transition-all flex items-center justify-center gap-1 ${
                discountType === 'percentage'
                  ? 'bg-[var(--color-accent)] text-white font-semibold border-[var(--color-accent)]'
                  : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-100'
              }`}
            >
              <Percent size={11} />
              <span>Percent (%)</span>
            </button>
            <button
              type="button"
              onClick={() => { setDiscountType('fixed'); if (!discountValue) setDiscountValue(50) }}
              className={`flex-1 py-1 text-xs rounded-lg border transition-all flex items-center justify-center gap-1 ${
                discountType === 'fixed'
                  ? 'bg-[var(--color-accent)] text-white font-semibold border-[var(--color-accent)]'
                  : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-100'
              }`}
            >
              <span>Fixed (₹)</span>
            </button>
          </div>

          {discountType !== 'none' && (
            <div className="flex items-center gap-2 pt-0.5">
              <span className="text-xs text-stone-600 font-medium">
                {discountType === 'percentage' ? 'Discount %:' : 'Discount Amount (₹):'}
              </span>
              <input
                type="number"
                min="0"
                max={discountType === 'percentage' ? 100 : calculation.subtotal}
                value={discountValue}
                onChange={e => setDiscountValue(Math.max(0, Number(e.target.value) || 0))}
                className="w-24 h-7 px-2.5 text-xs font-semibold bg-white border border-stone-300 rounded-lg outline-none focus:border-[var(--color-accent)]"
              />
            </div>
          )}
        </div>

        {/* Calculation summary */}
        <div className="border border-[var(--color-border)] rounded-xl p-2.5 space-y-1 text-xs">
          <div className="flex justify-between text-stone-600">
            <span>Subtotal {isMultipleSelected ? `(${selectedOrderIds.length} orders)` : ''}</span>
            <span className="font-mono font-semibold">{formatCurrency(calculation.subtotal)}</span>
          </div>

          {calculation.discountAmount > 0 && (
            <div className="flex justify-between text-emerald-700 font-medium">
              <span>Discount</span>
              <span className="font-mono">-{formatCurrency(calculation.discountAmount)}</span>
            </div>
          )}

          {calculation.cgstAmount > 0 && (
            <div className="flex justify-between text-stone-600">
              <span>CGST ({calculation.cgstRate}%)</span>
              <span className="font-mono">{formatCurrency(calculation.cgstAmount)}</span>
            </div>
          )}

          {calculation.sgstAmount > 0 && (
            <div className="flex justify-between text-stone-600">
              <span>SGST ({calculation.sgstRate}%)</span>
              <span className="font-mono">{formatCurrency(calculation.sgstAmount)}</span>
            </div>
          )}

          {calculation.roundOff !== 0 && (
            <div className="flex justify-between text-stone-500 text-[11px]">
              <span>Round Off</span>
              <span className="font-mono">
                {calculation.roundOff > 0 ? '+' : ''}{formatCurrency(calculation.roundOff)}
              </span>
            </div>
          )}

          <div className="pt-1.5 border-t border-[var(--color-border)] flex justify-between items-baseline">
            <span className="font-bold text-xs text-[var(--color-text-primary)]">
              {isMultipleSelected ? 'Combined Total' : 'Grand Total'}
            </span>
            <span className="font-extrabold text-lg text-[var(--color-accent)] font-mono">
              {formatCurrency(calculation.grandTotal)}
            </span>
          </div>
        </div>

        {/* Action Buttons: Cash, UPI, and Bill Only */}
        <div className="space-y-1.5 pt-1 border-t border-[var(--color-border)]">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleGenerate('CASH')}
              disabled={generating || selectedOrderIds.length === 0}
              className="btn h-9 text-xs font-bold flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs disabled:opacity-50"
            >
              <Banknote size={15} />
              <span>Pay Cash ({formatCurrency(calculation.grandTotal)})</span>
            </button>

            <button
              type="button"
              onClick={() => handleGenerate('UPI')}
              disabled={generating || selectedOrderIds.length === 0}
              className="btn btn-primary h-9 text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-50"
            >
              <Smartphone size={15} />
              <span>Pay UPI ({formatCurrency(calculation.grandTotal)})</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => handleGenerate('NONE')}
            disabled={generating || selectedOrderIds.length === 0}
            className="w-full btn btn-secondary h-8 text-xs font-medium text-stone-600 hover:text-stone-900 flex items-center justify-center gap-1 disabled:opacity-50"
          >
            <Receipt size={13} />
            <span>Generate Bill Only (Pay Later)</span>
          </button>
        </div>
      </div>
    </Dialog>
  )
}
