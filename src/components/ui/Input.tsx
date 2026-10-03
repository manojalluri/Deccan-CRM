import React from 'react'
import { cn } from '@/lib/utils'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, leftIcon, rightIcon, id, ...props }, ref) => {
    const inputId = id || `input-${Math.random().toString(36).slice(2)}`

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="label">
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)] flex items-center justify-center">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              'input',
              leftIcon && '!pl-10',
              rightIcon && '!pr-10',
              error && 'input-error',
              className
            )}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)] flex items-center justify-center z-10 cursor-pointer">
              {rightIcon}
            </div>
          )}
        </div>
        {error && (
          <p className="text-sm text-[var(--color-error)] flex items-center gap-1">
            {error}
          </p>
        )}
        {hint && !error && (
          <p className="text-sm text-[var(--color-text-tertiary)]">{hint}</p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  hint?: string
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, hint, id, ...props }, ref) => {
    const inputId = id || `textarea-${Math.random().toString(36).slice(2)}`

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="label">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          className={cn(
            'input resize-none min-h-[100px]',
            error && 'input-error',
            className
          )}
          {...props}
        />
        {error && <p className="text-sm text-[var(--color-error)]">{error}</p>}
        {hint && !error && <p className="text-sm text-[var(--color-text-tertiary)]">{hint}</p>}
      </div>
    )
  }
)

Textarea.displayName = 'Textarea'
