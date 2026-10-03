import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, Search, Edit2, Copy, Trash2,
  Star, UtensilsCrossed, Upload, X, MoreVertical,
  ChevronDown, Clock, Sparkles, Image as ImageIcon, Layers, FileText
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { menuItemService, categoryService } from '@/services'
import { FoodTypeIndicator, EmptyState, Switch } from '@/components/ui'
import { ConfirmDialog } from '@/components/ui/Dialog'
import { Drawer } from '@/components/ui/Drawer'
import { Input, Textarea } from '@/components/ui/Input'
import { PageHeader } from '@/components/admin/PageHeader'
import { formatCurrency, cn } from '@/lib/utils'
import { hasPermission } from '@/lib/permissions'
import type { MenuItem, Category, FoodType } from '@/types/database'
import toast from 'react-hot-toast'

const FOOD_TYPES: { value: FoodType; label: string; color: string }[] = [
  { value: 'veg', label: 'Vegetarian', color: 'text-green-600' },
  { value: 'non-veg', label: 'Non-Vegetarian', color: 'text-red-600' },
  { value: 'egg', label: 'Egg', color: 'text-amber-600' },
]

interface MenuItemFormData {
  name: string
  description: string
  category_id: string
  price: string
  food_type: FoodType
  is_available: boolean
  is_recommended: boolean
  preparation_time: string
  image_url: string
}

const defaultForm: MenuItemFormData = {
  name: '',
  description: '',
  category_id: '',
  price: '',
  food_type: 'veg',
  is_available: true,
  is_recommended: false,
  preparation_time: '',
  image_url: '',
}

