import { useEffect, useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Search, Star, Clock, AlertCircle, ShoppingCart, 
  MapPin, Bell, Droplets, ChevronRight, X, Sparkles,
  Flame, Check, Utensils, Receipt, Trash2, ArrowUpRight,
  ChefHat, CheckCircle2, History
} from 'lucide-react'
import { restaurantService, categoryService, menuItemService, tableService, orderService } from '@/services'
import { supabase } from '@/lib/supabase'
import { useCartStore } from '@/store/cartStore'
import { FoodTypeIndicator } from '@/components/ui'
import { BottomSheet } from '@/components/ui/Dialog'
import { formatCurrency, cn } from '@/lib/utils'
import type { Restaurant, Category, MenuItem, Table, FoodType, Order, OrderStatus } from '@/types/database'
import toast from 'react-hot-toast'

// Customer Table Orders History Sheet
function OrdersHistorySheet({
  open,
  onClose,
  orders,
  onCancelOrder,
  onDeleteOrder,
  restaurantSlug,
  tableToken,
  tableNumber,
}: {
  open: boolean
  onClose: () => void
  orders: Order[]
  onCancelOrder: (order: Order) => void
  onDeleteOrder: (orderId: string) => void
  restaurantSlug: string
  tableToken: string
  tableNumber?: string
}) {
  const navigate = useNavigate()
  const [cancellingId, setCancellingId] = useState<string | null>(null)

  const handleCancelClick = async (order: Order) => {
    if (!window.confirm(`Are you sure you want to cancel Order #${order.order_number}? This will notify the kitchen and remove the items.`)) return
    setCancellingId(order.id)
    await onCancelOrder(order)
    setCancellingId(null)
  }

  const getStatusBadge = (status: OrderStatus | string) => {
    switch (status) {
      case 'placed':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
            <Clock size={11} className="text-amber-600 animate-spin" />
            Placed (Waiting)
          </span>
        )
      case 'accepted':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
            <CheckCircle2 size={11} />
            Accepted
          </span>
        )
      case 'preparing':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 border border-orange-200 animate-pulse">
            <ChefHat size={11} />
            Preparing
          </span>
        )
      case 'ready':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            <Sparkles size={11} />
            Ready
          </span>
        )
      case 'served':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-stone-100 text-stone-700 border border-stone-200">
            <Check size={11} />
            Served
          </span>
        )
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
            <X size={11} />
            Cancelled
          </span>
        )
      default:
        return (
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-stone-100 text-stone-700">
            {status}
          </span>
        )
    }
  }

  const formatOrderTime = (isoString?: string) => {
    if (!isoString) return ''
    try {
      const d = new Date(isoString)
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } catch {
      return ''
    }
  }

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="pb-6 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-200 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-orange-50 text-[var(--color-accent)] flex items-center justify-center font-bold">
              <Receipt size={18} />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-stone-900 leading-tight">
                Order History & Status
              </h2>
              <p className="text-[11px] text-stone-500 font-medium">
                Table {tableNumber || '01'} • {orders.length} {orders.length === 1 ? 'order' : 'orders'} placed
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-600 flex items-center justify-center transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Orders list */}
        <div className="overflow-y-auto space-y-3.5 pr-0.5">
          {orders.length === 0 ? (
            <div className="p-8 text-center bg-stone-50 rounded-2xl border border-stone-200">
              <History size={36} className="mx-auto mb-2 text-stone-300" />
              <h3 className="text-sm font-bold text-stone-700">No orders placed yet</h3>
              <p className="text-xs text-stone-400 mt-1 max-w-xs mx-auto">
                Explore the menu and add dishes to your cart. Once placed, you can monitor kitchen status and manage orders here.
              </p>
            </div>
          ) : (
            orders.map((order) => {
              const isPlaced = order.status === 'placed'
              const isCancelled = order.status === 'cancelled'
              const isServed = order.status === 'served'
              const canDelete = isCancelled || isServed

              return (
                <div
                  key={order.id}
                  className={`p-4 rounded-2xl border transition-all ${
                    isCancelled
                      ? 'bg-stone-50/70 border-stone-200 opacity-80'
                      : isPlaced
                      ? 'bg-amber-50/30 border-amber-200/80 shadow-xs ring-1 ring-amber-400/20'
                      : 'bg-white border-stone-200 shadow-2xs'
                  }`}
                >
                  {/* Top order summary */}
                  <div className="flex items-start justify-between gap-2 mb-2.5">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-sm text-stone-900">
                          Order #{order.order_number}
                        </span>
                        {formatOrderTime(order.created_at) && (
                          <span className="text-[11px] text-stone-400">
                            • {formatOrderTime(order.created_at)}
                          </span>
                        )}
                      </div>
                      {order.customer_name && (
                        <span className="text-[11px] text-stone-500 block">
                          By: {order.customer_name}
                        </span>
                      )}
                    </div>
                    <div>{getStatusBadge(order.status)}</div>
                  </div>

                  {/* Items list */}
                  <div className="space-y-1.5 py-2 border-y border-stone-100 my-2 text-xs">
                    {order.order_items?.map((item, idx) => (
                      <div key={item.id || idx} className="flex justify-between items-center text-stone-700">
                        <span className="font-medium">
                          <span className="font-bold text-stone-900">{item.quantity}×</span>{' '}
                          {item.item_name}
                        </span>
                        <span className="font-semibold text-stone-900 font-mono">
                          {formatCurrency(Number(item.price ?? item.item_price ?? 0) * item.quantity)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Pricing row */}
                  <div className="flex justify-between items-center text-xs pt-1">
                    <span className="text-stone-500 font-medium">Order Total:</span>
                    <span className="font-black text-stone-900 text-sm font-mono">
                      {formatCurrency(order.total)}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between gap-2 mt-3 pt-2.5 border-t border-stone-100">
                    {/* Cancellation / Deletion */}
                    <div>
                      {isPlaced && (
                        <button
                          type="button"
                          onClick={() => handleCancelClick(order)}
                          disabled={cancellingId === order.id}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-rose-600 hover:bg-rose-50 border border-rose-200 transition-colors flex items-center gap-1.5"
                        >
                          <Trash2 size={13} />
                          <span>{cancellingId === order.id ? 'Cancelling...' : 'Cancel Order'}</span>
                        </button>
                      )}

                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => onDeleteOrder(order.id)}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-stone-500 hover:text-stone-800 hover:bg-stone-100 transition-colors flex items-center gap-1"
                          title="Delete from history view"
                        >
                          <Trash2 size={13} />
                          <span>Remove</span>
                        </button>
                      )}
                    </div>

                    {/* Track Live Status */}
                    {!isCancelled && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose()
                          navigate(`/menu/${restaurantSlug}/table/${tableToken}/order/${order.id}`)
                        }}
                        className="btn btn-primary h-8 px-3 rounded-lg text-xs font-bold flex items-center gap-1 shadow-2xs"
                      >
                        <span>Track Live</span>
                        <ArrowUpRight size={13} />
                      </button>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </BottomSheet>
  )
}

// Floating Cart Footer Bar
function FloatingCartBar() {
  const navigate = useNavigate()
  const cartItems = useCartStore(s => s.items)
  const restaurantSlug = useCartStore(s => s.restaurantSlug)
  const tableToken = useCartStore(s => s.tableToken)
  const total = cartItems.reduce((s, i) => s + i.price * i.quantity, 0)
  const count = cartItems.reduce((s, i) => s + i.quantity, 0)

  if (count === 0) return null

  return (
    <div className="fixed bottom-0 inset-x-0 z-40 p-4 pointer-events-none">
      <div className="max-w-lg mx-auto pointer-events-auto">
        <motion.div
          initial={{ y: 50, opacity: 0, scale: 0.95 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 50, opacity: 0 }}
          className="bg-gray-900 text-white p-3.5 pl-5 rounded-2xl shadow-2xl border border-white/10 flex items-center justify-between gap-3 backdrop-blur-xl"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[var(--color-accent)] flex items-center justify-center text-white font-bold flex-shrink-0 shadow-lg shadow-[var(--color-accent)]/30">
              <ShoppingCart size={18} />
            </div>
            <div className="min-w-0">
              <div className="text-xs text-gray-300 font-medium truncate">
                {count} {count === 1 ? 'dish' : 'dishes'} selected
              </div>
              <div className="text-base font-black tracking-tight text-white">
                {formatCurrency(total)}
              </div>
            </div>
          </div>

          <button
            onClick={() => navigate(`/menu/${restaurantSlug}/table/${tableToken}/cart`)}
            className="btn btn-primary h-11 px-5 rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg"
          >
            <span>View Order</span>
            <ChevronRight size={16} />
          </button>
        </motion.div>
      </div>
    </div>
  )
}

// Add/Quantity Stepper Button
function StepperButton({ item }: { item: MenuItem }) {
  const addItem = useCartStore(s => s.addItem)
  const updateQuantity = useCartStore(s => s.updateQuantity)
  const cartItems = useCartStore(s => s.items)
  const cartItem = cartItems.find(i => i.menuItemId === item.id)
  const quantity = cartItem?.quantity || 0

  const handleAdd = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!item.is_available) return
    addItem({
      menuItemId: item.id,
      name: item.name,
      price: item.price,
      quantity: 1,
      image_url: item.image_url,
      food_type: item.food_type,
    })
    toast.success(`${item.name} added!`, { duration: 1200, position: 'bottom-center' })
  }

  if (quantity > 0) {
    return (
      <div 
        className="flex items-center bg-[var(--color-accent)] text-white rounded-xl shadow-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => updateQuantity(item.id, quantity - 1)}
          className="w-8 h-8 flex items-center justify-center font-bold text-lg hover:bg-black/10 transition-colors"
          aria-label="Decrease quantity"
        >
          −
        </button>
        <span className="font-extrabold text-sm px-2 min-w-[24px] text-center select-none">
          {quantity}
        </span>
        <button
          onClick={handleAdd}
          className="w-8 h-8 flex items-center justify-center font-bold text-lg hover:bg-black/10 transition-colors"
          aria-label="Increase quantity"
        >
          +
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={handleAdd}
      disabled={!item.is_available}
      className={cn(
        'px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all flex items-center gap-1 shadow-2xs',
        item.is_available
          ? 'bg-orange-50 text-[var(--color-accent)] border border-orange-200 hover:bg-[var(--color-accent)] hover:text-white hover:border-[var(--color-accent)]'
          : 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed'
      )}
    >
      <span>ADD</span>
      <span className="text-base font-bold leading-none">+</span>
    </button>
  )
}

// Menu Item Card
function MenuItemCard({ 
  item, 
  onClick 
}: { 
  item: MenuItem
  onClick: () => void 
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileTap={{ scale: 0.985 }}
      onClick={onClick}
      className={cn(
        'p-4 bg-white rounded-2xl border border-[var(--color-border-subtle)] hover:border-orange-200 transition-all cursor-pointer shadow-2xs relative overflow-hidden flex gap-4',
        !item.is_available && 'opacity-60'
      )}
    >
      {/* Food Details (Left) */}
      <div className="flex-1 min-w-0 flex flex-col justify-between">
        <div>
          {/* Diet and Badges */}
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <FoodTypeIndicator type={item.food_type} />
            {item.is_recommended && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                <Star size={10} fill="currentColor" /> Chef's Pick
              </span>
            )}
          </div>

          <h3 className="font-bold text-gray-900 text-base leading-snug line-clamp-1">
            {item.name}
          </h3>

          {item.description && (
            <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">
              {item.description}
            </p>
          )}
        </div>

        {/* Pricing & Prep */}
        <div className="mt-3 flex items-center justify-between">
          <div>
            <div className="text-base font-black text-gray-950">
              {formatCurrency(item.price)}
            </div>
            {item.preparation_time && (
              <div className="text-[11px] text-gray-400 flex items-center gap-1 mt-0.5">
                <Clock size={11} /> {item.preparation_time} mins
              </div>
            )}
          </div>

          {/* Stepper Button (Mobile Action) */}
          <div onClick={(e) => e.stopPropagation()}>
            <StepperButton item={item} />
          </div>
        </div>
      </div>

      {/* Food Image (Right) */}
      <div className="w-28 h-28 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0 relative border border-gray-100 shadow-2xs">
        {item.image_url ? (
          <img 
            src={item.image_url} 
            alt={item.name} 
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
            loading="lazy" 
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-gray-300 bg-orange-50/40">
            <Utensils size={28} className="text-orange-300" />
            <span className="text-[10px] text-orange-400 font-bold mt-1">Freshly Made</span>
          </div>
        )}

        {!item.is_available && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px] flex items-center justify-center p-1 text-center">
            <span className="text-[10px] font-bold text-white uppercase tracking-wider bg-rose-600 px-2 py-0.5 rounded-full">
              Sold Out
            </span>
          </div>
        )}
      </div>
    </motion.div>
  )
}

