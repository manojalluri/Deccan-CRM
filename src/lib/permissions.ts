import type { StaffRole } from '@/types/database'

export type AppPermission =
  | 'view_dashboard'
  | 'view_orders'
  | 'manage_order_status'
  | 'generate_bill'
  | 'view_billing'
  | 'view_menu'
  | 'manage_menu'
  | 'toggle_item_stock'
  | 'manage_categories'
  | 'view_tables'
  | 'manage_tables'
  | 'view_staff'
  | 'manage_staff'
  | 'view_analytics'
  | 'manage_settings'

export const ROLE_PERMISSIONS: Record<StaffRole, AppPermission[]> = {
  owner: [
    'view_dashboard', 'view_orders', 'manage_order_status', 'generate_bill',
    'view_billing', 'view_menu', 'manage_menu', 'toggle_item_stock',
    'manage_categories', 'view_tables', 'manage_tables', 'view_staff',
    'manage_staff', 'view_analytics', 'manage_settings',
  ],
  admin: [
    'view_dashboard', 'view_orders', 'manage_order_status', 'generate_bill',
    'view_billing', 'view_menu', 'manage_menu', 'toggle_item_stock',
    'manage_categories', 'view_tables', 'manage_tables', 'view_staff',
    'manage_staff', 'view_analytics', 'manage_settings',
  ],
  manager: [
    'view_dashboard', 'view_orders', 'manage_order_status', 'generate_bill',
    'view_billing', 'view_menu', 'manage_menu', 'toggle_item_stock',
    'manage_categories', 'view_tables', 'manage_tables', 'view_staff',
    'manage_staff', 'view_analytics',
  ],
  staff: [
    'view_orders', 'manage_order_status', 'generate_bill',
    'view_billing', 'view_menu', 'toggle_item_stock', 'view_tables',
  ],
  kitchen: [
    'view_orders', 'manage_order_status', 'view_menu', 'toggle_item_stock',
  ],
}

export const ROLE_METADATA: Record<StaffRole, {
  label: string
  badgeClass: string
  icon: string
  description: string
}> = {
  owner: {
    label: 'Owner',
    badgeClass: 'bg-purple-100 text-purple-800 border-purple-200',
    icon: '👑',
    description: 'Full restaurant ownership & settings',
  },
  admin: {
    label: 'Admin',
    badgeClass: 'bg-orange-100 text-orange-800 border-orange-200',
    icon: '🛡️',
    description: 'System administration & configuration',
  },
  manager: {
    label: 'Manager',
    badgeClass: 'bg-blue-100 text-blue-800 border-blue-200',
    icon: '👔',
    description: 'Day-to-day operations & staff supervisor',
  },
  staff: {
    label: 'Staff / Waiter',
    badgeClass: 'bg-teal-100 text-teal-800 border-teal-200',
    icon: '🛎️',
    description: 'Table service, ordering & cashier bills',
  },
  kitchen: {
    label: 'Kitchen Chef',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
    icon: '👨‍🍳',
    description: 'Kitchen display, cooking & stock availability',
  },
}

export function hasPermission(role: StaffRole | undefined | null, permission: AppPermission): boolean {
  if (!role) return false
  const permissions = ROLE_PERMISSIONS[role] || []
  return permissions.includes(permission)
}

export function isRouteAllowed(role: StaffRole | undefined | null, pathname: string): boolean {
  if (!role) return false
  if (role === 'owner' || role === 'admin') return true

  const cleanPath = pathname.replace(/^\/admin\/?/, '').split('/')[0] || ''

  switch (cleanPath) {
    case '':
    case 'dashboard':
      return hasPermission(role, 'view_dashboard')
    case 'orders':
      return hasPermission(role, 'view_orders')
    case 'billing':
      return hasPermission(role, 'view_billing')
    case 'menu':
      return hasPermission(role, 'view_menu')
    case 'categories':
      return hasPermission(role, 'manage_categories')
    case 'tables':
      return hasPermission(role, 'view_tables')
    case 'staff':
      return hasPermission(role, 'view_staff')
    case 'analytics':
      return hasPermission(role, 'view_analytics')
    case 'settings':
      return hasPermission(role, 'manage_settings')
    default:
      return true
  }
}

export function getDefaultRouteForRole(role: StaffRole | undefined | null): string {
  switch (role) {
    case 'kitchen':
      return '/admin/orders'
    case 'staff':
      return '/admin/orders'
    case 'manager':
    case 'admin':
    case 'owner':
    default:
      return '/admin/dashboard'
  }
}
