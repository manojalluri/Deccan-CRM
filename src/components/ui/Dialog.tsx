import React, { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DialogProps {
  open: boolean
  onClose: () => void
  title?: string
  description?: string
  children: React.ReactNode
  className?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
}

export function Dialog({ open, onClose, title, description, children, className, size = 'md' }: DialogProps) {
  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (open) document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  // Prevent body scroll
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className={cn(
              'relative z-10 w-full bg-[var(--color-surface)] rounded-2xl shadow-2xl',
              sizeClasses[size],
              className
            )}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? 'dialog-title' : undefined}
          >
            {/* Header */}
            {(title || description) && (
              <div className="flex items-start justify-between p-6 pb-0">
                <div>
                  {title && (
                    <h2 id="dialog-title" className="text-lg font-semibold text-[var(--color-text-primary)]">
                      {title}
                    </h2>
                  )}
                  {description && (
                    <p className="text-sm text-[var(--color-text-secondary)] mt-1">{description}</p>
                  )}
                </div>
                <button
                  onClick={onClose}
                  className="btn btn-ghost btn-icon -mt-1 -mr-1 ml-4"
                  aria-label="Close dialog"
                >
                  <X size={18} />
                </button>
              </div>
            )}

            {!title && (
              <button
                onClick={onClose}
                className="absolute top-4 right-4 btn btn-ghost btn-icon z-10"
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            )}

            {/* Content */}
            <div className="p-6">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

// Bottom Sheet (for mobile)
interface BottomSheetProps {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  className?: string
}

export function BottomSheet({ open, onClose, title, children, className }: BottomSheetProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (open) document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className={cn(
              'relative z-10 bg-[var(--color-surface)] rounded-t-3xl max-h-[90vh] overflow-y-auto',
              className
            )}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-[var(--color-border)]" />
            </div>

            {title && (
              <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border-subtle)]">
                <h2 className="text-lg font-semibold">{title}</h2>
                <button onClick={onClose} className="btn btn-ghost btn-icon" aria-label="Close">
                  <X size={18} />
                </button>
              </div>
            )}

            <div className="pb-safe">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

// Confirmation Dialog
interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'warning' | 'default'
  loading?: boolean
}

export function ConfirmDialog({
  open, onClose, onConfirm, title, description,
  confirmLabel = 'Confirm', cancelLabel = 'Cancel',
  variant = 'danger', loading = false
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} size="sm">
      <div className="text-center">
        <div className={cn(
          'w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center',
          variant === 'danger' && 'bg-red-50',
          variant === 'warning' && 'bg-amber-50',
          variant === 'default' && 'bg-[var(--color-background)]'
        )}>
          <svg className={cn(
            'w-7 h-7',
            variant === 'danger' && 'text-red-500',
            variant === 'warning' && 'text-amber-500',
            variant === 'default' && 'text-[var(--color-text-secondary)]'
          )} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        <p className="text-sm text-[var(--color-text-secondary)] mb-6">{description}</p>
        <div className="flex gap-3">
          <button onClick={onClose} className="btn btn-secondary flex-1" disabled={loading}>
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={cn(
              'btn flex-1',
              variant === 'danger' && 'btn-danger',
              variant === 'warning' && 'btn-primary',
              variant === 'default' && 'btn-primary',
            )}
          >
            {loading ? (
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : confirmLabel}
          </button>
        </div>
      </div>
    </Dialog>
  )
}
