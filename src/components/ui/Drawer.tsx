import React, { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DrawerProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: React.ReactNode
  footer?: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
}

export function Drawer({ open, onClose, title, description, children, footer, size = 'md' }: DrawerProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'auto'
    }
    return () => {
      document.body.style.overflow = 'auto'
    }
  }, [open])

  const sizeClasses = {
    sm: 'max-w-[440px]',
    md: 'max-w-[540px]',
    lg: 'max-w-[740px]',
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-[100]"
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            className={cn(
              "fixed inset-y-0 right-0 w-full bg-[var(--color-surface)] shadow-[var(--shadow-dropdown)] z-[101] flex flex-col border-l border-[var(--color-border)]",
              sizeClasses[size]
            )}
          >
            {/* Drawer Header */}
            <div className="flex items-start justify-between p-6 pb-5 border-b border-[var(--color-border)] flex-shrink-0">
              <div>
                <h2 className="text-lg font-bold text-[var(--color-text-primary)] tracking-tight">{title}</h2>
                {description && (
                  <p className="text-xs text-[var(--color-text-secondary)] mt-1">{description}</p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-subtle)] border border-transparent hover:border-[var(--color-border)] transition-all ml-4"
                aria-label="Close drawer"
              >
                <X size={17} />
              </button>
            </div>
            
            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-6">
              {children}
            </div>

            {/* Drawer Footer */}
            {footer && (
              <div className="p-4 px-6 border-t border-[var(--color-border)] bg-[var(--color-surface)] flex-shrink-0">
                {footer}
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
