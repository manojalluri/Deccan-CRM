import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { QRCodeSVG } from 'qrcode.react'
import {
  CheckCircle2, XCircle, RefreshCw, Smartphone,
  ShieldCheck, Banknote, Printer, ArrowRight,
  Sparkles, Clock, Coins
} from 'lucide-react'
import { Dialog } from '@/components/ui/Dialog'
import { ThermalReceipt } from './ThermalReceipt'
import { billingService } from '@/services'
import type { Bill, Payment, Restaurant, PaymentMethod } from '@/types/database'
import { formatCurrency } from '@/lib/utils'
import toast from 'react-hot-toast'

interface UPIPaymentModalProps {
  open: boolean
  onClose: () => void
  bill: Bill | null
  restaurant?: Restaurant | null
  initialMethod?: 'UPI' | 'CASH'
  onPaymentSuccess?: (updatedBill: Bill) => void
}

export function UPIPaymentModal({
  open,
  onClose,
  bill,
  restaurant,
  initialMethod = 'UPI',
  onPaymentSuccess,
}: UPIPaymentModalProps) {
  const [method, setMethod] = useState<'UPI' | 'CASH'>(initialMethod)
  const [loading, setLoading] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [payment, setPayment] = useState<Payment | null>(null)
  const [qrData, setQrData] = useState<string | null>(null)
  const [paymentState, setPaymentState] = useState<'PENDING' | 'PROCESSING' | 'PAID' | 'FAILED' | 'CANCELLED'>('PENDING')
  const [failureReason, setFailureReason] = useState<string | null>(null)
  const [activeBill, setActiveBill] = useState<Bill | null>(bill)

  // Cash payment fields
  const [cashTendered, setCashTendered] = useState<number | string>('')
  const [changeToReturn, setChangeToReturn] = useState<number>(0)
  const [collectingCash, setCollectingCash] = useState(false)

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (!open || !bill) {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
      return
    }

    setActiveBill(bill)
    setMethod(initialMethod)
    setFailureReason(null)
    setCashTendered(bill.grand_total)
    setChangeToReturn(0)

    if (bill.status === 'PAID') {
      setPaymentState('PAID')
      return
    }

    initUPIPayment(bill.id)

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
    }
  }, [open, bill?.id, initialMethod])

  // Recalculate cash change
  useEffect(() => {
    if (!bill) return
    const tendered = Number(cashTendered) || 0
    const total = Number(bill.grand_total)
    if (tendered >= total) {
      setChangeToReturn(Math.round((tendered - total) * 100) / 100)
    } else {
      setChangeToReturn(0)
    }
  }, [cashTendered, bill?.grand_total])

  const initUPIPayment = async (billId: string) => {
    setLoading(true)
    const res = await billingService.createUPIPayment(billId)
    setLoading(false)

    if (res.error || !res.payment) {
      toast.error(res.error || 'Failed to initialize UPI transaction')
      return
    }

    setPayment(res.payment)
    setQrData(res.qrData)
    setPaymentState('PENDING')

    startPolling(res.payment.id)
  }

  const startPolling = (paymentId: string) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)

    pollIntervalRef.current = setInterval(async () => {
      const current = await billingService.getBillById(bill?.id || '')
      if (current?.status === 'PAID') {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
        setPaymentState('PAID')
        setActiveBill(current)
        if (onPaymentSuccess) onPaymentSuccess(current)
        toast.success('Payment Verified & Confirmed!')
      }
    }, 4000)
  }

  const handleVerifyUPI = async () => {
    if (!payment) return
    setVerifying(true)
    const res = await billingService.verifyPayment(payment.id)
    setVerifying(false)

    if (res.success && res.bill) {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
      setPaymentState('PAID')
      setActiveBill(res.bill)
      toast.success('UPI Payment Verified Successfully!')
      if (onPaymentSuccess) onPaymentSuccess(res.bill)
    } else {
      toast.error(res.error || 'Verification failed. Customer has not completed the payment.')
    }
  }

  const handleCollectCash = async () => {
    if (!bill) return
    const tendered = Number(cashTendered)
    const total = Number(bill.grand_total)

    if (isNaN(tendered) || tendered < total) {
      toast.error(`Please enter cash received (minimum ₹${total})`)
      return
    }

    setCollectingCash(true)
    const res = await billingService.collectCashPayment(bill.id, tendered)
    setCollectingCash(false)

    if (res.success && res.bill) {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
      setPaymentState('PAID')
      setActiveBill(res.bill)
      setChangeToReturn(res.changeDue)
      toast.success(`Cash collected! Change to return: ₹${res.changeDue}`)
      if (onPaymentSuccess) onPaymentSuccess(res.bill)
    } else {
      toast.error(res.error || 'Failed to process cash payment')
    }
  }

  const handleSimulateFailure = () => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
    setPaymentState('FAILED')
    setFailureReason('Bank server declined the UPI mandate or payment request timed out.')
    toast.error('Payment failed: Bank declined transaction.')
  }

  const handleRetryPayment = () => {
    if (!bill) return
    initUPIPayment(bill.id)
  }

  const handleCancelPayment = () => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
    setPaymentState('CANCELLED')
    toast('Payment intent cancelled.', { icon: '⚠️' })
    onClose()
  }

  const handlePrinted = async () => {
    if (activeBill) {
      await billingService.recordPrint(activeBill.id)
      const fresh = await billingService.getBillById(activeBill.id)
      if (fresh) setActiveBill(fresh)
    }
  }

  if (!bill) return null

  const rest = restaurant || bill.restaurant
  const upiId = rest?.upi_id || '8309653769@upi'
  const merchantName = rest?.upi_merchant_name || rest?.name || 'Deccan CRM'
  const totalAmount = bill.grand_total

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={
        paymentState === 'PAID'
          ? 'Payment Completed'
          : `Collect Payment — ${bill.bill_number}`
      }
      description={
        paymentState === 'PAID'
          ? `Receipt ready for Table ${bill.table_number || '-'} (Order #${bill.order_number})`
          : `Order #${bill.order_number} • Table ${bill.table_number || '-'}`
      }
      size={paymentState === 'PAID' ? 'md' : 'sm'}
    >
      <div className="space-y-4 -mt-2">
        {/* SUCCESS STATE */}
        {paymentState === 'PAID' && (
          <div className="space-y-3">
            <div className="bg-emerald-50 border border-emerald-200/90 rounded-xl p-3 text-center space-y-1">
              <div className="flex items-center justify-center gap-1.5">
                <div className="w-5 h-5 bg-emerald-600 rounded-full flex items-center justify-center text-white shadow-2xs">
                  <CheckCircle2 size={13} />
                </div>
                <h3 className="font-bold text-sm text-emerald-950">
                  Payment Received ✓
                </h3>
              </div>
              <p className="text-[11px] text-emerald-800 font-medium">
                Method: <span className="font-bold uppercase">{activeBill?.payment_method || method}</span> • Amount: <span className="font-bold">{formatCurrency(activeBill?.grand_total || totalAmount)}</span>
              </p>

              {activeBill?.payment_method === 'CASH' && changeToReturn > 0 && (
                <div className="py-0.5 px-2 bg-emerald-100 rounded-md inline-block text-[11px] font-bold text-emerald-900 border border-emerald-300">
                  Change to Return: ₹{changeToReturn.toFixed(2)}
                </div>
              )}

              <div className="flex items-center justify-center gap-2 text-[10px] font-semibold text-emerald-700">
                <span>Bill #{activeBill?.bill_number || bill.bill_number}</span>
                <span>•</span>
                <span>Table Closed & Freed</span>
              </div>
            </div>

            {/* Receipt Preview */}
            <div className="pt-2">
              <ThermalReceipt
                bill={activeBill || bill}
                restaurant={rest}
                onAfterPrint={handlePrinted}
              />
            </div>

            <div className="flex gap-3 pt-3 border-t border-[var(--color-border)] print:hidden">
              <button onClick={onClose} className="btn btn-secondary flex-1">
                Close Window
              </button>
              <button
                onClick={() => window.print()}
                className="btn btn-primary flex-1 flex items-center justify-center gap-2"
              >
                <Printer size={16} />
                Print Receipt
              </button>
            </div>
          </div>
        )}

        {/* FAILED STATE */}
        {paymentState === 'FAILED' && (
          <div className="space-y-4 py-2">
            <div className="bg-red-50 border border-red-200 rounded-2xl p-5 text-center">
              <div className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center text-white mx-auto shadow-sm">
                <XCircle size={28} />
              </div>
              <h3 className="font-bold text-lg text-red-950 mt-3">
                Payment Failed
              </h3>
              <p className="text-xs text-red-700 mt-1 font-medium">
                {failureReason || 'Transaction could not be verified or was declined.'}
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={handleCancelPayment} className="btn btn-secondary flex-1">
                Cancel
              </button>
              <button
                onClick={handleRetryPayment}
                className="btn btn-primary flex-1 flex items-center justify-center gap-1.5"
              >
                <RefreshCw size={15} />
                Retry Payment
              </button>
            </div>
          </div>
        )}

        {/* PENDING: PAYMENT METHOD SELECTOR & INTERFACE */}
        {paymentState === 'PENDING' && (
          <div className="space-y-4">
            {/* Amount Banner */}
            <div className="bg-[var(--color-surface-subtle)] border border-[var(--color-border)] rounded-2xl p-4 text-center">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                Total Bill Amount
              </span>
              <div className="text-3xl font-extrabold text-[var(--color-text-primary)] mt-0.5 font-mono">
                {formatCurrency(totalAmount)}
              </div>
              <div className="text-xs text-[var(--color-text-tertiary)] mt-1 font-medium">
                Invoice #{bill.bill_number}
              </div>
            </div>

            {/* Payment Method Switch Tabs */}
            <div className="grid grid-cols-2 p-1 bg-stone-100 rounded-xl border border-stone-200">
              <button
                type="button"
                onClick={() => setMethod('UPI')}
                className={`py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                  method === 'UPI'
                    ? 'bg-white text-[var(--color-accent)] shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <Smartphone size={15} />
                <span>UPI QR Payment</span>
              </button>

              <button
                type="button"
                onClick={() => setMethod('CASH')}
                className={`py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                  method === 'CASH'
                    ? 'bg-white text-emerald-700 shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <Banknote size={15} />
                <span>Cash Payment</span>
              </button>
            </div>

            {/* TAB 1: UPI PAYMENT */}
            {method === 'UPI' && (
              <div className="space-y-4">
                <div className="flex flex-col items-center justify-center py-1">
                  <div className="p-3.5 bg-white border-2 border-[var(--color-accent)] rounded-3xl shadow-sm">
                    {qrData ? (
                      <QRCodeSVG
                        value={qrData}
                        size={195}
                        level="H"
                        includeMargin={true}
                      />
                    ) : (
                      <div className="w-[195px] h-[195px] flex items-center justify-center">
                        <RefreshCw className="animate-spin text-[var(--color-accent)]" size={28} />
                      </div>
                    )}
                  </div>

                  <div className="mt-2.5 flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)] font-medium">
                    <Smartphone size={13} className="text-[var(--color-accent)]" />
                    <span>Scan with Google Pay, PhonePe, Paytm, BHIM</span>
                  </div>

                  <div className="mt-0.5 text-xs text-[var(--color-text-tertiary)] font-mono">
                    UPI ID: <span className="font-semibold text-[var(--color-text-primary)]">{upiId}</span>
                  </div>
                </div>

                <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <RefreshCw size={13} className="animate-spin text-amber-700" />
                    <span className="font-medium text-amber-900">Waiting for customer payment...</span>
                  </div>
                  <span className="font-mono text-[11px] text-amber-800">
                    Ref: {payment?.transaction_reference?.slice(-6) || '...'}
                  </span>
                </div>

                <div className="space-y-2 pt-1">
                  <button
                    onClick={handleVerifyUPI}
                    disabled={verifying}
                    className="w-full btn btn-primary h-11 text-sm font-semibold flex items-center justify-center gap-2 shadow-sm"
                  >
                    {verifying ? (
                      <>
                        <RefreshCw size={16} className="animate-spin" />
                        <span>Verifying with Gateway...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck size={17} />
                        <span>Verify UPI Payment</span>
                      </>
                    )}
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={handleSimulateFailure}
                      className="btn btn-secondary h-8 text-xs text-red-600 hover:bg-red-50 hover:border-red-200"
                    >
                      Simulate Failure
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelPayment}
                      className="btn btn-secondary h-8 text-xs text-[var(--color-text-secondary)]"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: CASH PAYMENT */}
            {method === 'CASH' && (
              <div className="space-y-4">
                <div className="p-4 bg-emerald-50/60 border border-emerald-200/80 rounded-2xl space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold uppercase tracking-wider text-emerald-950">
                      Cash Received from Customer:
                    </label>
                    <span className="text-xs font-semibold text-emerald-800 font-mono">
                      Due: {formatCurrency(totalAmount)}
                    </span>
                  </div>

                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-stone-500 text-lg">
                      ₹
                    </span>
                    <input
                      type="number"
                      min={totalAmount}
                      value={cashTendered}
                      onChange={e => setCashTendered(e.target.value)}
                      placeholder="0.00"
                      className="w-full h-12 pl-8 pr-4 text-xl font-bold font-mono bg-white border-2 border-emerald-400 rounded-xl outline-none focus:ring-2 focus:ring-emerald-200"
                    />
                  </div>

                  {/* Quick Tender Currency Presets */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setCashTendered(totalAmount)}
                      className="px-2.5 py-1 text-xs font-bold rounded-lg bg-white border border-stone-300 text-stone-800 hover:bg-stone-50"
                    >
                      Exact (₹{totalAmount})
                    </button>
                    {[Math.ceil(totalAmount / 100) * 100, Math.ceil(totalAmount / 500) * 500, 1000, 2000]
                      .filter((val, i, arr) => val >= totalAmount && arr.indexOf(val) === i)
                      .slice(0, 4)
                      .map(val => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setCashTendered(val)}
                          className="px-2.5 py-1 text-xs font-bold rounded-lg bg-white border border-stone-300 text-stone-800 hover:bg-stone-50"
                        >
                          ₹{val}
                        </button>
                      ))}
                  </div>
                </div>

                {/* Change Calculation Display */}
                <div className="p-3.5 bg-white border border-[var(--color-border)] rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Coins size={16} className="text-emerald-600" />
                    <span className="text-xs font-bold text-stone-700">Change to Return:</span>
                  </div>
                  <div className={`text-xl font-black font-mono ${changeToReturn > 0 ? 'text-emerald-600' : 'text-stone-400'}`}>
                    ₹{changeToReturn.toFixed(2)}
                  </div>
                </div>

                <div className="space-y-2 pt-1">
                  <button
                    onClick={handleCollectCash}
                    disabled={collectingCash || Number(cashTendered) < totalAmount}
                    className="w-full btn btn-primary h-11 text-sm font-semibold flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm disabled:opacity-50"
                  >
                    {collectingCash ? (
                      <>
                        <RefreshCw size={16} className="animate-spin" />
                        <span>Recording Cash Receipt...</span>
                      </>
                    ) : (
                      <>
                        <Banknote size={17} />
                        <span>Collect Cash & Mark Bill Paid</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleCancelPayment}
                    className="w-full btn btn-secondary h-8 text-xs text-[var(--color-text-secondary)]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Dialog>
  )
}
