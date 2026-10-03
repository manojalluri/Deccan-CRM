import type { DiscountType } from '@/types/database'

export interface BillItemCalcInput {
  price: number
  quantity: number
  item_name?: string
}

export interface CalculationInput {
  items: BillItemCalcInput[]
  discountType?: DiscountType
  discountValue?: number
  taxEnabled?: boolean
  cgstRate?: number
  sgstRate?: number
  serviceChargeRate?: number
}

export interface BillCalculationResult {
  subtotal: number
  discountType: DiscountType
  discountValue: number
  discountAmount: number
  taxableAmount: number
  cgstRate: number
  sgstRate: number
  cgstAmount: number
  sgstAmount: number
  taxAmount: number
  serviceChargeRate: number
  serviceChargeAmount: number
  roundOff: number
  grandTotal: number
}

/**
 * Standard rounding to 2 decimal places to avoid floating point inaccuracies
 */
export function round2(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100
}

/**
 * Centralized calculation engine for bill computation.
 * Both backend service and client call this exact calculation logic.
 */
export function calculateBill(input: CalculationInput): BillCalculationResult {
  const {
    items = [],
    discountType = 'none',
    discountValue = 0,
    taxEnabled = true,
    cgstRate = 2.5,
    sgstRate = 2.5,
    serviceChargeRate = 0,
  } = input

  // 1. Calculate Subtotal
  let rawSubtotal = 0
  for (const item of items) {
    const p = Math.max(0, Number(item.price) || 0)
    const q = Math.max(0, Number(item.quantity) || 0)
    rawSubtotal += p * q
  }
  const subtotal = round2(rawSubtotal)

  // 2. Calculate Discount
  let rawDiscountAmount = 0
  const cleanDiscountVal = Math.max(0, Number(discountValue) || 0)

  if (discountType === 'percentage') {
    const cappedPercent = Math.min(cleanDiscountVal, 100)
    rawDiscountAmount = (subtotal * cappedPercent) / 100
  } else if (discountType === 'fixed') {
    rawDiscountAmount = Math.min(cleanDiscountVal, subtotal)
  }
  const discountAmount = round2(rawDiscountAmount)

  // 3. Taxable Amount
  const taxableAmount = Math.max(0, round2(subtotal - discountAmount))

  // 4. Taxes & Additional Costs
  let cgstAmount = 0
  let sgstAmount = 0
  let taxAmount = 0

  const safeCgstRate = taxEnabled ? Math.max(0, Number(cgstRate) || 0) : 0
  const safeSgstRate = taxEnabled ? Math.max(0, Number(sgstRate) || 0) : 0
  const safeServiceChargeRate = Math.max(0, Number(serviceChargeRate) || 0)

  if (taxEnabled && taxableAmount > 0) {
    cgstAmount = round2((taxableAmount * safeCgstRate) / 100)
    sgstAmount = round2((taxableAmount * safeSgstRate) / 100)
    taxAmount = round2(cgstAmount + sgstAmount)
  }

  // Optional Service charge / additional fee
  let serviceChargeAmount = 0
  if (safeServiceChargeRate > 0 && taxableAmount > 0) {
    serviceChargeAmount = round2((taxableAmount * safeServiceChargeRate) / 100)
  }

  // 5. Total before round off
  const totalBeforeRoundOff = round2(taxableAmount + taxAmount + serviceChargeAmount)

  // 6. Grand total rounded to nearest integer (standard POS offline restaurant practice)
  const grandTotal = Math.round(totalBeforeRoundOff)
  const roundOff = round2(grandTotal - totalBeforeRoundOff)

  return {
    subtotal,
    discountType,
    discountValue: cleanDiscountVal,
    discountAmount,
    taxableAmount,
    cgstRate: safeCgstRate,
    sgstRate: safeSgstRate,
    cgstAmount,
    sgstAmount,
    taxAmount,
    serviceChargeRate: safeServiceChargeRate,
    serviceChargeAmount,
    roundOff,
    grandTotal,
  }
}
