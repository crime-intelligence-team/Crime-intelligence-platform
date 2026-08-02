interface ProgressBarProps {
  value: number           // 0-100
  color?: 'green' | 'amber' | 'red' | 'blue' | 'rose'
  label?: string
  showValue?: boolean
  height?: 'thin' | 'normal'
  className?: string
}

const colorMap = {
  green: 'bg-severity-low',
  amber: 'bg-severity-medium',
  red:   'bg-severity-critical',
  blue:  'bg-brand-500',
  rose:  'bg-viz-5',
}

export function ProgressBar({ value, color = 'green', label, showValue = true, height = 'normal', className = '' }: ProgressBarProps) {
  const h = height === 'thin' ? 'h-1' : 'h-1.5'
  return (
    <div className={className}>
      {(label || showValue) && (
        <div className="flex justify-between items-center mb-1.5">
          {label && <span className="text-xs text-text-secondary">{label}</span>}
          {showValue && <span className="text-xs font-medium text-text-primary font-mono">{value}%</span>}
        </div>
      )}
      <div className={`w-full ${h} bg-bg-surface-2 rounded-full overflow-hidden`}>
        <div
          className={`${h} rounded-full ${colorMap[color]} transition-all duration-700`}
          style={{ width: `${Math.min(100, value)}%` }}
        />
      </div>
    </div>
  )
}

// Risk driver variant with colored bar and percentage label
interface RiskDriverBarProps { label: string; value: number; color: 'rose' | 'amber' | 'blue' }
const riskColorMap = { rose: 'bg-viz-5', amber: 'bg-severity-medium', blue: 'bg-brand-500' }
export function RiskDriverBar({ label, value, color }: RiskDriverBarProps) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-text-secondary">{label}</span>
        <span className="font-mono text-text-primary">{value}%</span>
      </div>
      <div className="h-1.5 w-full bg-bg-surface-2 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${riskColorMap[color]}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  )
}
