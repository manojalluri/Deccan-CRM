import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Plus, Download, Printer, Trash2, Grid3X3, RefreshCw, 
  ExternalLink, Edit2, Users, CheckCircle2, Clock, 
  ChevronRight, Layers, MapPin
} from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useAuth } from '@/contexts/AuthContext'
import { tableService, restaurantService } from '@/services'
import { EmptyState } from '@/components/ui'
import { ConfirmDialog } from '@/components/ui/Dialog'
import { Drawer } from '@/components/ui/Drawer'
import { Dialog } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { PageHeader } from '@/components/admin/PageHeader'
import type { Table, Restaurant, TableStatus } from '@/types/database'
import { cn } from '@/lib/utils'
import { hasPermission } from '@/lib/permissions'
import toast from 'react-hot-toast'

const TABLE_STATUS_CONFIG: Record<TableStatus, {
  label: string
  bg: string
  text: string
  border: string
  dot: string
}> = {
  available: {
    label: 'Available',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    dot: 'bg-emerald-500',
  },
  occupied: {
    label: 'Occupied',
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    border: 'border-rose-200',
    dot: 'bg-rose-500',
  },
  ordering: {
    label: 'Ordering',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    dot: 'bg-amber-500',
  },
  reserved: {
    label: 'Reserved',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
    dot: 'bg-blue-500',
  },
}

