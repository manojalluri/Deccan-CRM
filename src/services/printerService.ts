import type { Bill, Restaurant } from '@/types/database'

export interface PrinterDeviceStatus {
  connected: boolean
  type: 'browser' | 'web-serial' | 'network-bridge'
  name: string
}

/**
 * Format string with padded columns for ESC/POS and monospace thermal printing
 */
export function formatReceiptLine(left: string, right: string, width = 42): string {
  const leftStr = String(left || '')
  const rightStr = String(right || '')
  const spaces = Math.max(1, width - leftStr.length - rightStr.length)
  return leftStr + ' '.repeat(spaces) + rightStr
}

export function formatThreeColLine(col1: string, col2: string, col3: string, width = 42): string {
  // e.g. for width 42: col1 = 24 chars, col2 = 6 chars, col3 = 12 chars
  const c2W = 6
  const c3W = 11
  const c1W = Math.max(10, width - c2W - c3W)

  const c1 = col1.length > c1W ? col1.substring(0, c1W - 1) + '…' : col1.padEnd(c1W)
  const c2 = col2.padStart(c2W)
  const c3 = col3.padStart(c3W)
  return `${c1}${c2}${c3}`
}

/**
 * Generates raw ESC/POS binary buffer for thermal printers
 */
export function generateEscPosBuffer(bill: Bill, restaurant?: Restaurant | null, isReprint = false): Uint8Array {
  const width = restaurant?.receipt_width === '58mm' ? 32 : 42
  const enc = new TextEncoder()
  const parts: Uint8Array[] = []

  const appendText = (text: string) => {
    parts.push(enc.encode(text + '\n'))
  }

  // ESC @ (Initialize printer)
  parts.push(new Uint8Array([0x1b, 0x40]))

  // Center align
  parts.push(new Uint8Array([0x1b, 0x61, 0x01]))

  // Double height & width for header
  parts.push(new Uint8Array([0x1d, 0x21, 0x11]))
  appendText(restaurant?.name || 'DECCAN CRM')

  // Normal font
  parts.push(new Uint8Array([0x1d, 0x21, 0x00]))
  if (restaurant?.address) appendText(restaurant.address)
  if (restaurant?.phone) appendText(`Ph: ${restaurant.phone}`)
  if (restaurant?.gstin) appendText(`GSTIN: ${restaurant.gstin}`)

  if (isReprint || (bill.print_count && bill.print_count > 0)) {
    // Bold reprint banner
    parts.push(new Uint8Array([0x1b, 0x45, 0x01]))
    appendText('*** DUPLICATE / REPRINT ***')
    parts.push(new Uint8Array([0x1b, 0x45, 0x00]))
  }

  // Separator
  appendText('-'.repeat(width))

  // Left align
  parts.push(new Uint8Array([0x1b, 0x61, 0x00]))
  const dateStr = new Date(bill.created_at).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
  const timeStr = new Date(bill.created_at).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  })

  appendText(formatReceiptLine(`Bill No: ${bill.bill_number}`, `Date: ${dateStr}`, width))
  appendText(formatReceiptLine(bill.order_numbers ? `Orders: ${bill.order_numbers}` : `Order: #${bill.order_number || '-'}`, `Time: ${timeStr}`, width))
  appendText(formatReceiptLine(`Table: ${bill.table_number || '-'}`, `Cashier: ${bill.cashier_name || 'Staff'}`, width))
  if (bill.is_combined) {
    appendText('** COMBINED TABLE BILL **')
  }

  // Items Header
  appendText('-'.repeat(width))
  appendText(formatThreeColLine('ITEM', 'QTY', 'AMOUNT', width))
  appendText('-'.repeat(width))

  // Items List
  if (bill.bill_items && bill.bill_items.length > 0) {
    for (const item of bill.bill_items) {
      appendText(formatThreeColLine(
        item.item_name,
        String(item.quantity),
        `₹${Number(item.item_total).toFixed(2)}`,
        width
      ))
    }
  }

  // Totals Section
  appendText('-'.repeat(width))
  appendText(formatReceiptLine('Subtotal', `₹${Number(bill.subtotal).toFixed(2)}`, width))

  if (bill.discount_amount > 0) {
    appendText(formatReceiptLine('Discount', `-₹${Number(bill.discount_amount).toFixed(2)}`, width))
  }

  if (bill.cgst_amount > 0) {
    appendText(formatReceiptLine(`CGST (${bill.cgst_rate}%)`, `₹${Number(bill.cgst_amount).toFixed(2)}`, width))
  }
  if (bill.sgst_amount > 0) {
    appendText(formatReceiptLine(`SGST (${bill.sgst_rate}%)`, `₹${Number(bill.sgst_amount).toFixed(2)}`, width))
  }

  if (bill.round_off !== 0) {
    appendText(formatReceiptLine('Round Off', `${bill.round_off > 0 ? '+' : ''}₹${Number(bill.round_off).toFixed(2)}`, width))
  }

  // Double-height Total
  appendText('='.repeat(width))
  parts.push(new Uint8Array([0x1b, 0x45, 0x01])) // Bold
  appendText(formatReceiptLine('GRAND TOTAL', `₹${Number(bill.grand_total).toFixed(2)}`, width))
  parts.push(new Uint8Array([0x1b, 0x45, 0x00])) // Bold off
  appendText('='.repeat(width))

  // Payment Details
  appendText(formatReceiptLine('Payment Mode:', bill.payment_method || 'UPI', width))
  appendText(formatReceiptLine('Status:', bill.status, width))

  const paymentRecord = bill.payments?.[0]
  if (paymentRecord?.transaction_reference) {
    appendText(formatReceiptLine('Ref / Txn ID:', paymentRecord.transaction_reference, width))
  }

  // Center align footer
  parts.push(new Uint8Array([0x1b, 0x61, 0x01]))
  appendText('-'.repeat(width))
  appendText(restaurant?.receipt_footer || 'Thank you for dining with us! Please visit again.')
  appendText('-'.repeat(width))

  // Feed 4 lines and full cut
  parts.push(new Uint8Array([0x1b, 0x64, 0x04]))
  // GS V 0 (Cut paper)
  parts.push(new Uint8Array([0x1d, 0x56, 0x00]))

  // Merge Uint8Array buffers
  const totalLength = parts.reduce((acc, p) => acc + p.length, 0)
  const merged = new Uint8Array(totalLength)
  let offset = 0
  for (const part of parts) {
    merged.set(part, offset)
    offset += part.length
  }
  return merged
}

