import React from 'react'
import { cn } from '@/lib/utils'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hover?: boolean
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, hover, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('card', hover && 'card-hover', className)}
        {...props}
      >
        {children}
      </div>
    )
  }
)
Card.displayName = 'Card'

export const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('flex items-center justify-between p-6 pb-4 border-b border-[var(--color-border-subtle)]', className)}
        {...props}
      >
        {children}
      </div>
    )
  }
)
CardHeader.displayName = 'CardHeader'

export const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, children, ...props }, ref) => {
    return (
      <h3
        ref={ref}
        className={cn('text-base font-semibold text-[var(--color-text-primary)] tracking-tight', className)}
        {...props}
      >
        {children}
      </h3>
    )
  }
)
CardTitle.displayName = 'CardTitle'

export const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, children, ...props }, ref) => {
    return (
      <p
        ref={ref}
        className={cn('text-xs text-[var(--color-text-secondary)] mt-0.5', className)}
        {...props}
      >
        {children}
      </p>
    )
  }
)
CardDescription.displayName = 'CardDescription'

export const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => {
    return (
      <div ref={ref} className={cn('p-6', className)} {...props}>
        {children}
      </div>
    )
  }
)
CardContent.displayName = 'CardContent'

export const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('flex items-center justify-between p-4 px-6 border-t border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)]/50 rounded-b-[var(--radius-xl)]', className)}
        {...props}
      >
        {children}
      </div>
    )
  }
)
CardFooter.displayName = 'CardFooter'
