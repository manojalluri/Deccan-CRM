import { useState } from 'react'
import {
  Printer, XCircle, Clock, ShieldCheck, ArrowRight,
  AlertTriangle, RotateCcw, Copy, Check
} from 'lucide-react'
import { Dialog } from '@/components/ui/Dialog'
import { ThermalReceipt } from './ThermalReceipt'
import { UPIPaymentModal } from './UPIPaymentModal'
import { billingService } from '@/services'
import type { Bill, Restaurant } from '@/types/database'
import { formatCurrency } from '@/lib/utils'
import toast from 'react-hot-toast'

interface BillDetailModalProps {
  open: boolean
  onClose: () => void
  bill: Bill | null
  restaurant?: Restaurant | null
  onBillUpdated?: () => void
}

export function BillDetailModal({
  open,
  onClose,
  bill,
  restaurant,
  onBillUpdated,
}: BillDetailModalProps) {
  const [activeBill, setActiveBill] = useState<Bill | null>(bill)
  const [showCancelPrompt, setShowCancelPrompt] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelling, setCancelling] = useState(false)
  const [showUPIModal, setShowUPIModal] = useState(false)

  // Sync prop
  if (bill && activeBill?.id !== bill.id) {
    setActiveBill(bill)
  }

  const handleReprint = async () => {
    if (!activeBill) return
    await billingService.recordPrint(activeBill.id)
    const fresh = await billingService.getBillById(activeBill.id)
    if (fresh) setActiveBill(fresh)
    if (onBillUpdated) onBillUpdated()
  }

  const handleCancelBill = async () => {
    if (!activeBill || !cancelReason.trim()) {
      toast.error('Please provide a reason for cancellation')
      return
    }

    setCancelling(true)
    const res = await billingService.cancelBill(activeBill.id, cancelReason.trim())
    setCancelling(false)

    if (!res.success) {
      toast.error(res.error || 'Failed to cancel bill')
      return
    }

    toast.success('Bill cancelled successfully')
    setShowCancelPrompt(false)
    const fresh = await billingService.getBillById(activeBill.id)
    if (fresh) setActiveBill(fresh)
    if (onBillUpdated) onBillUpdated()
  }

  if (!activeBill) return null

  return (
    <>
      <Dialog
        open={open && !showUPIModal}
        onClose={onClose}
        title={`Bill ${activeBill.bill_number}`}
        description={`Table ${activeBill.table_number || '-'} • ${activeBill.order_numbers ? `Orders ${activeBill.order_numbers}` : `Order #${activeBill.order_number || '-'}`}${activeBill.is_combined ? ' (Combined)' : ''}`}
        size="md"
      >
        <div className="space-y-5 -mt-2">
          {/* Status & Quick Action Banner */}
          <div className="flex items-center justify-between p-3.5 bg-[var(--color-surface-subtle)] border border-[var(--color-border)] rounded-2xl">
            <div className="flex items-center gap-2.5">
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                  activeBill.status === 'PAID'
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : activeBill.status === 'CANCELLED'
                    ? 'bg-red-100 text-red-800 border border-red-300'
                    : 'bg-amber-100 text-amber-800 border border-amber-300'
                }`}
              >
                {activeBill.status}
              </span>
              {activeBill.print_count > 0 && (
                <span className="text-xs text-stone-500 font-medium">
                  Printed {activeBill.print_count}×
                </span>
              )}
            </div>

            {/* If pending, pay now button */}
            {activeBill.status === 'PENDING_PAYMENT' && (
              <button
                onClick={() => setShowUPIModal(true)}
                className="btn btn-primary btn-sm text-xs flex items-center gap-1.5 shadow-xs"
              >
                <span>Pay with UPI</span>
                <ArrowRight size={13} />
              </button>
            )}
          </div>

          {/* Cancellation warning banner if cancelled */}
          {activeBill.status === 'CANCELLED' && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <XCircle size={15} />
                <span>Bill Cancelled</span>
              </div>
              <div>Reason: {activeBill.cancellation_reason || 'Not specified'}</div>
              {activeBill.cancelled_by && <div>By: {activeBill.cancelled_by}</div>}
            </div>
          )}

          {/* Thermal Receipt Visual Preview */}
          <ThermalReceipt
            bill={activeBill}
            restaurant={restaurant}
            isReprint={activeBill.print_count > 0}
            onAfterPrint={handleReprint}
          />

          {/* Footer controls: Cancel Bill button for unpaid bills */}
          <div className="flex items-center justify-between pt-3 border-t border-[var(--color-border)] print:hidden">
            <div>
              {activeBill.status === 'PENDING_PAYMENT' && (
                <button
                  onClick={() => setShowCancelPrompt(true)}
                  className="btn btn-ghost text-xs text-red-600 hover:bg-red-50 hover:border-red-200"
                >
                  Cancel Bill
                </button>
              )}
            </div>
            <button onClick={onClose} className="btn btn-secondary text-xs px-5">
              Close
            </button>
          </div>
        </div>
      </Dialog>

      {/* Cancellation Prompt Dialog */}
      <Dialog
        open={showCancelPrompt}
        onClose={() => setShowCancelPrompt(false)}
        title="Cancel Bill"
        description={`Are you sure you want to cancel Bill ${activeBill.bill_number}?`}
        size="sm"
      >
        <div className="space-y-4 -mt-2">
          <p className="text-xs text-stone-600">
            This bill will be marked as CANCELLED in database records for audit and compliance.
          </p>

          <div>
            <label className="text-xs font-semibold text-stone-800 block mb-1">
              Cancellation Reason:
            </label>
            <textarea
              className="input w-full min-h-[70px] text-xs resize-none"
              placeholder="e.g. Customer changed mind, wrong items billed..."
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
            />
          </div>

          <div className="flex gap-2 pt-2 border-t border-[var(--color-border)]">
            <button
              onClick={() => setShowCancelPrompt(false)}
              className="btn btn-secondary flex-1 text-xs"
            >
              Back
            </button>
            <button
              onClick={handleCancelBill}
              disabled={cancelling || !cancelReason.trim()}
              className="btn btn-danger flex-1 text-xs"
            >
              {cancelling ? 'Cancelling...' : 'Confirm Cancel'}
            </button>
          </div>
        </div>
      </Dialog>

      {/* UPI Payment Modal */}
      {showUPIModal && (
        <UPIPaymentModal
          open={showUPIModal}
          onClose={() => setShowUPIModal(false)}
          bill={activeBill}
          restaurant={restaurant}
          onPaymentSuccess={updated => {
            setActiveBill(updated)
            if (onBillUpdated) onBillUpdated()
          }}
        />
      )}
    </>
  )
}
