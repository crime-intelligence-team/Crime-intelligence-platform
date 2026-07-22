import type { Severity } from '../../types'

// ── SeverityBadge ────────────────────────────────────────────────────────────
const severityConfig: Record<Severity, { label: string; className: string }> = {
  critical: { label: 'CRITICAL',  className: 'bg-severity-critical/15 text-severity-critical border border-severity-critical/30' },
  elevated: { label: 'ELEVATED',  className: 'bg-severity-elevated/15 text-severity-elevated border border-severity-elevated/30' },
  low:      { label: 'LOW',       className: 'bg-severity-low/15       text-severity-low       border border-severity-low/30'      },
  info:     { label: 'INFO',      className: 'bg-severity-info/15      text-severity-info      border border-severity-info/30'     },
}

interface SeverityBadgeProps { severity: Severity; className?: string }
export function SeverityBadge({ severity, className = '' }: SeverityBadgeProps) {
  const { label, className: sc } = severityConfig[severity]
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold tracking-wider ${sc} ${className}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {label}
    </span>
  )
}

// ── CategoryBadge ─────────────────────────────────────────────────────────────
const categoryLabels: Record<string, string> = {
  geo_political: 'GEO-POLITICAL', infrastructure: 'INFRASTRUCTURE',
  personnel: 'PERSONNEL', cyber: 'CYBER', financial: 'FINANCIAL',
}
interface CategoryBadgeProps { category: string; className?: string }
export function CategoryBadge({ category, className = '' }: CategoryBadgeProps) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium tracking-wider bg-surface-hover text-sentinel-300 border border-surface-border ${className}`}>
      {categoryLabels[category] ?? category.toUpperCase()}
    </span>
  )
}

// ── RiskScoreBadge ────────────────────────────────────────────────────────────
interface RiskScoreBadgeProps { score: number; className?: string }
export function RiskScoreBadge({ score, className = '' }: RiskScoreBadgeProps) {
  const color = score >= 80 ? 'bg-severity-critical/20 text-severity-critical border-severity-critical/40'
              : score >= 50 ? 'bg-severity-elevated/20 text-severity-elevated border-severity-elevated/40'
              : 'bg-surface-hover text-sentinel-300 border-surface-border'
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded border text-[11px] font-mono font-medium ${color} ${className}`}>
      {score >= 80 && <span className="w-1.5 h-1.5 rounded-full bg-current" />}
      {score}
    </span>
  )
}

// ── StatusDot ─────────────────────────────────────────────────────────────────
const dotColors: Record<string, string> = {
  critical: 'bg-severity-critical',
  elevated: 'bg-severity-elevated',
  active:   'bg-accent-emerald',
  normal:   'bg-sentinel-400',
  offline:  'bg-sentinel-600',
  warning:  'bg-severity-elevated',
}
interface StatusDotProps { status: string; pulse?: boolean; size?: 'sm' | 'md' }
export function StatusDot({ status, pulse = false, size = 'sm' }: StatusDotProps) {
  const sz = size === 'sm' ? 'w-2 h-2' : 'w-2.5 h-2.5'
  const color = dotColors[status] ?? 'bg-sentinel-400'
  return (
    <span className="relative inline-flex">
      <span className={`${sz} rounded-full ${color} ${pulse ? 'animate-pulse' : ''}`} />
    </span>
  )
}

// ── AuditStatusBadge ──────────────────────────────────────────────────────────
interface AuditStatusBadgeProps { status: 'success' | 'denied' | 'pending' }
export function AuditStatusBadge({ status }: AuditStatusBadgeProps) {
  if (status === 'success') return <span className="flex items-center gap-1 text-accent-emerald text-[12px]">✓ Success</span>
  if (status === 'denied')  return <span className="flex items-center gap-1 text-sentinel-400 text-[12px]">⊗ Denied</span>
  return <span className="text-sentinel-400 text-[12px]">Pending</span>
}

// ── AuditRiskBadge ─────────────────────────────────────────────────────────────
interface AuditRiskBadgeProps { risk: 'high' | 'medium' | 'low' }
export function AuditRiskBadge({ risk }: AuditRiskBadgeProps) {
  const map = {
    high:   'bg-severity-critical/15 text-severity-critical border-severity-critical/30',
    medium: 'bg-severity-elevated/15 text-severity-elevated border-severity-elevated/30',
    low:    'bg-surface-hover text-sentinel-400 border-surface-border',
  }
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-medium tracking-wider ${map[risk]}`}>
      {risk === 'high' && <span className="w-1.5 h-1.5 rounded-full bg-current" />}
      {risk.charAt(0).toUpperCase() + risk.slice(1)}
    </span>
  )
}

// ── NodeIntegrityBadge ────────────────────────────────────────────────────────
interface NodeIntegrityBadgeProps { status: 'healthy' | 'degraded' | 'compromised' | 'offline' }
export function NodeIntegrityBadge({ status }: NodeIntegrityBadgeProps) {
  const map = {
    healthy: 'bg-accent-emerald/10 text-accent-emerald border-accent-emerald/30',
    degraded: 'bg-severity-elevated/15 text-severity-elevated border-severity-elevated/30',
    compromised:  'bg-severity-critical/10 text-severity-critical border-severity-critical/30',
    offline: 'bg-surface-hover text-sentinel-400 border-surface-border',
  }
  return (
    <span className={`px-2.5 py-0.5 rounded border text-[10px] font-semibold tracking-wider ${map[status]}`}>
      {status.toUpperCase()}
    </span>
  )
}
