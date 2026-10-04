import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CartItem } from '@/types/database'

interface CartState {
  items: CartItem[]
  restaurantId: string | null
  tableId: string | null
  tableToken: string | null
  restaurantSlug: string | null
  tableNumber: string | null

  addItem: (item: CartItem) => void
  removeItem: (menuItemId: string) => void
  updateQuantity: (menuItemId: string, quantity: number) => void
  updateInstructions: (menuItemId: string, instructions: string) => void
  clearCart: () => void
  setTableContext: (ctx: {
    restaurantId: string
    tableId: string
    tableToken: string
    restaurantSlug: string
    tableNumber: string
  }) => void
}

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      restaurantId: null,
      tableId: null,
      tableToken: null,
      restaurantSlug: null,
      tableNumber: null,

      addItem: (newItem) => {
        set((state) => {
          const existing = state.items.find(i => i.menuItemId === newItem.menuItemId)
          if (existing) {
            return {
              items: state.items.map(i =>
                i.menuItemId === newItem.menuItemId
                  ? { ...i, quantity: i.quantity + newItem.quantity }
                  : i
              ),
            }
          }
          return { items: [...state.items, newItem] }
        })
      },

      removeItem: (menuItemId) => {
        set((state) => ({
          items: state.items.filter(i => i.menuItemId !== menuItemId),
        }))
      },

      updateQuantity: (menuItemId, quantity) => {
        set((state) => {
          if (quantity <= 0) {
            return { items: state.items.filter(i => i.menuItemId !== menuItemId) }
          }
          return {
            items: state.items.map(i =>
              i.menuItemId === menuItemId ? { ...i, quantity } : i
            ),
          }
        })
      },

      updateInstructions: (menuItemId, instructions) => {
        set((state) => ({
          items: state.items.map(i =>
            i.menuItemId === menuItemId ? { ...i, specialInstructions: instructions } : i
          ),
        }))
      },

      clearCart: () => {
        set({ items: [] })
      },

      setTableContext: (ctx) => {
        set({
          restaurantId: ctx.restaurantId,
          tableId: ctx.tableId,
          tableToken: ctx.tableToken,
          restaurantSlug: ctx.restaurantSlug,
          tableNumber: ctx.tableNumber,
        })
      },
    }),
    {
      name: 'deccan_cart_storage',
    }
  )
)
