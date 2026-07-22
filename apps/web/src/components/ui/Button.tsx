import { cn } from '../../lib/utils'
import type { ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'rose' | 'emerald'
type Size    = 'xs' | 'sm' | 'md' | 'lg'

const variantClass: Record<Variant, string> = {
  primary:   'bg-accent-blue text-white hover:bg-blue-500',
  secondary: 'bg-surface-card text-sentinel-200 border border-surface-border hover:bg-surface-hover',
  ghost:     'text-sentinel-300 hover:text-sentinel-100 hover:bg-surface-hover',
  danger:    'bg-severity-critical text-white hover:bg-red-500',
  rose:      'bg-accent-rose text-white hover:bg-rose-500',
  emerald:   'bg-accent-emerald/10 text-accent-emerald border border-accent-emerald/30 hover:bg-accent-emerald/20',
}

const sizeClass: Record<Size, string> = {
  xs: 'px-2 py-1 text-[10px] gap-1',
  sm: 'px-3 py-1.5 text-xs gap-1.5',
  md: 'px-4 py-2 text-sm gap-2',
  lg: 'px-5 py-2.5 text-sm gap-2',
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

export function Button({ children, variant = 'secondary', size = 'sm', className = '', onClick, disabled, type = 'button' }: ButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex items-center justify-center font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
        variantClass[variant],
        sizeClass[size],
        className,
      )}
    >
      {children}
    </button>
  )
}