export function TablesPage() {
  const { profile } = useAuth()
  const canManageTables = hasPermission(profile?.role, 'manage_tables')
  const [tables, setTables] = useState<Table[]>([])
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [loading, setLoading] = useState(true)
  
  // Filtering & view
  const [selectedSection, setSelectedSection] = useState<string>('all')
  const [search, setSearch] = useState('')

  // Drawers & Modals
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingTable, setEditingTable] = useState<Table | null>(null)
  const [selectedTable, setSelectedTable] = useState<Table | null>(null)
  const [deleteTable, setDeleteTable] = useState<Table | null>(null)
  const [qrModalOpen, setQrModalOpen] = useState(false)
  
  // Form State
  const [formTableNumber, setFormTableNumber] = useState('')
  const [formCapacity, setFormCapacity] = useState('4')
  const [formSection, setFormSection] = useState('Main Dining')
  const [formLoading, setFormLoading] = useState(false)
  const printRef = useRef<HTMLDivElement>(null)

  const load = async () => {
    if (!profile?.restaurant_id) return
    setLoading(true)
    const [tablesData, rest] = await Promise.all([
      tableService.getByRestaurant(profile.restaurant_id),
      restaurantService.getById(profile.restaurant_id),
    ])
    setTables(tablesData)
    setRestaurant(rest)
    setLoading(false)
  }

  useEffect(() => { load() }, [profile?.restaurant_id])

  const getQRUrl = (table: Table) => {
    const base = window.location.origin
    const slug = restaurant?.slug || 'samravaa'
    return `${base}/menu/${slug}/table/${table.qr_token}`
  }

  const openAddDrawer = () => {
    setEditingTable(null)
    setFormTableNumber(`T-${tables.length + 1}`)
    setFormCapacity('4')
    setFormSection('Main Dining')
    setDrawerOpen(true)
  }

  const openEditDrawer = (table: Table) => {
    setEditingTable(table)
    setFormTableNumber(table.table_number)
    setFormCapacity(String(table.capacity))
    setFormSection(table.section || 'Main Dining')
    setDrawerOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formTableNumber.trim()) {
      toast.error('Table number is required')
      return
    }
    setFormLoading(true)

    if (editingTable) {
      // Update existing table
      const { error } = await tableService.update(editingTable.id, {
        table_number: formTableNumber.trim(),
        capacity: parseInt(formCapacity) || 4,
        section: formSection.trim() || null,
      })
      setFormLoading(false)
      if (error) {
        toast.error('Failed to update table')
      } else {
        toast.success(`Table ${formTableNumber} updated`)
        setDrawerOpen(false)
        load()
      }
    } else {
      // Create new table
      const { error } = await tableService.create({
        restaurant_id: profile!.restaurant_id!,
        table_number: formTableNumber.trim(),
        capacity: parseInt(formCapacity) || 4,
        section: formSection.trim() || null,
        status: 'available',
        is_active: true,
      })
      setFormLoading(false)
      if (error) {
        toast.error('Failed to create table. It may already exist.')
      } else {
        toast.success(`Table ${formTableNumber} created with QR Code!`)
        setDrawerOpen(false)
        load()
      }
    }
  }

  const handleQuickStatusChange = async (table: Table, newStatus: TableStatus, e?: React.MouseEvent) => {
    e?.stopPropagation()
    // Optimistic UI update
    setTables(prev => prev.map(t => t.id === table.id ? { ...t, status: newStatus } : t))
    if (selectedTable?.id === table.id) {
      setSelectedTable(prev => prev ? { ...prev, status: newStatus } : null)
    }

    const { error } = await tableService.update(table.id, { status: newStatus })
    if (error) {
      toast.error('Failed to update table status')
      load() // Rollback on failure
    } else {
      toast.success(`Table ${table.table_number} marked as ${TABLE_STATUS_CONFIG[newStatus].label}`)
    }
  }

  const handleDelete = async () => {
    if (!deleteTable) return
    const { error } = await tableService.delete(deleteTable.id)
    if (error) {
      toast.error('Failed to delete table')
    } else {
      toast.success('Table deleted successfully')
      setTables(prev => prev.filter(t => t.id !== deleteTable.id))
      setDeleteTable(null)
      setSelectedTable(null)
    }
  }

  const handleRegenerateQR = async (table: Table) => {
    const { token, error } = await tableService.regenerateQR(table.id)
    if (error) {
      toast.error('Failed to regenerate QR')
    } else {
      toast.success('New QR code generated!')
      setTables(prev => prev.map(t => t.id === table.id ? { ...t, qr_token: token! } : t))
      if (selectedTable?.id === table.id) {
        setSelectedTable(prev => prev ? { ...prev, qr_token: token! } : null)
      }
    }
  }

  const handleDownloadQR = (table: Table) => {
    const svg = document.querySelector(`.qr-svg-${table.id}`) as SVGElement
    if (!svg) return
    const svgData = new XMLSerializer().serializeToString(svg)
    const canvas = document.createElement('canvas')
    canvas.width = 600
    canvas.height = 600
    const ctx = canvas.getContext('2d')!
    const img = new Image()
    img.onload = () => {
      ctx.fillStyle = 'white'
      ctx.fillRect(0, 0, 600, 600)
      ctx.drawImage(img, 50, 50, 500, 500)
      const link = document.createElement('a')
      link.download = `${restaurant?.name || 'Restaurant'}-Table-${table.table_number}-QR.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    }
    img.src = `data:image/svg+xml;base64,${btoa(svgData)}`
    toast.success('High-resolution QR Standee downloaded')
  }

  const handlePrint = () => window.print()

  // Statistics calculation
  const totalTables = tables.length
  const availableCount = tables.filter(t => t.status === 'available').length
  const occupiedCount = tables.filter(t => t.status === 'occupied').length
  const reservedCount = tables.filter(t => t.status === 'reserved').length
  const totalCapacity = tables.reduce((acc, t) => acc + (t.capacity || 0), 0)

  // Sections extraction
  const sections = Array.from(new Set(tables.map(t => t.section || 'General')))

  // Filtered tables
  const filteredTables = tables.filter(t => {
    const matchesSection = selectedSection === 'all' || (t.section || 'General') === selectedSection
    const matchesSearch = search 
      ? t.table_number.toLowerCase().includes(search.toLowerCase()) || 
        (t.section && t.section.toLowerCase().includes(search.toLowerCase()))
      : true
    return matchesSection && matchesSearch
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Table Management"
        description="Monitor live table occupancy, manage dining sections, and download table QR codes."
        action={
          canManageTables ? (
            <button className="btn btn-primary" onClick={openAddDrawer} id="btn-add-table">
              <Plus size={16} />
              Add Table
            </button>
          ) : undefined
        }
      />

      {/* KPI Stats Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div className="card p-4 flex items-center justify-between border-l-4 border-l-[var(--color-accent)]">
          <div>
            <div className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">Total Tables</div>
            <div className="text-2xl font-black text-gray-900 mt-1">{totalTables}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[var(--color-accent-light)] flex items-center justify-center text-[var(--color-accent)]">
            <Grid3X3 size={20} />
          </div>
        </div>

        <div className="card p-4 flex items-center justify-between border-l-4 border-l-emerald-500">
          <div>
            <div className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">Available</div>
            <div className="text-2xl font-black text-emerald-700 mt-1">{availableCount}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
            <CheckCircle2 size={20} />
          </div>
        </div>

        <div className="card p-4 flex items-center justify-between border-l-4 border-l-rose-500">
          <div>
            <div className="text-xs font-semibold text-rose-800 uppercase tracking-wider">Occupied</div>
            <div className="text-2xl font-black text-rose-700 mt-1">{occupiedCount}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600">
            <Users size={20} />
          </div>
        </div>

        <div className="card p-4 flex items-center justify-between border-l-4 border-l-blue-500">
          <div>
            <div className="text-xs font-semibold text-blue-800 uppercase tracking-wider">Reserved</div>
            <div className="text-2xl font-black text-blue-700 mt-1">{reservedCount}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
            <Clock size={20} />
          </div>
        </div>

        <div className="card p-4 flex items-center justify-between border-l-4 border-l-purple-500 col-span-2 sm:col-span-1">
          <div>
            <div className="text-xs font-semibold text-purple-800 uppercase tracking-wider">Total Seats</div>
            <div className="text-2xl font-black text-purple-700 mt-1">{totalCapacity}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
            <Layers size={20} />
          </div>
        </div>
      </div>

      {/* Filter and Section Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-[var(--color-border-subtle)] shadow-2xs">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setSelectedSection('all')}
            className={cn(
              'px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap',
              selectedSection === 'all'
                ? 'bg-gray-900 text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-100'
            )}
          >
            All Sections ({totalTables})
          </button>
          {sections.map(sec => {
            const count = tables.filter(t => (t.section || 'General') === sec).length
            return (
              <button
                key={sec}
                onClick={() => setSelectedSection(sec)}
                className={cn(
                  'px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5',
                  selectedSection === sec
                    ? 'bg-gray-900 text-white shadow-sm'
                    : 'text-gray-600 hover:bg-gray-100'
                )}
              >
                <MapPin size={12} />
                {sec} ({count})
              </button>
            )
          })}
        </div>

        <div className="relative w-full sm:w-64">
          <input
            type="text"
            placeholder="Search table number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input h-9 text-xs pl-8 w-full bg-gray-50 focus:bg-white"
          />
          <Grid3X3 size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
        </div>
      </div>

      {/* Tables Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="card p-5 space-y-4">
              <div className="skeleton h-7 w-28" />
              <div className="skeleton h-4 w-20" />
              <div className="skeleton h-10 w-full mt-4" />
            </div>
          ))}
        </div>
      ) : filteredTables.length === 0 ? (
        <div className="card p-12">
          <EmptyState
            icon={<Grid3X3 size={32} />}
            title="No tables found"
            description="Add tables or clear search filters to view your restaurant floor layout."
            action={
              canManageTables ? (
                <button className="btn btn-primary btn-sm" onClick={openAddDrawer}>
                  <Plus size={16} /> Add First Table
                </button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          <AnimatePresence>
            {filteredTables.map((table) => {
              return (
                <motion.div
                  key={table.id}
                  layout
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    'card p-5 transition-all duration-200 hover:shadow-md border border-[var(--color-border-subtle)] relative overflow-hidden group',
                    table.status === 'occupied' && 'ring-1 ring-rose-300/50 bg-rose-50/10',
                    table.status === 'reserved' && 'ring-1 ring-blue-300/50 bg-blue-50/10'
                  )}
                >
                  {/* Top Bar: Table Number & Section */}
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xl font-black text-gray-900 tracking-tight">
                          Table {table.table_number}
                        </span>
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-gray-100 text-gray-700">
                          {table.capacity} seats
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 flex items-center gap-1 mt-1 font-medium">
                        <MapPin size={12} className="text-gray-400" />
                        {table.section || 'General Floor'}
                      </div>
                    </div>

                    {/* QR Code Icon / View Standee Button */}
                    <button
                      onClick={() => {
                        setSelectedTable(table)
                        setQrModalOpen(true)
                      }}
                      title="View & Print QR Standee"
                      className="w-9 h-9 rounded-xl bg-gray-100 hover:bg-[var(--color-accent-light)] text-gray-600 hover:text-[var(--color-accent)] flex items-center justify-center transition-colors shadow-2xs"
                    >
                      <Grid3X3 size={18} />
                    </button>
                  </div>

                  {/* Quick Status Bar for Owner */}
                  <div className="my-3.5 p-1 bg-gray-50 border border-gray-200/80 rounded-xl flex items-center gap-1">
                    {(['available', 'occupied', 'reserved'] as TableStatus[]).map((st) => {
                      const isCurrent = table.status === st
                      const cfg = TABLE_STATUS_CONFIG[st]
                      return (
                        <button
                          key={st}
                          type="button"
                          onClick={(e) => handleQuickStatusChange(table, st, e)}
                          className={cn(
                            'flex-1 py-1.5 rounded-lg text-[11px] font-bold transition-all text-center capitalize',
                            isCurrent
                              ? `${cfg.bg} ${cfg.text} shadow-2xs font-extrabold ring-1 ${cfg.border}`
                              : 'text-gray-500 hover:bg-white hover:text-gray-900'
                          )}
                        >
                          {st}
                        </button>
                      )
                    })}
                  </div>

                  {/* QR SVG (hidden in DOM for download canvas rendering) */}
                  <div className="hidden">
                    <QRCodeSVG
                      value={getQRUrl(table)}
                      size={400}
                      level="H"
                      className={`qr-svg-${table.id}`}
                    />
                  </div>

                  {/* Card Bottom Controls */}
                  <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
                    <a
                      href={getQRUrl(table)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-semibold text-[var(--color-accent)] hover:underline flex items-center gap-1"
                      title="Open Customer QR Menu in New Tab"
                    >
                      <ExternalLink size={13} />
                      Preview Menu
                    </a>

                    <div className="flex items-center gap-1">
                      {canManageTables && (
                        <button
                          onClick={() => openEditDrawer(table)}
                          className="p-1.5 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                          title="Edit Table"
                        >
                          <Edit2 size={14} />
                        </button>
                      )}
                      <button
                        onClick={() => setSelectedTable(table)}
                        className="p-1.5 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                        title="Table Options"
                      >
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Add / Edit Table Drawer */}
      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editingTable ? `Edit Table ${editingTable.table_number}` : 'Add New Table'}
        size="sm"
        footer={
          <div className="flex gap-3 w-full">
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="btn btn-secondary flex-1"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={formLoading}
              className="btn btn-primary flex-1"
            >
              {formLoading ? 'Saving...' : editingTable ? 'Update Table' : 'Create Table'}
            </button>
          </div>
        }
      >
        <form onSubmit={handleSave} className="space-y-5">
          <Input
            label="Table Number / Identifier *"
            placeholder="e.g. 12, T-04, Balcony-1"
            value={formTableNumber}
            onChange={(e) => setFormTableNumber(e.target.value)}
            required
          />

          <Input
            label="Seating Capacity (Guests) *"
            type="number"
            placeholder="4"
            min="1"
            max="40"
            value={formCapacity}
            onChange={(e) => setFormCapacity(e.target.value)}
            required
          />

          <div>
            <label className="label">Section / Dining Area</label>
            <div className="relative">
              <input
                type="text"
                list="sections-list"
                placeholder="e.g. Main Dining, Terrace, VIP Lounge"
                value={formSection}
                onChange={(e) => setFormSection(e.target.value)}
                className="input w-full"
              />
              <datalist id="sections-list">
                <option value="Main Dining" />
                <option value="Indoor AC" />
                <option value="Outdoor Terrace" />
                <option value="Rooftop" />
                <option value="VIP Lounge" />
                <option value="Bar Area" />
              </datalist>
            </div>
            <p className="text-[11px] text-gray-500 mt-1">
              Select or type a custom section name.
            </p>
          </div>

          <div className="bg-orange-50/60 border border-orange-200/80 p-4 rounded-2xl flex gap-3 mt-4">
            <div className="w-8 h-8 rounded-xl bg-orange-100 flex items-center justify-center text-orange-600 flex-shrink-0">
              <Grid3X3 size={18} />
            </div>
            <div className="text-xs text-orange-950">
              <span className="font-bold block mb-0.5">Instant Digital QR Ready</span>
              Each table is automatically assigned a cryptographic QR token. When scanned, it immediately opens this table's live ordering menu!
            </div>
          </div>
        </form>
      </Drawer>

      {/* Table Detail & Actions Drawer */}
      <Drawer
        open={!!selectedTable && !qrModalOpen}
        onClose={() => setSelectedTable(null)}
        title={`Table ${selectedTable?.table_number}`}
        size="sm"
        footer={
          canManageTables ? (
            <div className="flex gap-2 w-full">
              <button
                onClick={() => {
                  if (selectedTable) {
                    openEditDrawer(selectedTable)
                    setSelectedTable(null)
                  }
                }}
                className="btn btn-secondary flex-1"
              >
                <Edit2 size={15} /> Edit
              </button>
              <button
                onClick={() => {
                  setDeleteTable(selectedTable)
                  setSelectedTable(null)
                }}
                className="btn btn-danger flex-1"
              >
                <Trash2 size={15} /> Delete
              </button>
            </div>
          ) : (
            <div className="w-full">
              <button
                type="button"
                onClick={() => setSelectedTable(null)}
                className="btn btn-secondary w-full"
              >
                Close
              </button>
            </div>
          )
        }
      >
        {selectedTable && (
          <div className="space-y-6">
            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 rounded-2xl border border-gray-200 bg-gray-50">
                <div className="text-xs text-gray-500 uppercase font-semibold">Capacity</div>
                <div className="text-xl font-bold text-gray-900 mt-0.5">{selectedTable.capacity} Guests</div>
              </div>
              <div className="p-3.5 rounded-2xl border border-gray-200 bg-gray-50">
                <div className="text-xs text-gray-500 uppercase font-semibold">Section</div>
                <div className="text-xl font-bold text-gray-900 mt-0.5">{selectedTable.section || 'General'}</div>
              </div>
            </div>

            {/* Status Selector */}
            <div>
              <label className="label">Update Table Status</label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                {(['available', 'occupied', 'ordering', 'reserved'] as TableStatus[]).map((st) => {
                  const cfg = TABLE_STATUS_CONFIG[st]
                  const isCurrent = selectedTable.status === st
                  return (
                    <button
                      key={st}
                      type="button"
                      onClick={() => handleQuickStatusChange(selectedTable, st)}
                      className={cn(
                        'flex items-center gap-2 p-2.5 rounded-xl border text-xs font-bold transition-all capitalize',
                        isCurrent 
                          ? `${cfg.bg} ${cfg.text} ${cfg.border} ring-2 ring-gray-900/10` 
                          : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                      )}
                    >
                      <div className={cn('w-2 h-2 rounded-full', cfg.dot)} />
                      {cfg.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* QR Standee Card */}
            <div className="card p-5 bg-gradient-to-b from-white to-gray-50 border border-gray-200">
              <div className="text-center mb-4">
                <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                  Customer Dining QR Code
                </div>
                <div className="text-xs text-gray-400">
                  Scan to view live digital menu & place dine-in order
                </div>
              </div>

              <div className="p-4 bg-white rounded-2xl shadow-sm border border-gray-200 mx-auto w-48 h-48 flex items-center justify-center mb-4">
                <QRCodeSVG
                  value={getQRUrl(selectedTable)}
                  size={160}
                  level="H"
                />
              </div>

              <div className="flex flex-col gap-2">
                <a
                  href={getQRUrl(selectedTable)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary w-full text-xs font-bold"
                >
                  <ExternalLink size={14} /> Open Customer View
                </a>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleDownloadQR(selectedTable)}
                    className="btn btn-secondary flex-1 text-xs"
                  >
                    <Download size={14} /> Save Image
                  </button>
                  <button
                    onClick={() => setQrModalOpen(true)}
                    className="btn btn-secondary flex-1 text-xs"
                  >
                    <Printer size={14} /> Print Standee
                  </button>
                </div>
                <button
                  onClick={() => handleRegenerateQR(selectedTable)}
                  className="text-xs text-gray-400 hover:text-gray-700 flex items-center justify-center gap-1 mt-1 font-medium"
                >
                  <RefreshCw size={12} /> Regenerate QR Token
                </button>
              </div>
            </div>
          </div>
        )}
      </Drawer>

      {/* Printable High-End Standee Dialog */}
      <Dialog
        open={qrModalOpen}
        onClose={() => setQrModalOpen(false)}
        title="Table Standee Preview & Print"
        size="md"
      >
        {selectedTable && (
          <div className="space-y-6">
            <div 
              ref={printRef} 
              className="bg-white rounded-3xl border-2 border-gray-900 p-8 text-center shadow-xl mx-auto max-w-sm relative overflow-hidden"
              style={{ minHeight: '440px' }}
            >
              {/* Decorative Restaurant Banner */}
              <div className="w-14 h-14 bg-[var(--color-accent)] rounded-2xl mx-auto mb-3 flex items-center justify-center shadow-md shadow-[var(--color-accent)]/20 text-white font-black text-2xl">
                {restaurant?.name?.charAt(0) || 'D'}
              </div>
              <div className="text-2xl font-black tracking-tight text-gray-950 uppercase font-sans">
                {restaurant?.name || 'Deccan CRM'}
              </div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-widest mt-0.5 mb-6">
                Premium Dine-in Experience
              </div>

              {/* QR Code Container */}
              <div className="p-4 bg-white rounded-2xl shadow-md border-2 border-gray-100 inline-block mb-4">
                <QRCodeSVG
                  value={getQRUrl(selectedTable)}
                  size={190}
                  level="H"
                />
              </div>

              {/* Table Info Badge */}
              <div className="bg-gray-900 text-white py-2 px-6 rounded-full inline-block font-black text-lg tracking-wider mb-3">
                TABLE {selectedTable.table_number}
              </div>

              <div className="text-xs font-bold text-gray-600 tracking-wide uppercase">
                Scan with Phone Camera to Order
              </div>
              <div className="text-[10px] text-gray-400 mt-1">
                No app download required • Instant live menu
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => handleDownloadQR(selectedTable)} className="btn btn-secondary flex-1 py-3">
                <Download size={16} /> Download PNG
              </button>
              <button onClick={handlePrint} className="btn btn-primary flex-1 py-3 text-base">
                <Printer size={18} /> Print Standee
              </button>
            </div>
          </div>
        )}
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteTable}
        onClose={() => setDeleteTable(null)}
        onConfirm={handleDelete}
        title="Delete Table"
        description={`Are you sure you want to delete Table ${deleteTable?.table_number}? This will permanently remove its QR code.`}
        confirmLabel="Delete Table"
        variant="danger"
      />
    </div>
  )
}
