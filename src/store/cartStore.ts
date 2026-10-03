import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
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

  get totalItems(): number
  get subtotal(): number
}

export const useCartStore = create<CartState>()(
  persist(
    immer((set, get) => ({
    items: [],
    restaurantId: null,
    tableId: null,
    tableToken: null,
    restaurantSlug: null,
    tableNumber: null,

    get totalItems() {
      return get().items.reduce((sum, item) => sum + item.quantity, 0)
    },

    get subtotal() {
      return get().items.reduce((sum, item) => sum + item.price * item.quantity, 0)
    },

    addItem: (newItem) => {
      set((state) => {
        const existing = state.items.find(i => i.menuItemId === newItem.menuItemId)
        if (existing) {
          existing.quantity += newItem.quantity
        } else {
          state.items.push(newItem)
        }
      })
    },

    removeItem: (menuItemId) => {
      set((state) => {
        state.items = state.items.filter(i => i.menuItemId !== menuItemId)
      })
    },

    updateQuantity: (menuItemId, quantity) => {
      set((state) => {
        if (quantity <= 0) {
          state.items = state.items.filter(i => i.menuItemId !== menuItemId)
        } else {
          const item = state.items.find(i => i.menuItemId === menuItemId)
          if (item) item.quantity = quantity
        }
      })
    },

    updateInstructions: (menuItemId, instructions) => {
      set((state) => {
        const item = state.items.find(i => i.menuItemId === menuItemId)
        if (item) item.specialInstructions = instructions
      })
    },

    clearCart: () => {
      set((state) => {
        state.items = []
      })
    },

    setTableContext: (ctx) => {
      set((state) => {
        state.restaurantId = ctx.restaurantId
        state.tableId = ctx.tableId
        state.tableToken = ctx.tableToken
        state.restaurantSlug = ctx.restaurantSlug
        state.tableNumber = ctx.tableNumber
      })
    },
  })),
  {
    name: 'deccan_cart_storage',
  }
))
