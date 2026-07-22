import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

interface StatCardProps {
  label: string
  value: string | number
  subtext?: string
  subtextColor?: 'green' | 'amber' | 'red' | 'muted'
  icon?: LucideIcon
  highlight?: boolean
  children?: ReactNode
}

const subtextColorMap = {
  green: 'text-accent-emerald',
  amber: 'text-accent-amber',
  red:   'text-severity-critical',
  muted: 'text-sentinel-400',
}

export function StatCard({ label, value, subtext, subtextColor = 'muted', icon: Icon, highlight = false, children }: StatCardProps) {
  return (
    <div className={`rounded-lg p-4 border ${highlight ? 'bg-severity-critical/10 border-severity-critical/30' : 'bg-surface-card border-surface-border'}`}>
      <div className="flex items-start justify-between">
        <p className="section-label mb-2">{label}</p>
        {Icon && <Icon className="w-4 h-4 text-sentinel-400 shrink-0" />}
      </div>
      <p className={`text-2xl font-bold ${highlight ? 'text-severity-critical' : 'text-sentinel-50'}`}>
        {value}
      </p>
      {subtext && (
        <p className={`text-[11px] mt-1 ${subtextColorMap[subtextColor]}`}>{subtext}</p>
      )}
      {children}
    </div>
  )
}