// Item Customization / Detail Bottom Sheet
function ItemDetailSheet({
  item,
  open,
  onClose,
}: {
  item: MenuItem | null
  open: boolean
  onClose: () => void
}) {
  const [quantity, setQuantity] = useState(1)
  const [instructions, setInstructions] = useState('')
  const [spiceLevel, setSpiceLevel] = useState<'mild' | 'medium' | 'spicy'>('medium')
  const addItem = useCartStore(s => s.addItem)

  useEffect(() => {
    if (open) {
      setQuantity(1)
      setInstructions('')
      setSpiceLevel('medium')
    }
  }, [open])

  if (!item) return null

  const handleAdd = () => {
    const specialText = [
      `Spice: ${spiceLevel.toUpperCase()}`,
      instructions.trim()
    ].filter(Boolean).join(' • ')

    addItem({
      menuItemId: item.id,
      name: item.name,
      price: item.price,
      quantity,
      specialInstructions: specialText || undefined,
      image_url: item.image_url,
      food_type: item.food_type,
    })
    toast.success(`${quantity}× ${item.name} added!`, { position: 'bottom-center' })
    onClose()
  }

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="pb-6">
        {/* Cover Food Photo */}
        {item.image_url && (
          <div className="h-56 -mx-4 -mt-4 relative overflow-hidden bg-gray-900">
            <img 
              src={item.image_url} 
              alt={item.name} 
              className="w-full h-full object-cover" 
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            <button
              onClick={onClose}
              className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/50 text-white flex items-center justify-center backdrop-blur-md"
            >
              <X size={18} />
            </button>
            <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between text-white">
              <span className="text-xl font-black">{formatCurrency(item.price)}</span>
              {item.preparation_time && (
                <span className="text-xs bg-white/20 backdrop-blur-md px-2.5 py-1 rounded-full font-semibold flex items-center gap-1">
                  <Clock size={12} /> {item.preparation_time} mins
                </span>
              )}
            </div>
          </div>
        )}

        <div className="px-1 pt-4 space-y-5">
          {/* Header */}
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <FoodTypeIndicator type={item.food_type} />
              {item.is_recommended && (
                <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 flex items-center gap-1">
                  <Star size={11} fill="currentColor" /> Chef's Signature
                </span>
              )}
            </div>
            <h2 className="text-xl font-black text-gray-900">{item.name}</h2>
            {item.description && (
              <p className="text-xs text-gray-600 mt-1.5 leading-relaxed">{item.description}</p>
            )}
          </div>

          {/* Spice Level Selector */}
          <div>
            <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block mb-2">
              Spice Preference
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { key: 'mild', label: 'Mild', icon: '🌿' },
                { key: 'medium', label: 'Medium', icon: '🌶️' },
                { key: 'spicy', label: 'Spicy', icon: '🔥' },
              ].map(sp => (
                <button
                  key={sp.key}
                  type="button"
                  onClick={() => setSpiceLevel(sp.key as any)}
                  className={cn(
                    'py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5',
                    spiceLevel === sp.key
                      ? 'bg-orange-50 border-[var(--color-accent)] text-[var(--color-accent)] ring-1 ring-[var(--color-accent)] shadow-2xs'
                      : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                  )}
                >
                  <span>{sp.icon}</span>
                  <span className="capitalize">{sp.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Cooking Instructions */}
          <div>
            <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block mb-1.5">
              Special Instructions
            </label>
            <textarea
              className="input resize-none h-18 text-xs w-full bg-gray-50 focus:bg-white"
              placeholder="e.g. Less oil, extra chutney, well done..."
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
            />
          </div>

          {/* Quantity & Add Action */}
          <div className="flex items-center gap-3 pt-2">
            <div className="flex items-center bg-gray-100 rounded-xl p-1 border border-gray-200">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="w-10 h-10 rounded-lg bg-white shadow-2xs flex items-center justify-center font-black text-gray-800 hover:bg-gray-50"
              >
                −
              </button>
              <span className="w-10 text-center font-black text-base text-gray-900">{quantity}</span>
              <button
                onClick={() => setQuantity(quantity + 1)}
                className="w-10 h-10 rounded-lg bg-white shadow-2xs flex items-center justify-center font-black text-[var(--color-accent)] hover:bg-gray-50"
              >
                +
              </button>
            </div>

            <button
              onClick={handleAdd}
              disabled={!item.is_available}
              className="flex-1 btn btn-primary h-12 rounded-xl text-sm font-bold shadow-lg"
            >
              Add {quantity} to Order • {formatCurrency(item.price * quantity)}
            </button>
          </div>
        </div>
      </div>
    </BottomSheet>
  )
}