export function MenuPage() {
  const { profile } = useAuth()
  const canManageMenu = hasPermission(profile?.role, 'manage_menu')
  const canToggleStock = hasPermission(profile?.role, 'toggle_item_stock')

  const [items, setItems] = useState<MenuItem[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [filterAvailability, setFilterAvailability] = useState<'all' | 'available' | 'unavailable'>('all')
  
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editItem, setEditItem] = useState<MenuItem | null>(null)
  const [deleteItem, setDeleteItem] = useState<MenuItem | null>(null)
  
  const [form, setForm] = useState<MenuItemFormData>(defaultForm)
  const [formLoading, setFormLoading] = useState(false)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string>('')
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null)

  const load = async () => {
    if (!profile?.restaurant_id) return
    setLoading(true)
    const [itemsData, catsData] = await Promise.all([
      menuItemService.getByRestaurant(profile.restaurant_id),
      categoryService.getByRestaurant(profile.restaurant_id),
    ])
    setItems(itemsData)
    setCategories(catsData)
    setLoading(false)
  }

  useEffect(() => { load() }, [profile?.restaurant_id])

  const openAddDrawer = () => {
    setEditItem(null)
    setForm({ ...defaultForm, category_id: categories[0]?.id || '' })
    setImageFile(null)
    setImagePreview('')
    setDrawerOpen(true)
  }

  const openEditDrawer = (item: MenuItem) => {
    setEditItem(item)
    setForm({
      name: item.name,
      description: item.description || '',
      category_id: item.category_id,
      price: String(item.price),
      food_type: item.food_type,
      is_available: item.is_available,
      is_recommended: item.is_recommended,
      preparation_time: item.preparation_time ? String(item.preparation_time) : '',
      image_url: item.image_url || '',
    })
    setImagePreview(item.image_url || '')
    setImageFile(null)
    setDrawerOpen(true)
    setActiveMenuId(null)
  }

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB')
      return
    }
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name || !form.price || !form.category_id) {
      toast.error('Please fill in all required fields')
      return
    }

    setFormLoading(true)
    let image_url = form.image_url

    if (imageFile && profile?.restaurant_id) {
      const { url, error } = await menuItemService.uploadImage(imageFile, profile.restaurant_id)
      if (error) {
        toast.error('Failed to upload image')
        setFormLoading(false)
        return
      }
      image_url = url || ''
    }

    const payload = {
      restaurant_id: profile!.restaurant_id!,
      category_id: form.category_id,
      name: form.name,
      description: form.description || null,
      price: parseFloat(form.price),
      food_type: form.food_type,
      is_available: form.is_available,
      is_recommended: form.is_recommended,
      preparation_time: form.preparation_time ? parseInt(form.preparation_time) : null,
      image_url: image_url || null,
      display_order: 0,
    }

    if (editItem) {
      const { error } = await menuItemService.update(editItem.id, payload)
      if (error) toast.error('Failed to update item')
      else {
        toast.success('Menu item updated')
        setDrawerOpen(false)
        load()
      }
    } else {
      const { error } = await menuItemService.create(payload as any)
      if (error) toast.error('Failed to add item')
      else {
        toast.success('Menu item added')
        setDrawerOpen(false)
        load()
      }
    }
    setFormLoading(false)
  }

  const handleToggleAvailability = async (item: MenuItem) => {
    const { error } = await menuItemService.toggleAvailability(item.id, !item.is_available)
    if (error) toast.error('Failed to update availability')
    else {
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, is_available: !i.is_available } : i))
      toast.success(item.is_available ? 'Marked as sold out' : 'Marked as available')
    }
  }

  const handleDelete = async () => {
    if (!deleteItem) return
    const { error } = await menuItemService.delete(deleteItem.id)
    if (error) toast.error('Failed to delete item')
    else {
      toast.success('Menu item deleted')
      setItems(prev => prev.filter(i => i.id !== deleteItem.id))
      setDeleteItem(null)
    }
  }

  const handleDuplicate = async (item: MenuItem) => {
    setActiveMenuId(null)
    const { error } = await menuItemService.create({
      restaurant_id: item.restaurant_id,
      category_id: item.category_id,
      name: `${item.name} (Copy)`,
      description: item.description,
      price: item.price,
      food_type: item.food_type,
      is_available: item.is_available,
      is_recommended: false,
      preparation_time: item.preparation_time,
      image_url: item.image_url,
      display_order: item.display_order,
    })
    if (error) toast.error('Failed to duplicate item')
    else {
      toast.success('Item duplicated')
      load()
    }
  }

  const filtered = items.filter(item => {
    const matchSearch = item.name.toLowerCase().includes(search.toLowerCase())
    const matchCat = filterCategory === 'all' || item.category_id === filterCategory
    const matchAvail = filterAvailability === 'all' || 
      (filterAvailability === 'available' ? item.is_available : !item.is_available)
    return matchSearch && matchCat && matchAvail
  })

  return (
    <div>
      <PageHeader
        title="Menu"
        description="Manage your food items, prices and availability."
        action={
          canManageMenu ? (
            <button className="btn btn-primary" onClick={openAddDrawer} id="btn-add-menu-item">
              <Plus size={16} />
              Add Item
            </button>
          ) : undefined
        }
      />

      {/* Kitchen Staff Role Informative Notice */}
      {!canManageMenu && canToggleStock && (
        <div className="mb-5 p-3.5 rounded-2xl bg-amber-50 border border-amber-200/90 flex items-center justify-between gap-3 text-xs text-amber-900 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <span className="text-lg">👨‍🍳</span>
            <span>
              <strong>Kitchen Display Mode:</strong> You can toggle live dish stock availability (Available / Sold Out). Creating items and changing recipes or pricing requires Manager or Admin permissions.
            </span>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center gap-4 mb-6">
        <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-[var(--color-border)] w-full md:w-[320px]">
          <Search size={16} className="text-[var(--color-text-tertiary)]" />
          <input
            placeholder="Search menu..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent text-sm outline-none flex-1 text-[var(--color-text-primary)]"
          />
        </div>
        
        <div className="flex gap-2 flex-wrap">
          <select 
            className="input md:w-auto w-full py-2 bg-white"
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value)}
          >
            <option value="all">All Categories</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <select 
            className="input md:w-auto w-full py-2 bg-white"
            value={filterAvailability}
            onChange={e => setFilterAvailability(e.target.value as any)}
          >
            <option value="all">All Availability</option>
            <option value="available">Available</option>
            <option value="unavailable">Sold Out</option>
          </select>
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="card p-0 overflow-hidden">
              <div className="skeleton h-48 w-full rounded-none" />
              <div className="p-5 space-y-4">
                <div className="skeleton h-6 w-3/4" />
                <div className="skeleton h-4 w-full" />
                <div className="skeleton h-4 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<UtensilsCrossed size={28} />}
            title="No menu items found"
            description="Adjust your filters or add a new item."
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          <AnimatePresence>
            {filtered.map(item => (
              <motion.div
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                key={item.id}
                className="card flex flex-col p-0 overflow-visible relative group"
              >
                {/* Image Area */}
                <div className="aspect-[4/3] w-full bg-[var(--color-border-subtle)] relative overflow-hidden rounded-t-[16px]">
                  {item.image_url ? (
                    <img src={item.image_url} alt={item.name} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[var(--color-text-tertiary)]">
                      <UtensilsCrossed size={32} />
                    </div>
                  )}
                  {item.is_recommended && (
                    <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-md text-xs font-bold text-amber-600 shadow-sm flex items-center gap-1">
                      <Star size={12} className="fill-amber-500" /> Recommended
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="p-5 flex-1 flex flex-col">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <FoodTypeIndicator type={item.food_type} />
                      <h3 className="font-bold text-[var(--color-text-primary)] text-lg leading-tight line-clamp-1" title={item.name}>{item.name}</h3>
                    </div>
                    
                    {canManageMenu && (
                      <div className="relative">
                        <button 
                          onClick={() => setActiveMenuId(activeMenuId === item.id ? null : item.id)}
                          className="p-1 -mr-1 text-[var(--color-text-secondary)] hover:bg-[var(--color-background)] rounded-md transition-colors"
                        >
                          <MoreVertical size={16} />
                        </button>
                        
                        <AnimatePresence>
                          {activeMenuId === item.id && (
                            <>
                              <div className="fixed inset-0 z-40" onClick={() => setActiveMenuId(null)} />
                              <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: -10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                                className="absolute right-0 top-full mt-1 w-36 bg-white border border-[var(--color-border)] rounded-xl shadow-xl z-50 overflow-hidden"
                              >
                                <button onClick={() => openEditDrawer(item)} className="w-full text-left px-4 py-2.5 text-sm hover:bg-[var(--color-background)] flex items-center gap-2">
                                  <Edit2 size={14} /> Edit
                                </button>
                                <button onClick={() => handleDuplicate(item)} className="w-full text-left px-4 py-2.5 text-sm hover:bg-[var(--color-background)] flex items-center gap-2">
                                  <Copy size={14} /> Duplicate
                                </button>
                                <button onClick={() => { setActiveMenuId(null); setDeleteItem(item); }} className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2">
                                  <Trash2 size={14} /> Delete
                                </button>
                              </motion.div>
                            </>
                          )}
                        </AnimatePresence>
                      </div>
                    )}
                  </div>

                  <div className="text-xs text-[var(--color-text-tertiary)] uppercase tracking-wider mb-2">
                    {categories.find(c => c.id === item.category_id)?.name || 'Uncategorized'}
                  </div>

                  <p className="text-sm text-[var(--color-text-secondary)] line-clamp-2 mb-4 flex-1">
                    {item.description || 'No description provided.'}
                  </p>

                  <div className="flex items-center justify-between mt-auto pt-4 border-t border-[var(--color-border-subtle)]">
                    <div className="font-bold text-lg text-[var(--color-text-primary)]">
                      {formatCurrency(item.price)}
                    </div>
                    <label className={cn('relative inline-flex items-center', canToggleStock ? 'cursor-pointer' : 'cursor-not-allowed opacity-70')} onClick={(e) => e.stopPropagation()}>
                      <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        checked={item.is_available} 
                        disabled={!canToggleStock}
                        onChange={() => canToggleStock && handleToggleAvailability(item)} 
                      />
                      <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--color-success)]"></div>
                      <span className="ml-2 text-xs font-medium text-[var(--color-text-secondary)]">
                        {item.is_available ? 'Avail' : 'Sold'}
                      </span>
                    </label>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Drawer */}
      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editItem ? 'Edit Menu Item' : 'Add Menu Item'}
        description="Configure dish details, category, pricing, and live ordering options."
        footer={
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="btn btn-secondary flex-1 h-11 font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={formLoading}
              className="btn btn-primary flex-1 h-11 font-semibold shadow-xs"
            >
              {formLoading ? 'Saving...' : (editItem ? 'Save Changes' : 'Add Item')}
            </button>
          </div>
        }
      >
        <form id="menu-form" onSubmit={handleSubmit} className="space-y-6">
          {/* Section 1: Media Upload */}
          <div>
            <div className="flex items-center gap-2 mb-2.5">
              <ImageIcon size={15} className="text-[var(--color-accent)]" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
                Media & Photo
              </h3>
            </div>
            <div className="bg-[var(--color-surface-subtle)] p-4 rounded-xl border border-[var(--color-border)] flex items-center gap-4">
              <div className="w-20 h-20 rounded-xl overflow-hidden bg-white border border-[var(--color-border)] flex items-center justify-center flex-shrink-0 relative shadow-2xs">
                {imagePreview ? (
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-[var(--color-accent-light)] flex items-center justify-center">
                    <UtensilsCrossed size={18} className="text-[var(--color-accent)]" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <label className="btn btn-secondary btn-sm cursor-pointer inline-flex shadow-2xs">
                  <Upload size={13} />
                  {imagePreview ? 'Change Photo' : 'Upload Photo'}
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
                </label>
                <p className="text-[11px] text-[var(--color-text-tertiary)] mt-1.5 leading-tight">
                  Supports JPG, PNG, WebP · Max 5MB
                </p>
                {imagePreview && (
                  <button
                    type="button"
                    onClick={() => {
                      setImagePreview('')
                      setImageFile(null)
                      setForm(f => ({ ...f, image_url: '' }))
                    }}
                    className="text-[11px] text-red-600 mt-1.5 hover:underline flex items-center gap-1 font-medium"
                  >
                    <X size={11} /> Remove photo
                  </button>
                )}
                <div className="mt-2.5 pt-2 border-t border-[var(--color-border)]">
                  <input
                    type="url"
                    placeholder="Or paste direct image URL (https://...)"
                    value={form.image_url}
                    onChange={(e) => {
                      const val = e.target.value
                      setForm(f => ({ ...f, image_url: val }))
                      if (val && !imageFile) setImagePreview(val)
                    }}
                    className="input text-xs h-8 px-2.5 bg-white w-full"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Basic Information */}
          <div className="space-y-3.5 pt-1">
            <div className="flex items-center gap-2 mb-1">
              <FileText size={15} className="text-[var(--color-accent)]" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
                Basic Information
              </h3>
            </div>
            
            <Input
              label="Food Name"
              placeholder="e.g. Paneer Butter Masala"
              value={form.name}
              onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
              required
            />

            <div>
              <label className="label">Category</label>
              <div className="relative">
                <select
                  className="input appearance-none pr-9 cursor-pointer"
                  value={form.category_id}
                  onChange={(e) => setForm(f => ({ ...f, category_id: e.target.value }))}
                  required
                >
                  <option value="">Select a category...</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <ChevronDown
                  size={15}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)] pointer-events-none"
                />
              </div>
            </div>

            <Textarea
              label="Description (Optional)"
              placeholder="Brief description of the dish, flavors, ingredients..."
              value={form.description}
              onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
              rows={3}
            />
          </div>

          {/* Section 3: Pricing & Kitchen Details */}
          <div className="space-y-3.5 pt-1">
            <div className="flex items-center gap-2 mb-1">
              <Layers size={15} className="text-[var(--color-accent)]" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
                Pricing & Details
              </h3>
            </div>

            <div className="grid grid-cols-2 gap-3.5">
              <Input
                label="Price (₹)"
                type="number"
                placeholder="220"
                min="0"
                step="0.5"
                leftIcon={<span className="text-xs font-bold text-[var(--color-text-secondary)]">₹</span>}
                value={form.price}
                onChange={(e) => setForm(f => ({ ...f, price: e.target.value }))}
                required
              />
              <Input
                label="Prep Time (min)"
                type="number"
                placeholder="15"
                min="0"
                leftIcon={<Clock size={14} className="text-[var(--color-text-tertiary)]" />}
                value={form.preparation_time}
                onChange={(e) => setForm(f => ({ ...f, preparation_time: e.target.value }))}
              />
            </div>

            <div>
              <label className="label">Food Type</label>
              <div className="grid grid-cols-3 gap-2">
                {FOOD_TYPES.map(type => {
                  const isSelected = form.food_type === type.value
                  return (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, food_type: type.value }))}
                      className={cn(
                        'flex items-center justify-center gap-2 h-10 px-2 rounded-xl text-xs font-semibold border transition-all duration-150 select-none',
                        isSelected && type.value === 'veg' && 'bg-emerald-50 text-emerald-800 border-emerald-300 ring-2 ring-emerald-500/20 shadow-2xs',
                        isSelected && type.value === 'non-veg' && 'bg-rose-50 text-rose-800 border-rose-300 ring-2 ring-rose-500/20 shadow-2xs',
                        isSelected && type.value === 'egg' && 'bg-amber-50 text-amber-800 border-amber-300 ring-2 ring-amber-500/20 shadow-2xs',
                        !isSelected && 'bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-text-primary)]'
                      )}
                    >
                      <FoodTypeIndicator type={type.value} />
                      <span className="truncate">{type.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Section 4: Visibility & Badging Options */}
          <div className="space-y-2.5 pt-1">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles size={15} className="text-[var(--color-accent)]" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
                Options & Visibility
              </h3>
            </div>

            <div className="p-3.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] flex items-center justify-between gap-4 hover:border-[var(--color-border-hover)] transition-all">
              <div>
                <div className="text-xs font-semibold text-[var(--color-text-primary)]">
                  Available for Order
                </div>
                <div className="text-[11px] text-[var(--color-text-secondary)] mt-0.5">
                  Customers can currently order this item
                </div>
              </div>
              <Switch
                checked={form.is_available}
                onChange={(val) => setForm(f => ({ ...f, is_available: val }))}
              />
            </div>

            <div className="p-3.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] flex items-center justify-between gap-4 hover:border-[var(--color-border-hover)] transition-all">
              <div>
                <div className="text-xs font-semibold text-[var(--color-text-primary)] flex items-center gap-1.5">
                  <Star size={12} className="text-amber-500 fill-amber-500" />
                  Recommended Item
                </div>
                <div className="text-[11px] text-[var(--color-text-secondary)] mt-0.5">
                  Highlight this item specially on the customer menu
                </div>
              </div>
              <Switch
                checked={form.is_recommended}
                onChange={(val) => setForm(f => ({ ...f, is_recommended: val }))}
              />
            </div>
          </div>
        </form>
      </Drawer>


      <ConfirmDialog
        open={!!deleteItem}
        onClose={() => setDeleteItem(null)}
        onConfirm={handleDelete}
        title="Delete Menu Item"
        description={`Are you sure you want to delete "${deleteItem?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  )
}
