import { useRef, useState } from 'react'
import { Printer, Copy, Check, AlertCircle, Sparkles } from 'lucide-react'
import type { Bill, Restaurant } from '@/types/database'
import { thermalPrinterService } from '@/services'
import { formatCurrency } from '@/lib/utils'
import toast from 'react-hot-toast'

interface ThermalReceiptProps {
  bill: Bill
  restaurant?: Restaurant | null
  isReprint?: boolean
  onAfterPrint?: () => void
}

export function ThermalReceipt({ bill, restaurant, isReprint = false, onAfterPrint }: ThermalReceiptProps) {
  const [copied, setCopied] = useState(false)
  const [printingWebSerial, setPrintingWebSerial] = useState(false)
  const receiptRef = useRef<HTMLDivElement>(null)

  const isWidth58 = restaurant?.receipt_width === '58mm'
  const rest = restaurant || bill.restaurant
  const hasAlreadyPrinted = (bill.print_count && bill.print_count > 0) || isReprint

  const handleBrowserPrint = () => {
    window.print()
    if (onAfterPrint) onAfterPrint()
  }

  const handleDirectUsbPrint = async () => {
    setPrintingWebSerial(true)
    const res = await thermalPrinterService.printViaWebSerial(bill, rest, hasAlreadyPrinted)
    setPrintingWebSerial(false)
    if (res.success) {
      toast.success('Sent to Thermal Printer!')
      if (onAfterPrint) onAfterPrint()
    } else {
      toast.error(res.error || 'Failed to print to USB device')
    }
  }

  const handleCopyTextReceipt = () => {
    if (!receiptRef.current) return
    const text = receiptRef.current.innerText
    navigator.clipboard.writeText(text)
    setCopied(true)
    toast.success('Receipt copied to clipboard')
    setTimeout(() => setCopied(false), 2000)
  }

  const dateStr = new Date(bill.created_at).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
  const timeStr = new Date(bill.created_at).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div className="flex flex-col items-center">
      {/* Top Action Controls (hidden when printing) */}
      <div className="print:hidden w-full flex flex-wrap items-center justify-between gap-1.5 p-2 bg-[var(--color-surface-subtle)] border border-[var(--color-border)] rounded-xl mb-2.5">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-stone-200 text-stone-800 uppercase tracking-wider">
            {isWidth58 ? '58mm' : '80mm'}
          </span>
          {hasAlreadyPrinted && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-300">
              Reprint #{bill.print_count || 1}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={handleCopyTextReceipt}
            className="btn btn-secondary btn-sm h-7 px-2 text-xs flex items-center gap-1"
            title="Copy plain receipt"
          >
            {copied ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>

          {'serial' in navigator && (
            <button
              onClick={handleDirectUsbPrint}
              disabled={printingWebSerial}
              className="btn btn-secondary btn-sm h-7 px-2 text-xs flex items-center gap-1 hover:border-[var(--color-accent)]"
              title="Direct USB ESC/POS Printer"
            >
              <Sparkles size={12} className="text-[var(--color-accent)]" />
              <span>{printingWebSerial ? '...' : 'USB Print'}</span>
            </button>
          )}

          <button
            onClick={handleBrowserPrint}
            className="btn btn-primary btn-sm h-7 px-2.5 text-xs flex items-center gap-1 shadow-2xs"
          >
            <Printer size={12} />
            <span>Print Receipt</span>
          </button>
        </div>
      </div>

      {/* Actual Printable Receipt Container (Compact on Screen, Standard on Print) */}
      <div
        id="thermal-receipt-print-area"
        ref={receiptRef}
        className={`bg-white text-black font-mono text-[11px] leading-tight p-3.5 border border-dashed border-stone-300 shadow-sm rounded-lg max-h-[360px] overflow-y-auto print:border-none print:shadow-none print:m-0 print:p-0 print:max-h-none print:overflow-visible ${
          isWidth58 ? 'w-[230px] width-58mm' : 'w-[280px]'
        }`}
        style={{ fontFamily: "'Courier New', Courier, monospace" }}
      >
        {/* Header */}
        <div className="text-center pb-2 border-b border-dashed border-stone-400">
          <div className="font-extrabold text-[13px] tracking-tight uppercase">
            {rest?.name || 'DECCAN CRM'}
          </div>
          {rest?.address && <div className="text-[10px] mt-0.5 text-stone-700">{rest.address}</div>}
          {rest?.phone && <div className="text-[10px] text-stone-700">Tel: {rest.phone}</div>}
          {rest?.gstin && <div className="text-[10px] font-semibold mt-0.5">GSTIN: {rest.gstin}</div>}

          {hasAlreadyPrinted && (
            <div className="mt-1.5 py-0.5 px-2 bg-stone-200 text-stone-900 font-bold text-[10px] uppercase tracking-widest inline-block border border-stone-400">
              *** DUPLICATE RECEIPT ***
            </div>
          )}
        </div>

        {/* Bill Metadata */}
        <div className="py-2 border-b border-dashed border-stone-400 text-[10.5px] space-y-0.5">
          <div className="flex justify-between">
            <span className="font-bold">Bill No: {bill.bill_number}</span>
            <span>Date: {dateStr}</span>
          </div>
          <div className="flex justify-between">
            <span>{bill.order_numbers ? `Orders: ${bill.order_numbers}` : `Order: #${bill.order_number || '-'}`}</span>
            <span>Time: {timeStr}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-semibold">Table: {bill.table_number || '-'}</span>
            <span>Staff: {bill.cashier_name || 'Staff'}</span>
          </div>
          {bill.is_combined && (
            <div className="text-[10px] font-bold text-center py-0.5 bg-stone-100 uppercase tracking-wider text-stone-800">
              * COMBINED TABLE BILL *
            </div>
          )}
          {bill.customer_name && (
            <div className="flex justify-between text-stone-600 text-[10px]">
              <span>Customer: {bill.customer_name}</span>
              {bill.customer_phone && <span>{bill.customer_phone}</span>}
            </div>
          )}
        </div>

        {/* Itemised Table Header */}
        <div className="py-1 border-b border-dashed border-stone-400 font-bold text-[10.5px] flex justify-between">
          <span className="flex-1">ITEM</span>
          <span className="w-8 text-center">QTY</span>
          <span className="w-16 text-right">AMOUNT</span>
        </div>

        {/* Itemised Table Rows */}
        <div className="py-1.5 space-y-1 border-b border-dashed border-stone-400 text-[10.5px]">
          {bill.bill_items?.map(item => (
            <div key={item.id} className="flex justify-between items-start">
              <span className="flex-1 pr-1 truncate font-medium">{item.item_name}</span>
              <span className="w-8 text-center font-semibold">{item.quantity}</span>
              <span className="w-16 text-right font-medium">₹{Number(item.item_total).toFixed(2)}</span>
            </div>
          ))}
        </div>

        {/* Calculations / Breakdown */}
        <div className="py-1.5 space-y-0.5 text-[10.5px] border-b border-dashed border-stone-400">
          <div className="flex justify-between">
            <span>Subtotal:</span>
            <span>₹{Number(bill.subtotal).toFixed(2)}</span>
          </div>

          {bill.discount_amount > 0 && (
            <div className="flex justify-between font-medium text-emerald-700">
              <span>
                Discount {bill.discount_type === 'percentage' ? `(${bill.discount_value}%)` : ''}:
              </span>
              <span>-₹{Number(bill.discount_amount).toFixed(2)}</span>
            </div>
          )}

          {bill.cgst_amount > 0 && (
            <div className="flex justify-between text-stone-700">
              <span>CGST ({bill.cgst_rate}%):</span>
              <span>₹{Number(bill.cgst_amount).toFixed(2)}</span>
            </div>
          )}

          {bill.sgst_amount > 0 && (
            <div className="flex justify-between text-stone-700">
              <span>SGST ({bill.sgst_rate}%):</span>
              <span>₹{Number(bill.sgst_amount).toFixed(2)}</span>
            </div>
          )}

          {bill.round_off !== 0 && (
            <div className="flex justify-between text-stone-600 text-[10px]">
              <span>Round Off:</span>
              <span>
                {bill.round_off > 0 ? '+' : ''}₹{Number(bill.round_off).toFixed(2)}
              </span>
            </div>
          )}
        </div>

        {/* Grand Total */}
        <div className="py-1.5 border-b-2 border-dashed border-black">
          <div className="flex justify-between items-baseline font-black text-[13.5px]">
            <span>GRAND TOTAL</span>
            <span>₹{Number(bill.grand_total).toFixed(2)}</span>
          </div>
        </div>

        {/* Payment Summary */}
        <div className="py-1.5 text-[10px] space-y-0.5 border-b border-dashed border-stone-400">
          <div className="flex justify-between">
            <span className="font-semibold">Payment Method:</span>
            <span className="font-bold uppercase">{bill.payment_method || 'UPI'}</span>
          </div>
          <div className="flex justify-between">
            <span>Payment Status:</span>
            <span
              className={`font-bold uppercase ${
                bill.status === 'PAID' ? 'text-green-700' : 'text-amber-700'
              }`}
            >
              {bill.status}
            </span>
          </div>
          {bill.payments?.[0]?.transaction_reference && (
            <div className="flex justify-between text-stone-600">
              <span>Txn Reference:</span>
              <span className="font-mono">{bill.payments[0].transaction_reference}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center pt-2 text-[10px] text-stone-700 space-y-0.5">
          <div className="font-bold uppercase tracking-wider">
            {rest?.receipt_footer || 'THANK YOU! VISIT AGAIN'}
          </div>
          <div className="text-[9px] text-stone-400">POS Powered by Deccan CRM</div>
        </div>
      </div>
    </div>
  )
}