export const thermalPrinterService = {
  /**
   * Browser Print: Prints specifically the thermal receipt container element
   */
  printBrowser(): boolean {
    window.print()
    return true
  },

  /**
   * Print via Web Serial API (USB / COM Thermal Printer)
   */
  async printViaWebSerial(bill: Bill, restaurant?: Restaurant | null, isReprint = false): Promise<{ success: boolean; error?: string }> {
    if (!('serial' in navigator)) {
      return { success: false, error: 'Web Serial API is not supported on this browser. Please use Chrome/Edge or standard Print.' }
    }

    try {
      // @ts-expect-error Web Serial API typing
      const port = await navigator.serial.requestPort()
      await port.open({ baudRate: 9600 })

      const writer = port.writable.getWriter()
      const escPosData = generateEscPosBuffer(bill, restaurant, isReprint)
      await writer.write(escPosData)
      writer.releaseLock()
      await port.close()

      return { success: true }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to communicate with serial printer'
      return { success: false, error: msg }
    }
  },

  /**
   * Print via Local Print Bridge (ESC/POS bridge service running at localhost:9100 or network IP)
   */
  async printViaBridge(
    bridgeUrl: string,
    bill: Bill,
    restaurant?: Restaurant | null,
    isReprint = false
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const buffer = generateEscPosBuffer(bill, restaurant, isReprint)
      // Send raw base64 encoded buffer to local print bridge
      const base64 = btoa(String.fromCharCode(...buffer))

      const res = await fetch(bridgeUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          printerType: 'escpos',
          data: base64,
          billNumber: bill.bill_number,
        }),
      })

      if (!res.ok) {
        throw new Error(`Print bridge responded with status ${res.status}`)
      }

      return { success: true }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Local print service is not reachable'
      return { success: false, error: msg }
    }
  },
}
