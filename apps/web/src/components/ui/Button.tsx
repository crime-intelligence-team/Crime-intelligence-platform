import { cn } from '../../lib/utils'
import type { ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'rose' | 'emerald'
type Size    = 'xs' | 'sm' | 'md' | 'lg'

const variantClass: Record<Variant, string> = {
  primary:   'bg-brand-500 text-white hover:bg-brand-600 btn-primary-shimmer shadow-sm shadow-brand-500/20 hover:shadow-brand-500/30 hover:shadow-md ring-0 hover:ring-2 hover:ring-brand-500/30 ring-offset-0 ring-offset-bg-canvas',
  secondary: 'bg-bg-surface-2 text-text-secondary border border-border-default hover:bg-bg-elevated hover:text-text-primary hover:border-border-strong',
  ghost:     'text-text-tertiary hover:text-text-primary hover:bg-bg-surface-2',
  danger:    'bg-severity-tint-critical text-severity-critical border border-severity-critical/30 hover:bg-severity-critical/20 hover:border-severity-critical/50',
  rose:      'bg-viz-5/10 text-viz-5 border border-viz-5/30 hover:bg-viz-5/20',
  emerald:   'bg-severity-tint-low text-severity-low border border-severity-low/30 hover:bg-severity-low/20',
}

const sizeClass: Record<Size, string> = {
  xs: 'h-6 px-2 text-[10px] gap-1 rounded-sm',
  sm: 'h-8 px-3 text-xs gap-1.5 rounded-md',
  md: 'h-9 px-4 text-sm gap-2 rounded-md',
  lg: 'h-11 px-5 text-sm gap-2 rounded-md',
}

interface ButtonProps {
  children: ReactNode
  variant?: Variant
  size?: Size
  className?: string
  onClick?: () => void
  disabled?: boolean
  type?: 'button' | 'submit'
}

export function Button({
  children,
  variant = 'secondary',
  size = 'sm',
  className = '',
  onClick,
  disabled,
  type = 'button',
}: ButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'relative inline-flex items-center justify-center font-medium transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed select-none',
        variantClass[variant],
        sizeClass[size],
        className,
      )}
    >
      {children}
    </button>
  )
}
