import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Save, Store, Zap, Palette, CreditCard, Calculator, Sparkles, Percent } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { restaurantService } from '@/services'
import { Switch } from '@/components/ui'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { PageHeader } from '@/components/admin/PageHeader'
import type { Restaurant } from '@/types/database'
import toast from 'react-hot-toast'

interface TaxSettingsCardProps {
  taxEnabled: boolean
  setTaxEnabled: (v: boolean) => void
  cgstRate: number
  setCgstRate: (v: number) => void
  sgstRate: number
  setSgstRate: (v: number) => void
  serviceChargeRate: number
  setServiceChargeRate: (v: number) => void
  gstin: string
  setGstin: (v: string) => void
  currency: string
  setCurrency: (v: string) => void
}

function TaxAndAdditionalChargesCard({
  taxEnabled,
  setTaxEnabled,
  cgstRate,
  setCgstRate,
  sgstRate,
  setSgstRate,
  serviceChargeRate,
  setServiceChargeRate,
  gstin,
  setGstin,
  currency,
  setCurrency,
}: TaxSettingsCardProps) {
  const sampleAmount = 1000
  const totalTaxPercent = taxEnabled ? cgstRate + sgstRate : 0
  const cgstAmount = taxEnabled ? (sampleAmount * cgstRate) / 100 : 0
  const sgstAmount = taxEnabled ? (sampleAmount * sgstRate) / 100 : 0
  const serviceChargeAmount = (sampleAmount * serviceChargeRate) / 100
  const grandTotal = Math.round(sampleAmount + cgstAmount + sgstAmount + serviceChargeAmount)

  const presets = [
    { label: '5% GST (Standard)', cgst: 2.5, sgst: 2.5, desc: 'Regular restaurants & cafes' },
    { label: '12% GST', cgst: 6.0, sgst: 6.0, desc: 'Composite food & drinks' },
    { label: '18% GST (Luxury / AC)', cgst: 9.0, sgst: 9.0, desc: 'Air-conditioned dining / bars' },
    { label: '0% Tax Exempt', cgst: 0, sgst: 0, desc: 'Exempt / Street vendors' },
  ]

  return (
    <div className="card p-6 space-y-5 bg-white border border-[var(--color-border-subtle)] shadow-sm rounded-2xl">
      <div className="flex items-start justify-between border-b border-[var(--color-border-subtle)] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-[var(--color-text-primary)]">
              Taxes, GST & Additional Charges
            </h3>
            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              Live POS & Menu Config
            </span>
          </div>
          <p className="text-xs text-[var(--color-text-secondary)] mt-1">
            Configure dynamic taxes (CGST, SGST) and extra costs like service charge. Changes update automatically in real-time across all bills, customer ordering menus, and receipts.
          </p>
        </div>
      </div>

      <Switch
        checked={taxEnabled}
        onChange={setTaxEnabled}
        label="Enable GST on Bills & Customer Orders"
        description="Automatically calculate and display applicable taxes on generated bills and checkout."
        id="tax-enabled-toggle"
      />

      {taxEnabled && (
        <div className="space-y-4 pt-1">
          {/* Quick GST Presets */}
          <div>
            <label className="text-xs font-semibold text-stone-700 block mb-1.5">
              Quick GST Presets (Click to apply):
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {presets.map(p => {
                const isSelected = cgstRate === p.cgst && sgstRate === p.sgst
                return (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => {
                      setCgstRate(p.cgst)
                      setSgstRate(p.sgst)
                    }}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'border-[var(--color-accent)] bg-orange-50/60 ring-2 ring-[var(--color-accent)]/20'
                        : 'border-stone-200 bg-stone-50/50 hover:bg-stone-100/70'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-stone-900">{p.label}</span>
                      {isSelected && <Sparkles size={12} className="text-[var(--color-accent)]" />}
                    </div>
                    <span className="text-[10px] text-stone-500 block mt-0.5">{p.desc}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Rates Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
            <div>
              <label className="text-xs font-semibold text-stone-700 block mb-1">
                CGST Rate (%)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={cgstRate}
                onChange={e => setCgstRate(Math.max(0, Number(e.target.value) || 0))}
                className="input w-full text-xs font-mono"
              />
              <span className="text-[10px] text-stone-400 mt-1 block">Central GST percentage</span>
            </div>

            <div>
              <label className="text-xs font-semibold text-stone-700 block mb-1">
                SGST Rate (%)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={sgstRate}
                onChange={e => setSgstRate(Math.max(0, Number(e.target.value) || 0))}
                className="input w-full text-xs font-mono"
              />
              <span className="text-[10px] text-stone-400 mt-1 block">State GST percentage</span>
            </div>

            <div>
              <label className="text-xs font-semibold text-stone-700 block mb-1">
                Total GST Rate
              </label>
              <div className="h-10 px-3 flex items-center bg-stone-100 rounded-xl font-mono text-xs font-bold text-stone-800 border border-stone-200">
                {totalTaxPercent.toFixed(2)}% (CGST + SGST)
              </div>
              <span className="text-[10px] text-stone-400 mt-1 block">Combined tax on food items</span>
            </div>
          </div>
        </div>
      )}

      {/* Additional Costs: Service Charge, GSTIN & Currency */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-stone-100">
        <div>
          <label className="text-xs font-semibold text-stone-700 block mb-1">
            Service Charge / Packaging Fee (%)
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={serviceChargeRate}
            onChange={e => setServiceChargeRate(Math.max(0, Number(e.target.value) || 0))}
            className="input w-full text-xs font-mono"
            placeholder="0.00"
          />
          <span className="text-[10px] text-stone-400 mt-1 block">Optional extra cost (0% to disable)</span>
        </div>

        <div>
          <label className="text-xs font-semibold text-stone-700 block mb-1">
            GSTIN (Tax ID Number)
          </label>
          <input
            type="text"
            placeholder="e.g. 36AABCS1429B1Z"
            value={gstin}
            onChange={e => setGstin(e.target.value.toUpperCase())}
            className="input w-full text-xs font-mono uppercase"
          />
          <span className="text-[10px] text-stone-400 mt-1 block">Appears on tax invoices and receipts</span>
        </div>

        <div>
          <label className="text-xs font-semibold text-stone-700 block mb-1">
            Currency Symbol
          </label>
          <input
            type="text"
            value={currency}
            onChange={e => setCurrency(e.target.value)}
            className="input w-full text-xs font-mono"
          />
          <span className="text-[10px] text-stone-400 mt-1 block">E.g. ₹, $, €, £</span>
        </div>
      </div>

      {/* Live Interactive Calculation Preview */}
      <div className="bg-stone-50 rounded-xl p-4 border border-stone-200 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-stone-800">
            <Calculator size={14} className="text-[var(--color-accent)]" />
            <span>Live Bill Calculation Preview</span>
          </div>
          <span className="text-[10px] font-semibold text-stone-500">Sample Order: {currency}{sampleAmount.toFixed(2)}</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-1 border-t border-stone-200/70">
          <div>
            <span className="text-[11px] text-stone-500 block">Subtotal:</span>
            <span className="font-bold text-stone-800 font-mono">{currency}{sampleAmount.toFixed(2)}</span>
          </div>

          <div>
            <span className="text-[11px] text-stone-500 block">CGST ({taxEnabled ? cgstRate : 0}%):</span>
            <span className="font-bold text-stone-800 font-mono">{currency}{cgstAmount.toFixed(2)}</span>
          </div>

          <div>
            <span className="text-[11px] text-stone-500 block">SGST ({taxEnabled ? sgstRate : 0}%):</span>
            <span className="font-bold text-stone-800 font-mono">{currency}{sgstAmount.toFixed(2)}</span>
          </div>

          {serviceChargeRate > 0 && (
            <div>
              <span className="text-[11px] text-stone-500 block">Service ({serviceChargeRate}%):</span>
              <span className="font-bold text-stone-800 font-mono">{currency}{serviceChargeAmount.toFixed(2)}</span>
            </div>
          )}

          <div>
            <span className="text-[11px] text-stone-500 block">Grand Total:</span>
            <span className="font-extrabold text-[var(--color-accent)] font-mono">{currency}{grandTotal.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

const sections = [
  { id: 'profile', label: 'Restaurant Profile', icon: Store },
  { id: 'branding', label: 'Branding', icon: Palette },
  { id: 'ordering', label: 'Order Settings', icon: Zap },
  { id: 'billing', label: 'Billing', icon: CreditCard },
]

export function SettingsPage() {
  const { profile } = useAuth()
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeSection, setActiveSection] = useState('profile')

  // Profile fields
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')

  // Ordering settings
  const [orderingEnabled, setOrderingEnabled] = useState(true)
  const [acceptOrders, setAcceptOrders] = useState(true)
  const [autoAccept, setAutoAccept] = useState(false)
  const [showSoldOut, setShowSoldOut] = useState(true)
  const [allowSpecialInstructions, setAllowSpecialInstructions] = useState(true)
  const [requireName, setRequireName] = useState(false)
  const [requirePhone, setRequirePhone] = useState(false)

  // Billing & UPI settings
  const [gstin, setGstin] = useState('')
  const [upiId, setUpiId] = useState('8309653769@upi')
  const [upiMerchantName, setUpiMerchantName] = useState('Deccan CRM')
  const [receiptFooter, setReceiptFooter] = useState('Thank you for dining with us! Please visit again.')
  const [taxEnabled, setTaxEnabled] = useState(true)
  const [cgstRate, setCgstRate] = useState(2.5)
  const [sgstRate, setSgstRate] = useState(2.5)
  const [serviceChargeRate, setServiceChargeRate] = useState(0)
  const [currency, setCurrency] = useState('₹')
  const [receiptWidth, setReceiptWidth] = useState<'80mm' | '58mm'>('80mm')
  const [gatewayProvider, setGatewayProvider] = useState<'mock_upi' | 'razorpay' | 'cashfree' | 'phonepe'>('mock_upi')
  const [gatewayMode, setGatewayMode] = useState<'test' | 'live'>('test')

  useEffect(() => {
    if (!profile?.restaurant_id) return
    const load = async () => {
      const rest = await restaurantService.getById(profile.restaurant_id!)
      if (rest) {
        setRestaurant(rest)
        setName(rest.name)
        setPhone(rest.phone || '')
        setAddress(rest.address || '')
        setOrderingEnabled(rest.ordering_enabled)
        setAcceptOrders(rest.accept_orders)
        setAutoAccept(rest.auto_accept_orders)
        setShowSoldOut(rest.show_sold_out_items)
        setAllowSpecialInstructions(rest.allow_special_instructions)
        setRequireName(rest.require_customer_name)
        setRequirePhone(rest.require_customer_phone)

        // Billing & Additional Costs
        setGstin(rest.gstin || '')
        setUpiId(rest.upi_id || '8309653769@upi')
        setUpiMerchantName(rest.upi_merchant_name || rest.name || 'Deccan CRM')
        setReceiptFooter(rest.receipt_footer || 'Thank you for dining with us! Please visit again.')
        setTaxEnabled(rest.tax_enabled ?? true)
        setCgstRate(Number(rest.cgst_rate ?? 2.5))
        setSgstRate(Number(rest.sgst_rate ?? 2.5))
        setServiceChargeRate(Number(rest.service_charge_rate ?? 0))
        setCurrency(rest.currency || '₹')
        setReceiptWidth((rest.receipt_width as '80mm' | '58mm') || '80mm')
        setGatewayProvider((rest.gateway_provider as any) || 'mock_upi')
        setGatewayMode((rest.gateway_mode as any) || 'test')
      }
      setLoading(false)
    }
    load()
  }, [profile?.restaurant_id])

  const saveChanges = async () => {
    if (!restaurant) return
    setSaving(true)
    const { error } = await restaurantService.update(restaurant.id, {
      name, phone, address,
      ordering_enabled: orderingEnabled,
      accept_orders: acceptOrders,
      auto_accept_orders: autoAccept,
      show_sold_out_items: showSoldOut,
      allow_special_instructions: allowSpecialInstructions,
      require_customer_name: requireName,
      require_customer_phone: requirePhone,
      gstin: gstin || null,
      upi_id: upiId,
      upi_merchant_name: upiMerchantName,
      receipt_footer: receiptFooter,
      tax_enabled: taxEnabled,
      cgst_rate: Number(cgstRate),
      sgst_rate: Number(sgstRate),
      service_charge_rate: Number(serviceChargeRate),
      currency,
      receipt_width: receiptWidth,
      gateway_provider: gatewayProvider,
      gateway_mode: gatewayMode,
    })
    setSaving(false)
    if (error) toast.error('Failed to save settings')
    else toast.success('Settings saved successfully')
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-24 rounded-2xl w-full" />
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="skeleton h-64 rounded-2xl" />
          <div className="skeleton h-[500px] rounded-2xl lg:col-span-3" />
        </div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Configure your restaurant profile and preferences."
        action={
          <button className="btn btn-primary" onClick={saveChanges} disabled={saving}>
            <Save size={16} />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Sidebar */}
        <div className="lg:col-span-3">
          <div className="card p-2 space-y-1 sticky top-6">
            {sections.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveSection(id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all text-left ${
                  activeSection === id
                    ? 'bg-[var(--color-accent-light)] text-[var(--color-accent)]'
                    : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-background)] hover:text-[var(--color-text-primary)]'
                }`}
              >
                <Icon size={18} />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="lg:col-span-9">
          <AnimatePresence mode="wait">
            {activeSection === 'profile' && (
              <motion.div
                key="profile"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="card p-8">
                  <h2 className="text-xl font-bold mb-6 text-[var(--color-text-primary)] border-b border-[var(--color-border-subtle)] pb-4">
                    Restaurant Profile
                  </h2>
                  <div className="space-y-6 max-w-2xl">
                    <Input label="Restaurant Name" value={name} onChange={(e) => setName(e.target.value)} />
                    <Input label="Phone Number" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" />
                    <Textarea label="Address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Full street address..." />
                  </div>
                </div>

                {/* Additional Costs & Taxes Configuration */}
                <TaxAndAdditionalChargesCard
                  taxEnabled={taxEnabled}
                  setTaxEnabled={setTaxEnabled}
                  cgstRate={cgstRate}
                  setCgstRate={setCgstRate}
                  sgstRate={sgstRate}
                  setSgstRate={setSgstRate}
                  serviceChargeRate={serviceChargeRate}
                  setServiceChargeRate={setServiceChargeRate}
                  gstin={gstin}
                  setGstin={setGstin}
                  currency={currency}
                  setCurrency={setCurrency}
                />
              </motion.div>
            )}

            {activeSection === 'branding' && (
              <motion.div
                key="branding"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="card p-8"
              >
                <h2 className="text-xl font-bold mb-6 text-[var(--color-text-primary)] border-b border-[var(--color-border-subtle)] pb-4">
                  Branding
                </h2>
                <div className="p-12 text-center text-[var(--color-text-tertiary)] border-2 border-dashed border-[var(--color-border)] rounded-2xl">
                  <Palette size={48} className="mx-auto mb-4 opacity-30" />
                  <h3 className="text-lg font-semibold text-[var(--color-text-secondary)] mb-2">Custom Branding</h3>
                  <p className="max-w-md mx-auto">Upload your restaurant logo, set cover images, and customize your theme colors. Feature coming soon.</p>
                </div>
              </motion.div>
            )}

            {activeSection === 'ordering' && (
              <motion.div
                key="ordering"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="card p-0 overflow-hidden"
              >
                <div className="p-8 border-b border-[var(--color-border-subtle)]">
                  <h2 className="text-xl font-bold text-[var(--color-text-primary)]">
                    Order Settings
                  </h2>
                  <p className="text-sm text-[var(--color-text-secondary)] mt-1">Configure how customers place orders.</p>
                </div>

                <div className="p-8 space-y-8 bg-[#FAFAF8]">
                  <div className="space-y-4 bg-white p-6 rounded-2xl border border-[var(--color-border)] shadow-sm">
                    <h3 className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider mb-2">Workflow Controls</h3>
                    <Switch
                      checked={orderingEnabled}
                      onChange={setOrderingEnabled}
                      label="Enable QR Ordering"
                      description="Allow customers to place orders directly via QR codes."
                      id="ordering-enabled"
                    />
                    <div className="h-px bg-[var(--color-border-subtle)] my-2" />
                    <Switch
                      checked={acceptOrders}
                      onChange={setAcceptOrders}
                      label="Accept New Orders"
                      description="Toggle off to temporarily pause all incoming orders."
                      id="accept-orders"
                    />
                    <div className="h-px bg-[var(--color-border-subtle)] my-2" />
                    <Switch
                      checked={autoAccept}
                      onChange={setAutoAccept}
                      label="Auto-Accept Orders"
                      description="Orders instantly move to 'Preparing' without manual approval."
                      id="auto-accept"
                    />
                  </div>

                  <div className="space-y-4 bg-white p-6 rounded-2xl border border-[var(--color-border)] shadow-sm">
                    <h3 className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider mb-2">Menu Display</h3>
                    <Switch
                      checked={showSoldOut}
                      onChange={setShowSoldOut}
                      label="Show Sold-Out Items"
                      description="Keep out-of-stock items visible but unorderable."
                      id="show-sold-out"
                    />
                    <div className="h-px bg-[var(--color-border-subtle)] my-2" />
                    <Switch
                      checked={allowSpecialInstructions}
                      onChange={setAllowSpecialInstructions}
                      label="Allow Special Instructions"
                      description="Customers can add cooking notes to their cart."
                      id="allow-instructions"
                    />
                  </div>

                  <div className="space-y-4 bg-white p-6 rounded-2xl border border-[var(--color-border)] shadow-sm">
                    <h3 className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider mb-2">Customer Information</h3>
                    <Switch
                      checked={requireName}
                      onChange={setRequireName}
                      label="Require Customer Name"
                      description="Name is mandatory during checkout."
                      id="require-name"
                    />
                    <div className="h-px bg-[var(--color-border-subtle)] my-2" />
                    <Switch
                      checked={requirePhone}
                      onChange={setRequirePhone}
                      label="Require Customer Phone"
                      description="Phone number is mandatory during checkout."
                      id="require-phone"
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {activeSection === 'billing' && (
              <motion.div
                key="billing"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                {/* UPI Configuration */}
                <div className="card p-6 space-y-4">
                  <div className="border-b border-[var(--color-border-subtle)] pb-3">
                    <h3 className="text-base font-bold text-[var(--color-text-primary)]">
                      UPI Payment Configuration
                    </h3>
                    <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                      Configure your direct bank UPI ID or merchant QR for customer checkout.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-stone-700 block mb-1">
                        UPI ID (VPA)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. restaurant@okhdfcbank"
                        value={upiId}
                        onChange={e => setUpiId(e.target.value)}
                        className="input w-full text-xs font-mono"
                      />
                      <span className="text-[10px] text-stone-500 mt-1 block">
                        Payments will be routed directly to this UPI address.
                      </span>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-stone-700 block mb-1">
                        Merchant / Display Name
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Deccan CRM"
                        value={upiMerchantName}
                        onChange={e => setUpiMerchantName(e.target.value)}
                        className="input w-full text-xs"
                      />
                      <span className="text-[10px] text-stone-500 mt-1 block">
                        Name shown in Google Pay / PhonePe when customer scans QR.
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div>
                      <label className="text-xs font-semibold text-stone-700 block mb-1">
                        Payment Gateway Provider
                      </label>
                      <select
                        value={gatewayProvider}
                        onChange={e => setGatewayProvider(e.target.value as any)}
                        className="input w-full text-xs"
                      >
                        <option value="mock_upi">Mock UPI (Instant POS Sandbox)</option>
                        <option value="razorpay">Razorpay UPI</option>
                        <option value="cashfree">Cashfree Payments</option>
                        <option value="phonepe">PhonePe Payment Gateway</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-stone-700 block mb-1">
                        Gateway Environment Mode
                      </label>
                      <select
                        value={gatewayMode}
                        onChange={e => setGatewayMode(e.target.value as any)}
                        className="input w-full text-xs"
                      >
                        <option value="test">Test / Sandbox Mode</option>
                        <option value="live">Live / Production Mode</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Taxes, GST & Additional Charges Configuration */}
                <TaxAndAdditionalChargesCard
                  taxEnabled={taxEnabled}
                  setTaxEnabled={setTaxEnabled}
                  cgstRate={cgstRate}
                  setCgstRate={setCgstRate}
                  sgstRate={sgstRate}
                  setSgstRate={setSgstRate}
                  serviceChargeRate={serviceChargeRate}
                  setServiceChargeRate={setServiceChargeRate}
                  gstin={gstin}
                  setGstin={setGstin}
                  currency={currency}
                  setCurrency={setCurrency}
                />

                {/* Thermal Printer Settings */}
                <div className="card p-6 space-y-4">
                  <div className="border-b border-[var(--color-border-subtle)] pb-3">
                    <h3 className="text-base font-bold text-[var(--color-text-primary)]">
                      Thermal Receipt Printer Settings
                    </h3>
                    <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                      Optimize receipts for 80mm or 58mm thermal rolls and customize footer greetings.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-stone-700 block mb-1">
                        Receipt Paper Width
                      </label>
                      <select
                        value={receiptWidth}
                        onChange={e => setReceiptWidth(e.target.value as '80mm' | '58mm')}
                        className="input w-full text-xs"
                      >
                        <option value="80mm">80mm Thermal Paper (Standard POS - 42/48 chars)</option>
                        <option value="58mm">58mm Thermal Paper (Compact / Mobile - 32 chars)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-stone-700 block mb-1">
                        Custom Receipt Footer
                      </label>
                      <input
                        type="text"
                        placeholder="Thank you for dining with us! Please visit again."
                        value={receiptFooter}
                        onChange={e => setReceiptFooter(e.target.value)}
                        className="input w-full text-xs"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={saveChanges}
                    disabled={saving}
                    className="btn btn-primary h-10 px-6 text-xs flex items-center gap-1.5 shadow-sm"
                  >
                    <Save size={15} />
                    <span>{saving ? 'Saving Settings...' : 'Save Billing Settings'}</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