export function MenuPage() {
  const { restaurantSlug, tableToken } = useParams<{ restaurantSlug: string; tableToken: string }>()
  const setTableContext = useCartStore(s => s.setTableContext)

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [table, setTable] = useState<Table | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [dietFilter, setDietFilter] = useState<'all' | 'veg' | 'non-veg' | 'recommended'>('all')

  // Selected item modal
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null)
  const [itemSheetOpen, setItemSheetOpen] = useState(false)

  // Orders history
  const [orders, setOrders] = useState<Order[]>([])
  const [ordersSheetOpen, setOrdersSheetOpen] = useState(false)

  useEffect(() => {
    const slug = restaurantSlug || 'samravaa'
    const token = tableToken || 'samravaa-t01'

    const load = async () => {
      setLoading(true)

      // Fetch restaurant
      const rest = await restaurantService.getBySlug(slug)
      if (!rest) {
        setError('Restaurant menu not found.')
        setLoading(false)
        return
      }

      // Fetch table
      let tbl = await tableService.getByToken(token)
      if (!tbl) {
        // Fallback: look up first active table
        const allTables = await tableService.getByRestaurant(rest.id)
        tbl = allTables[0] || null
      }

      // Load active categories and menu items
      const [cats, items] = await Promise.all([
        categoryService.getActive(rest.id),
        menuItemService.getByRestaurant(rest.id),
      ])

      setRestaurant(rest)
      setTable(tbl)
      setCategories(cats)
      setMenuItems(items)

      if (tbl) {
        setTableContext({
          restaurantId: rest.id,
          tableId: tbl.id,
          tableToken: tbl.qr_token,
          restaurantSlug: rest.slug,
          tableNumber: tbl.table_number,
        })

        // Fetch session orders for this table
        try {
          const tblOrders = await orderService.getAllByTable(tbl.id)
          setOrders(tblOrders)
        } catch (err) {
          console.error('Error fetching table orders:', err)
        }
      }

      setLoading(false)
    }

    load()
  }, [restaurantSlug, tableToken])

  // Realtime subscription for customer's table orders
  useEffect(() => {
    if (!table?.id) return
    const channel = supabase
      .channel(`customer-table-orders-${table.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `table_id=eq.${table.id}` },
        async () => {
          const fresh = await orderService.getAllByTable(table.id)
          setOrders(fresh)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [table?.id])

  const handleCancelOrder = async (order: Order) => {
    const { error } = await orderService.cancelOrder(order.id, 'Cancelled by customer')
    if (error) {
      toast.error('Could not cancel order. Please inform restaurant staff.')
    } else {
      toast.success(`Order #${order.order_number} cancelled`)
      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: 'cancelled' } : o))
    }
  }

  const handleDeleteOrder = async (orderId: string) => {
    if (!window.confirm('Delete this order from your history?')) return
    await orderService.deleteOrder(orderId)
    setOrders(prev => prev.filter(o => o.id !== orderId))
    try {
      const key = `customer_orders_${table?.id}`
      const existing = JSON.parse(localStorage.getItem(key) || '[]')
      const updated = existing.filter((id: string) => id !== orderId)
      localStorage.setItem(key, JSON.stringify(updated))
    } catch {}
    toast.success('Order deleted from history')
  }

  const activeOrders = useMemo(() => {
    return orders.filter(o => ['placed', 'accepted', 'preparing', 'ready'].includes(o.status))
  }, [orders])

  const latestActiveOrder = activeOrders[0] || null

  // Filter items
  const filteredItems = useMemo(() => {
    return menuItems.filter(item => {
      // Search
      const matchSearch = search.trim()
        ? item.name.toLowerCase().includes(search.toLowerCase()) ||
          (item.description && item.description.toLowerCase().includes(search.toLowerCase()))
        : true

      // Category
      const matchCategory = activeCategory === 'all'
        ? true
        : item.category_id === activeCategory

      // Dietary filter
      const matchDiet = 
        dietFilter === 'all' ? true :
        dietFilter === 'veg' ? item.food_type === 'veg' :
        dietFilter === 'non-veg' ? item.food_type === 'non-veg' :
        dietFilter === 'recommended' ? item.is_recommended : true

      return matchSearch && matchCategory && matchDiet && (item.is_available || restaurant?.show_sold_out_items)
    })
  }, [menuItems, search, activeCategory, dietFilter, restaurant?.show_sold_out_items])

  // Group items by category for "all" view
  const categoryGroups = useMemo(() => {
    if (activeCategory !== 'all') {
      const currentCat = categories.find(c => c.id === activeCategory)
      return currentCat ? [{ category: currentCat, items: filteredItems }] : []
    }

    return categories.map(cat => ({
      category: cat,
      items: filteredItems.filter(i => i.category_id === cat.id)
    })).filter(g => g.items.length > 0)
  }, [categories, filteredItems, activeCategory])

  const handleCallWaiter = () => {
    toast.success(`Server notified for Table ${table?.table_number || ''}!`, {
      icon: '🛎️',
      duration: 3000,
    })
  }

  const handleRequestWater = () => {
    toast.success(`Water requested for Table ${table?.table_number || ''}!`, {
      icon: '💧',
      duration: 3000,
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-background)] max-w-lg mx-auto p-4 space-y-4">
        <div className="h-44 rounded-3xl bg-gray-200 skeleton" />
        <div className="h-10 rounded-xl bg-gray-200 skeleton" />
        <div className="space-y-3 pt-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 rounded-2xl bg-gray-200 skeleton" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-background)] p-6">
        <div className="text-center max-w-sm card p-8 shadow-xl">
          <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertCircle size={32} />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">QR Code Not Found</h1>
          <p className="text-gray-500 text-sm mb-6">{error}</p>
          <a href="/admin/login" className="btn btn-primary w-full">
            Open Admin Panel
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#faf9f6] text-gray-900 pb-28">
      {/* Mobile-Optimized Container */}
      <div className="max-w-lg mx-auto">
        {/* Luxury Restaurant Hero Header */}
        <div className="relative bg-gradient-to-br from-gray-950 via-gray-900 to-amber-950 text-white p-6 pt-8 pb-7 rounded-b-[36px] shadow-xl overflow-hidden">
          {/* Subtle Ambient Light Effect */}
          <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-orange-500/20 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />

          {/* Top Bar with Table Badge and Assistance */}
          <div className="flex items-center justify-between gap-2 mb-4 relative z-10">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/15">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-black tracking-wide uppercase text-white">
                Table {table?.table_number || '01'}
              </span>
              <span className="text-white/40 text-[10px]">•</span>
              <span className="text-[11px] text-white/80 font-medium">
                {table?.section || 'Dine-In'}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setOrdersSheetOpen(true)}
                className="h-8 px-2.5 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center gap-1.5 backdrop-blur-md transition-all border border-white/20 relative"
                title="My Orders History"
              >
                <Receipt size={13} />
                <span className="text-xs font-bold">Orders</span>
                {orders.length > 0 && (
                  <span className="w-4 h-4 rounded-full bg-[var(--color-accent)] text-white text-[10px] font-black flex items-center justify-center">
                    {orders.length}
                  </span>
                )}
                {activeOrders.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                )}
              </button>

              <button
                onClick={handleCallWaiter}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center backdrop-blur-md transition-colors"
                title="Call Waiter"
              >
                <Bell size={14} />
              </button>
              <button
                onClick={handleRequestWater}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center backdrop-blur-md transition-colors"
                title="Request Water"
              >
                <Droplets size={14} />
              </button>
            </div>
          </div>

          {/* Restaurant Title & Subtitle */}
          <div className="relative z-10">
            <div className="flex items-center gap-2.5">
              <h1 
                className="text-2xl sm:text-3xl font-black tracking-tight font-sans drop-shadow-md select-none"
                style={{ color: '#ffffff', textShadow: '0 2px 8px rgba(0,0,0,0.5)' }}
              >
                {restaurant?.name || 'Deccan CRM'}
              </h1>
              <span className="w-5 h-5 rounded-full bg-[var(--color-accent)] flex items-center justify-center text-white text-[11px] font-bold shadow-sm shadow-orange-500/50 flex-shrink-0">
                ✓
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs mt-1.5 font-medium flex-wrap" style={{ color: 'rgba(255, 255, 255, 0.9)' }}>
              <span className="flex items-center gap-1 text-amber-300 font-bold bg-black/25 px-2 py-0.5 rounded-md backdrop-blur-xs">
                <Star size={12} fill="currentColor" /> 4.9 (500+ reviews)
              </span>
              <span className="text-white/40">•</span>
              <span className="flex items-center gap-1 text-white/90">
                <MapPin size={12} className="text-orange-400" />
                {restaurant?.address?.split(',')[0] || 'Hyderabad'}
              </span>
            </div>
          </div>

          {/* Search Input Box */}
          <div className="mt-5 relative z-10">
            <div className="relative">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search favorite dishes, flavors, drinks..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-11 pl-10 pr-9 rounded-2xl bg-white/95 text-gray-900 placeholder:text-gray-400 text-xs font-medium border-0 focus:ring-2 focus:ring-orange-400 shadow-inner"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                >
                  <X size={15} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Active In-Progress Order Alert Banner */}
        {latestActiveOrder && (
          <div className="px-4 pt-3 pb-1">
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => setOrdersSheetOpen(true)}
              className="p-3 bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10 border border-amber-300/70 rounded-2xl flex items-center justify-between gap-3 cursor-pointer hover:bg-amber-500/15 transition-all shadow-xs"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0 font-bold">
                  {latestActiveOrder.status === 'placed' ? (
                    <Clock size={16} className="text-amber-600 animate-spin" />
                  ) : latestActiveOrder.status === 'preparing' ? (
                    <ChefHat size={16} className="text-orange-600 animate-pulse" />
                  ) : (
                    <Sparkles size={16} className="text-emerald-600" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-stone-900 truncate flex items-center gap-1.5">
                    <span>Order #{latestActiveOrder.order_number}</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-amber-200/80 text-amber-900 capitalize">
                      {latestActiveOrder.status}
                    </span>
                  </div>
                  <div className="text-[11px] text-stone-600 truncate">
                    {latestActiveOrder.order_items?.map(i => `${i.quantity}× ${i.item_name}`).join(', ')}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 text-xs font-bold text-[var(--color-accent)] flex-shrink-0">
                <span>View & Manage</span>
                <ChevronRight size={14} />
              </div>
            </motion.div>
          </div>
        )}

        {/* Dietary Filters Pill Strip */}
        <div className="px-4 py-3 flex items-center gap-2 overflow-x-auto no-scrollbar">
          {[
            { id: 'all', label: 'All Items', icon: null },
            { id: 'veg', label: 'Pure Veg', icon: '🌱' },
            { id: 'non-veg', label: 'Non-Veg', icon: '🍗' },
            { id: 'recommended', label: "Chef's Specials", icon: '⭐' },
          ].map((pill) => (
            <button
              key={pill.id}
              onClick={() => setDietFilter(pill.id as any)}
              className={cn(
                'px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 shadow-2xs',
                dietFilter === pill.id
                  ? 'bg-gray-900 text-white shadow-sm'
                  : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
              )}
            >
              {pill.icon && <span>{pill.icon}</span>}
              <span>{pill.label}</span>
            </button>
          ))}
        </div>

        {/* Sticky Category Tabs Strip */}
        <div className="sticky top-0 z-30 bg-[#faf9f6]/95 backdrop-blur-md px-4 py-2 border-b border-gray-200/80 shadow-2xs">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setActiveCategory('all')}
              className={cn(
                'px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5',
                activeCategory === 'all'
                  ? 'bg-[var(--color-accent)] text-white shadow-md shadow-[var(--color-accent)]/20'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
              )}
            >
              <Sparkles size={13} />
              <span>Full Menu ({filteredItems.length})</span>
            </button>

            {categories.map((cat) => {
              const count = menuItems.filter(i => i.category_id === cat.id).length
              const isSelected = activeCategory === cat.id
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={cn(
                    'px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5',
                    isSelected
                      ? 'bg-[var(--color-accent)] text-white shadow-md shadow-[var(--color-accent)]/20'
                      : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
                  )}
                >
                  <span>{cat.name}</span>
                  <span className={cn(
                    'text-[10px] px-1.5 py-0.2 rounded-full font-bold',
                    isSelected ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                  )}>
                    {count}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Menu Items List by Category */}
        <div className="px-4 py-4 space-y-6">
          {categoryGroups.length === 0 ? (
            <div className="card p-10 text-center bg-white border border-gray-200">
              <div className="w-14 h-14 bg-orange-50 text-[var(--color-accent)] rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Search size={24} />
              </div>
              <h3 className="font-bold text-gray-900 text-base">No dishes found</h3>
              <p className="text-xs text-gray-500 mt-1">
                Try searching for something else or clearing your filters.
              </p>
              <button
                onClick={() => {
                  setSearch('')
                  setActiveCategory('all')
                  setDietFilter('all')
                }}
                className="btn btn-secondary btn-sm mt-4 mx-auto"
              >
                Clear Filters
              </button>
            </div>
          ) : (
            categoryGroups.map((group) => (
              <div key={group.category.id} className="space-y-3">
                {/* Category Header */}
                <div className="flex items-baseline justify-between pt-1">
                  <div>
                    <h2 className="text-base font-black text-gray-900 tracking-tight">
                      {group.category.name}
                    </h2>
                    {group.category.description && (
                      <p className="text-[11px] text-gray-500 font-medium">
                        {group.category.description}
                      </p>
                    )}
                  </div>
                  <span className="text-xs font-bold text-gray-400">
                    {group.items.length} items
                  </span>
                </div>

                {/* Dish Cards */}
                <div className="space-y-3">
                  {group.items.map((item) => (
                    <MenuItemCard
                      key={item.id}
                      item={item}
                      onClick={() => {
                        setSelectedItem(item)
                        setItemSheetOpen(true)
                      }}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Item Customization Bottom Sheet */}
      <ItemDetailSheet
        item={selectedItem}
        open={itemSheetOpen}
        onClose={() => {
          setItemSheetOpen(false)
          setSelectedItem(null)
        }}
      />

      {/* Orders History & Deletion Sheet */}
      <OrdersHistorySheet
        open={ordersSheetOpen}
        onClose={() => setOrdersSheetOpen(false)}
        orders={orders}
        onCancelOrder={handleCancelOrder}
        onDeleteOrder={handleDeleteOrder}
        restaurantSlug={restaurantSlug || 'samravaa'}
        tableToken={tableToken || 'samravaa-t01'}
        tableNumber={table?.table_number}
      />

      {/* Floating Bottom Cart Bar */}
      <FloatingCartBar />
    </div>
  )
}
