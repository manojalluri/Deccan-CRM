import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Edit2, Trash2, Tag, Eye, EyeOff, MoreVertical } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { categoryService, menuItemService } from '@/services'
import { EmptyState, StatusBadge } from '@/components/ui'
import { ConfirmDialog } from '@/components/ui/Dialog'
import { Drawer } from '@/components/ui/Drawer'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { PageHeader } from '@/components/admin/PageHeader'
import type { Category } from '@/types/database'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

export function CategoriesPage() {
  const { profile } = useAuth()
  const [categories, setCategories] = useState<(Category & { itemsCount?: number })[]>([])
  const [loading, setLoading] = useState(true)
  
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editCat, setEditCat] = useState<Category | null>(null)
  const [deleteCat, setDeleteCat] = useState<Category | null>(null)
  
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [formLoading, setFormLoading] = useState(false)
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null)

  const load = async () => {
    if (!profile?.restaurant_id) return
    setLoading(true)
    const [catsData, itemsData] = await Promise.all([
      categoryService.getByRestaurant(profile.restaurant_id),
      menuItemService.getByRestaurant(profile.restaurant_id)
    ])
    
    // Add item counts
    const catsWithCounts = catsData.map(cat => ({
      ...cat,
      itemsCount: itemsData.filter(i => i.category_id === cat.id).length
    }))
    
    setCategories(catsWithCounts)
    setLoading(false)
  }

  useEffect(() => { load() }, [profile?.restaurant_id])

  const openAdd = () => {
    setEditCat(null)
    setName('')
    setDescription('')
    setDrawerOpen(true)
  }

  const openEdit = (cat: Category) => {
    setEditCat(cat)
    setName(cat.name)
    setDescription(cat.description || '')
    setDrawerOpen(true)
    setActiveMenuId(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { toast.error('Category name required'); return }
    setFormLoading(true)

    if (editCat) {
      const { error } = await categoryService.update(editCat.id, { name, description: description || null })
      if (error) toast.error('Failed to update category')
      else { toast.success('Category updated'); setDrawerOpen(false); load() }
    } else {
      const { error } = await categoryService.create({
        restaurant_id: profile!.restaurant_id!,
        name,
        description: description || null,
        image_url: null,
        display_order: categories.length,
        is_active: true,
      })
      if (error) toast.error('Failed to create category')
      else { toast.success('Category created'); setDrawerOpen(false); load() }
    }
    setFormLoading(false)
  }

  const handleToggle = async (cat: Category) => {
    setActiveMenuId(null)
    const { error } = await categoryService.update(cat.id, { is_active: !cat.is_active })
    if (error) toast.error('Failed to update')
    else {
      setCategories(prev => prev.map(c => c.id === cat.id ? { ...c, is_active: !c.is_active } : c))
      toast.success(cat.is_active ? 'Category hidden' : 'Category visible')
    }
  }

  const handleDelete = async () => {
    if (!deleteCat) return
    const { error } = await categoryService.delete(deleteCat.id)
    if (error) { 
      toast.error('Failed to delete. Make sure no menu items are using this category.') 
    } else {
      toast.success('Category deleted')
      setCategories(prev => prev.filter(c => c.id !== deleteCat.id))
      setDeleteCat(null)
    }
  }

  return (
    <div>
      <PageHeader
        title="Categories"
        description="Organize your restaurant menu."
        action={
          <button className="btn btn-primary" onClick={openAdd}>
            <Plus size={16} />
            Add Category
          </button>
        }
      />

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card p-5 space-y-4">
              <div className="flex gap-4">
                <div className="skeleton h-12 w-12 rounded-xl" />
                <div className="space-y-2 flex-1">
                  <div className="skeleton h-5 w-24" />
                  <div className="skeleton h-4 w-16" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : categories.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Tag size={28} />}
            title="No categories yet"
            description="Create categories to organize your menu items."
            action={<button className="btn btn-primary btn-sm" onClick={openAdd}><Plus size={16} /> Add Category</button>}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          <AnimatePresence>
            {categories.map((cat, i) => (
              <motion.div
                key={cat.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: i * 0.05 }}
                className={cn('card p-5 group flex flex-col', !cat.is_active && 'bg-[var(--color-background)]')}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex gap-4 items-center">
                    <div className="w-12 h-12 bg-orange-100 rounded-[12px] flex items-center justify-center text-orange-600 shadow-sm border border-orange-200">
                      <Tag size={20} />
                    </div>
                    <div>
                      <h3 className="font-bold text-[var(--color-text-primary)] text-lg">{cat.name}</h3>
                      <div className="text-sm text-[var(--color-text-secondary)]">{cat.itemsCount} items</div>
                    </div>
                  </div>
                  
                  <div className="relative">
                    <button 
                      onClick={() => setActiveMenuId(activeMenuId === cat.id ? null : cat.id)}
                      className="p-1.5 -mr-2 text-[var(--color-text-secondary)] hover:bg-[var(--color-background)] rounded-lg transition-colors"
                    >
                      <MoreVertical size={18} />
                    </button>
                    
                    <AnimatePresence>
                      {activeMenuId === cat.id && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setActiveMenuId(null)} />
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: -10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: -10 }}
                            className="absolute right-0 top-full mt-1 w-36 bg-white border border-[var(--color-border)] rounded-xl shadow-xl z-50 overflow-hidden"
                          >
                            <button onClick={() => openEdit(cat)} className="w-full text-left px-4 py-2.5 text-sm hover:bg-[var(--color-background)] flex items-center gap-2">
                              <Edit2 size={14} /> Edit
                            </button>
                            <button onClick={() => handleToggle(cat)} className="w-full text-left px-4 py-2.5 text-sm hover:bg-[var(--color-background)] flex items-center gap-2">
                              {cat.is_active ? <><EyeOff size={14} /> Disable</> : <><Eye size={14} /> Enable</>}
                            </button>
                            <button onClick={() => { setActiveMenuId(null); setDeleteCat(cat); }} className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2">
                              <Trash2 size={14} /> Delete
                            </button>
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {cat.description && (
                  <p className="text-sm text-[var(--color-text-secondary)] mt-1 mb-4 line-clamp-2">
                    {cat.description}
                  </p>
                )}

                <div className="mt-auto pt-4 border-t border-[var(--color-border-subtle)] flex items-center justify-between">
                  <span className={cn(
                    'text-xs font-semibold px-2.5 py-1 rounded-full',
                    cat.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'
                  )}>
                    {cat.is_active ? 'Active' : 'Inactive'}
                  </span>
                  <span className="text-xs font-medium text-[var(--color-text-tertiary)]">
                    Order: {cat.display_order}
                  </span>
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
        title={editCat ? 'Edit Category' : 'Add Category'}
        size="sm"
        footer={
          <div className="flex gap-3">
            <button type="button" onClick={() => setDrawerOpen(false)} className="btn btn-secondary flex-1">
              Cancel
            </button>
            <button onClick={handleSubmit} disabled={formLoading} className="btn btn-primary flex-1">
              {formLoading ? 'Saving...' : (editCat ? 'Save Changes' : 'Create Category')}
            </button>
          </div>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <Input
              label="Category Name *"
              placeholder="e.g. Starters"
              value={name}
              onChange={(e) => setName(e.target.value)}
              id="category-name"
            />
            <Textarea
              label="Description"
              placeholder="Brief description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[100px]"
            />
          </div>
        </form>
      </Drawer>

      <ConfirmDialog
        open={!!deleteCat}
        onClose={() => setDeleteCat(null)}
        onConfirm={handleDelete}
        title="Delete Category"
        description={`Delete "${deleteCat?.name}"? Make sure no menu items are currently using this category.`}
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  )
}
