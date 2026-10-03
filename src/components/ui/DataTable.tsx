import React from 'react'
import { cn } from '@/lib/utils'

interface Column<T> {
  header: string
  accessorKey?: keyof T
  cell?: (item: T) => React.ReactNode
  className?: string
}

interface DataTableProps<T> {
  data: T[]
  columns: Column<T>[]
  onRowClick?: (item: T) => void
  emptyState?: React.ReactNode
  className?: string
}

export function DataTable<T>({ data, columns, onRowClick, emptyState, className }: DataTableProps<T>) {
  if (data.length === 0 && emptyState) {
    return <>{emptyState}</>
  }

  return (
    <div className={cn("w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-xl)] overflow-hidden shadow-[var(--shadow-xs)]", className)}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-[12px] uppercase tracking-wider font-semibold text-[var(--color-text-secondary)] bg-[var(--color-surface-subtle)] border-b border-[var(--color-border)]">
            <tr>
              {columns.map((col, i) => (
                <th key={i} className={cn("px-6 py-3.5 whitespace-nowrap", col.className)}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border-subtle)] text-[var(--color-text-primary)]">
            {data.map((row, i) => (
              <tr
                key={i}
                onClick={() => onRowClick?.(row)}
                className={cn(
                  "hover:bg-[var(--color-surface-subtle)]/60 transition-colors",
                  onRowClick && "cursor-pointer"
                )}
              >
                {columns.map((col, j) => (
                  <td key={j} className={cn("px-6 py-4 whitespace-nowrap text-sm", col.className)}>
                    {col.cell ? col.cell(row) : (col.accessorKey ? String(row[col.accessorKey]) : null)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
