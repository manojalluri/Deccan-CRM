import { cn } from '@/lib/utils'
import type { OrderStatus, FoodType } from '@/types/database'

export * from './Card'

interface StatusBadgeProps {
  status: OrderStatus
  className?: string
}

const statusConfig: Record<OrderStatus, { label: string; className: string }> = {
  placed: { label: 'Placed', className: 'badge badge-blue' },
  accepted: { label: 'Accepted', className: 'badge badge-orange' },
  preparing: { label: 'Preparing', className: 'badge badge-yellow' },
  ready: { label: 'Ready', className: 'badge badge-purple' },
  served: { label: 'Served', className: 'badge badge-green' },
  cancelled: { label: 'Cancelled', className: 'badge badge-red' },
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] || { label: status, className: 'badge badge-gray' }
  return (
    <span className={cn(config.className, className)}>
      {config.label}
    </span>
  )
}

interface FoodTypeBadgeProps {
  type: FoodType
  className?: string
}

export function FoodTypeIndicator({ type, className }: FoodTypeBadgeProps) {
  if (type === 'veg') return <span className={cn('veg-indicator', className)} aria-label="Vegetarian" />
  if (type === 'non-veg') return <span className={cn('non-veg-indicator', className)} aria-label="Non-Vegetarian" />
  return <span className={cn('egg-indicator', className)} aria-label="Contains Egg" />
}

// Skeleton components
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} />
}

export function SkeletonCard() {
  return (
    <div className="card p-4 space-y-3">
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-1/2" />
      <div className="flex justify-between items-center">
        <Skeleton className="h-6 w-20" />
        <Skeleton className="h-9 w-24" />
      </div>
    </div>
  )
}

export function SkeletonStatCard() {
  return (
    <div className="stat-card space-y-3">
      <div className="flex justify-between">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-10 w-10 rounded-xl" />
      </div>
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-4 w-20" />
    </div>
  )
}

export function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 p-4">
      <Skeleton className="h-12 w-12 rounded-xl" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-60" />
      </div>
      <Skeleton className="h-6 w-16" />
    </div>
  )
}

// Empty State
interface EmptyStateProps {
  icon: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
}

import React from 'react'

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">{icon}</div>
      <div>
        <h3 className="text-base font-semibold text-[var(--color-text-primary)]">{title}</h3>
        {description && (
          <p className="text-sm text-[var(--color-text-secondary)] mt-1 max-w-xs mx-auto">{description}</p>
        )}
      </div>
      {action}
    </div>
  )
}

// Switch Toggle
interface SwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  label?: string
  description?: string
  id?: string
}

export function Switch({ checked, onChange, disabled, label, description, id }: SwitchProps) {
  const switchId = id || `switch-${Math.random().toString(36).slice(2)}`

  return (
    <div className="flex items-center justify-between gap-4">
      {(label || description) && (
        <div>
          {label && (
            <label htmlFor={switchId} className="text-sm font-medium text-[var(--color-text-primary)] cursor-pointer">
              {label}
            </label>
          )}
          {description && (
            <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{description}</p>
          )}
        </div>
      )}
      <button
        id={switchId}
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex w-11 h-6 rounded-full transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)] focus-visible:outline-offset-2',
          checked ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-border)]',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200',
            checked && 'translate-x-5'
          )}
        />
      </button>
    </div>
  )
}
