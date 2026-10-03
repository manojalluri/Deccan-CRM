import React, { useState, useEffect } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, ShoppingBag, Receipt, UtensilsCrossed, Tag, Grid3X3,
  Users, BarChart3, Settings, LogOut, Menu,
  Bell, Search, ChefHat, Sparkles, Volume2
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { playAdminNewOrderSound } from '@/lib/soundEffects'
import { cn, getInitials } from '@/lib/utils'
import { isRouteAllowed, ROLE_METADATA, hasPermission } from '@/lib/permissions'
import toast from 'react-hot-toast'

const navItems = [
  { to: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/admin/orders', icon: ShoppingBag, label: 'Orders' },
  { to: '/admin/billing', icon: Receipt, label: 'Billing' },
  { to: '/admin/menu', icon: UtensilsCrossed, label: 'Menu' },
  { to: '/admin/categories', icon: Tag, label: 'Categories' },
  { to: '/admin/tables', icon: Grid3X3, label: 'Tables' },
  { to: '/admin/staff', icon: Users, label: 'Staff' },
  { to: '/admin/analytics', icon: BarChart3, label: 'Analytics' },
  { to: '/admin/settings', icon: Settings, label: 'Settings' },
]

interface AdminLayoutProps {
  children: React.ReactNode
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const userRole = profile?.role || 'admin'
  const roleMeta = ROLE_METADATA[userRole] || ROLE_METADATA.admin
  const visibleNavItems = navItems.filter(item => isRouteAllowed(userRole, item.to))

  // Global Realtime Order Sound Alert
  useEffect(() => {
    if (!profile?.restaurant_id) return

    const channel = supabase
      .channel('admin-global-order-sound')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders',
          filter: `restaurant_id=eq.${profile.restaurant_id}`,
        },
        (payload) => {
          // Play the kitchen service bell chime
          playAdminNewOrderSound()

          // Show prominent toast notification
          toast.success(
            `🛎️ New Order Received! (Table ${payload.new.table_id ? 'Dine-In' : ''})`,
            {
              duration: 7000,
              position: 'top-right',
            }
          )
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [profile?.restaurant_id])

  const handleSignOut = async () => {
    await signOut()
    toast.success('Signed out successfully')
    navigate('/admin/login')
  }

  const handleTestSound = () => {
    playAdminNewOrderSound()
    toast.success('Order Alert Bell Tested!', {
      icon: '🔔',
      duration: 2500,
    })
  }

  // Active page title helper
  const currentNavItem = navItems.find(item => location.pathname.startsWith(item.to))

  return (
    <div className="admin-layout">
      {/* Mobile Overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="sidebar-overlay md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={cn('admin-sidebar', sidebarOpen && 'open')}>
        {/* Brand Header — Matches Topbar Height (h-16 / 64px) for perfect alignment */}
        <div className="h-16 px-5 flex items-center gap-3 border-b border-[var(--color-border)] flex-shrink-0 bg-[var(--color-surface)]">
          <div className="w-9 h-9 bg-[var(--color-accent)] rounded-xl flex items-center justify-center shadow-xs flex-shrink-0">
            <ChefHat size={19} className="text-white" strokeWidth={2} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-bold text-[var(--color-text-primary)] text-[15px] leading-tight tracking-tight">
              Deccan CRM
            </div>
            <div className="text-[10px] text-[var(--color-text-tertiary)] font-semibold tracking-wider uppercase mt-0.5">
              Restaurant OS
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {visibleNavItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) => cn(
                'group flex items-center gap-3 px-3.5 h-[42px] rounded-xl text-sm font-medium transition-all duration-150',
                isActive
                  ? 'bg-[var(--color-accent-light)] text-[var(--color-accent)] font-semibold border border-[var(--color-accent-subtle)]/70 shadow-xs'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-text-primary)] border border-transparent'
              )}
            >
              {({ isActive }) => (
                <>
                  <Icon
                    size={18}
                    strokeWidth={isActive ? 2.2 : 1.8}
                    className={cn(
                      'flex-shrink-0 transition-colors',
                      isActive ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)]'
                    )}
                  />
                  <span className="truncate">{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User Profile at bottom of sidebar */}
        <div className="p-3 border-t border-[var(--color-border)] bg-[var(--color-surface)] flex-shrink-0">
          <div className="flex items-center gap-3 p-2.5 rounded-xl bg-[var(--color-surface-subtle)] border border-[var(--color-border)]">
            <div className="w-8 h-8 bg-[var(--color-accent-subtle)] rounded-lg flex items-center justify-center text-xs font-bold text-[var(--color-accent-hover)] flex-shrink-0">
              {getInitials(profile?.name || 'Staff')}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-[var(--color-text-primary)] truncate leading-tight">
                {profile?.name || 'Staff Member'}
              </div>
              <div className="flex items-center gap-1 mt-1">
                <span className={cn('text-[10px] font-bold px-1.5 py-0.2 rounded-md border flex items-center gap-1', roleMeta.badgeClass)}>
                  <span>{roleMeta.icon}</span>
                  <span>{roleMeta.label}</span>
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="w-full mt-2 flex items-center justify-center gap-2 h-9 rounded-xl text-xs font-medium text-[var(--color-text-secondary)] hover:bg-red-50 hover:text-red-600 transition-colors border border-transparent hover:border-red-200"
          >
            <LogOut size={14} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="admin-main flex-1 md:ml-[260px] flex flex-col min-h-screen min-w-0">
        {/* Topbar Header */}
        <header className="admin-topbar">
          {/* Mobile hamburger */}
          <button
            className="btn btn-ghost btn-icon-sm md:hidden"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>

          {/* Left Context / Current Section */}
          <div className="hidden sm:flex items-center gap-2 text-sm">
            <span className="text-[var(--color-text-tertiary)] font-medium">Deccan CRM</span>
            <span className="text-[var(--color-border-hover)]">/</span>
            <span className="text-[var(--color-text-primary)] font-semibold">
              {currentNavItem?.label || 'Overview'}
            </span>
            <div className="ml-3 hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200/80 text-[11px] font-semibold text-emerald-700">
              <span className="status-dot status-dot-green" />
              Live System
            </div>
          </div>

          <div className="flex-1" />

          {/* Search Bar */}
          <div className="relative hidden md:flex items-center w-72 lg:w-80">
            <Search size={15} className="absolute left-3.5 text-[var(--color-text-tertiary)] pointer-events-none" />
            <input
              type="text"
              placeholder="Search orders, menu, tables..."
              className="w-full h-9 pl-9 pr-3.5 text-xs bg-[var(--color-surface-subtle)] border border-[var(--color-border)] rounded-xl outline-none text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent-ring)] transition-all"
            />
          </div>

          {/* Sound Alert Bell Test */}
          <button
            onClick={handleTestSound}
            className="btn btn-ghost btn-sm h-8 px-2.5 rounded-xl text-xs font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] hover:bg-[var(--color-accent-light)] flex items-center gap-1.5 transition-colors"
            title="Click to Test Kitchen Order Alert Chime"
          >
            <Volume2 size={15} className="text-[var(--color-accent)]" />
            <span className="hidden xl:inline text-[11px]">Order Bell</span>
          </button>

          {/* Notifications */}
          <button
            className="btn btn-ghost btn-icon-sm relative text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            aria-label="Notifications"
          >
            <Bell size={17} strokeWidth={1.8} />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[var(--color-accent)] rounded-full ring-2 ring-white" />
          </button>

          {/* Profile Avatar Dropdown */}
          <div className="relative">
            <button
              onClick={() => setProfileMenuOpen(!profileMenuOpen)}
              className="w-8 h-8 bg-[var(--color-accent-subtle)] rounded-xl flex items-center justify-center text-xs font-bold text-[var(--color-accent-hover)] hover:ring-2 hover:ring-[var(--color-accent)] hover:ring-offset-1 transition-all"
              aria-expanded={profileMenuOpen}
              aria-label="User profile menu"
            >
              {getInitials(profile?.name || 'A')}
            </button>

            <AnimatePresence>
              {profileMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setProfileMenuOpen(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.96 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full mt-2 w-60 bg-[var(--color-surface)] rounded-2xl shadow-[var(--shadow-dropdown)] border border-[var(--color-border)] z-50 overflow-hidden"
                  >
                    <div className="p-3.5 border-b border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)]">
                      <div className="font-semibold text-xs text-[var(--color-text-primary)] truncate">
                        {profile?.name || 'Staff Member'}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className={cn('text-[10px] font-bold px-1.5 py-0.2 rounded-md border flex items-center gap-1', roleMeta.badgeClass)}>
                          <span>{roleMeta.icon}</span>
                          <span>{roleMeta.label}</span>
                        </span>
                      </div>
                    </div>
                    <div className="p-1.5 space-y-0.5">
                      {hasPermission(profile?.role, 'view_staff') && (
                        <NavLink
                          to="/admin/staff"
                          onClick={() => setProfileMenuOpen(false)}
                          className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-surface-subtle)] rounded-lg transition-colors"
                        >
                          <Users size={15} className="text-[var(--color-text-tertiary)]" />
                          Staff & Permissions
                        </NavLink>
                      )}
                      {hasPermission(profile?.role, 'manage_settings') && (
                        <NavLink
                          to="/admin/settings"
                          onClick={() => setProfileMenuOpen(false)}
                          className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-surface-subtle)] rounded-lg transition-colors"
                        >
                          <Settings size={15} className="text-[var(--color-text-tertiary)]" />
                          Restaurant Settings
                        </NavLink>
                      )}
                    </div>
                    <div className="p-1.5 border-t border-[var(--color-border-subtle)]">
                      <button
                        onClick={handleSignOut}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <LogOut size={15} />
                        Sign Out
                      </button>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </header>

        {/* Page Content Container */}
        <div className="flex-1 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18 }}
            className="admin-content"
          >
            {children}
          </motion.div>
        </div>
      </main>
    </div>
  )
}
