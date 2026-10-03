import React from 'react'

interface PageHeaderProps {
  title: string
  description?: string
  action?: React.ReactNode
}

export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-7 pb-5 border-b border-[var(--color-border-subtle)]">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)] tracking-tight">
          {title}
        </h1>
        {description && (
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">
            {description}
          </p>
        )}
      </div>
      {action && (
        <div className="flex items-center gap-3 flex-shrink-0">
          {action}
        </div>
      )}
    </div>
  )
}
