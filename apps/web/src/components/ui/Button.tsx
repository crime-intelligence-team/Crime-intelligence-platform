import { cn } from '../../lib/utils'
import type { ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'rose' | 'emerald'
type Size    = 'xs' | 'sm' | 'md' | 'lg'

const variantClass: Record<Variant, string> = {
  primary:   'bg-accent-blue text-white hover:bg-blue-500 btn-primary-shimmer shadow-sm shadow-accent-blue/20 hover:shadow-accent-blue/30 hover:shadow-md ring-0 hover:ring-2 hover:ring-accent-blue/30 ring-offset-0 ring-offset-surface-base',
  secondary: 'bg-surface-card text-sentinel-200 border border-surface-border hover:bg-surface-hover hover:text-sentinel-50 hover:border-sentinel-400/40',
  ghost:     'text-sentinel-300 hover:text-sentinel-100 hover:bg-surface-hover',
  danger:    'bg-severity-critical/10 text-severity-critical border border-severity-critical/30 hover:bg-severity-critical/20 hover:border-severity-critical/50',
  rose:      'bg-accent-rose/10 text-accent-rose border border-accent-rose/30 hover:bg-accent-rose/20',
  emerald:   'bg-accent-emerald/10 text-accent-emerald border border-accent-emerald/30 hover:bg-accent-emerald/20',
}

const sizeClass: Record<Size, string> = {
  xs: 'px-2 py-1 text-[10px] gap-1 rounded-md',
  sm: 'px-3 py-1.5 text-xs gap-1.5 rounded-lg',
  md: 'px-4 py-2 text-sm gap-2 rounded-lg',
  lg: 'px-5 py-2.5 text-sm gap-2 rounded-xl',
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
