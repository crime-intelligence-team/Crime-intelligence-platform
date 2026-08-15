type Severity = 'critical' | 'elevated' | 'low' | 'info'

// ── SeverityBadge ────────────────────────────────────────────────────────────
const severityConfig: Record<Severity, { label: string; className: string }> = {
  critical: { label: 'CRITICAL',  className: 'bg-severity-tint-critical text-severity-critical border border-severity-critical/30' },
  elevated: { label: 'ELEVATED',  className: 'bg-severity-tint-high text-severity-high border border-severity-high/30' },
  low:      { label: 'LOW',       className: 'bg-severity-tint-low text-severity-low border border-severity-low/30'      },
  info:     { label: 'INFO',      className: 'bg-severity-tint-info text-severity-info border border-severity-info/30'     },
}

interface SeverityBadgeProps { severity: Severity; className?: string }
export function SeverityBadge({ severity, className = '' }: SeverityBadgeProps) {
  const { label, className: sc } = severityConfig[severity]
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-sm text-xs font-semibold tracking-wider ${sc} ${className}`}>
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
    <span className={`inline-flex items-center px-3 py-1 rounded-sm text-xs font-semibold tracking-wider bg-bg-surface-2 text-text-secondary border border-border-default ${className}`}>
      {categoryLabels[category] ?? category.toUpperCase()}
    </span>
  )
}

// ── RiskScoreBadge ────────────────────────────────────────────────────────────
interface RiskScoreBadgeProps { score: number; className?: string }
export function RiskScoreBadge({ score, className = '' }: RiskScoreBadgeProps) {
  const color = score >= 80 ? 'bg-severity-tint-critical text-severity-critical border-severity-critical/40'
              : score >= 50 ? 'bg-severity-tint-high text-severity-high border-severity-high/40'
              : 'bg-bg-surface-2 text-text-secondary border-border-default'
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-sm border text-xs font-mono font-medium ${color} ${className}`}>
      {score >= 80 && <span className="w-1.5 h-1.5 rounded-full bg-current" />}
      {score}
    </span>
  )
}

// ── StatusDot ─────────────────────────────────────────────────────────────────
const dotColors: Record<string, string> = {
  critical: 'bg-severity-critical',
  elevated: 'bg-severity-high',
  active:   'bg-severity-low',
  normal:   'bg-text-tertiary',
  offline:  'bg-text-disabled',
  warning:  'bg-severity-medium',
}
interface StatusDotProps { status: string; pulse?: boolean; size?: 'sm' | 'md' }
export function StatusDot({ status, pulse = false, size = 'sm' }: StatusDotProps) {
  const sz = size === 'sm' ? 'w-2 h-2' : 'w-2.5 h-2.5'
  const color = dotColors[status] ?? 'bg-text-tertiary'
  return (
    <span className="relative inline-flex">
      <span className={`${sz} rounded-full ${color} ${pulse ? 'animate-pulse' : ''}`} />
    </span>
  )
}

// ── AuditStatusBadge ──────────────────────────────────────────────────────────
interface AuditStatusBadgeProps { status: 'success' | 'denied' | 'pending' }
export function AuditStatusBadge({ status }: AuditStatusBadgeProps) {
  if (status === 'success') return <span className="flex items-center gap-1 text-severity-low text-xs font-medium">✓ Success</span>
  if (status === 'denied')  return <span className="flex items-center gap-1 text-text-secondary text-xs font-medium">⊗ Denied</span>
  return <span className="text-text-tertiary text-xs font-medium">Pending</span>
}

// ── AuditRiskBadge ─────────────────────────────────────────────────────────────
interface AuditRiskBadgeProps { risk: 'high' | 'medium' | 'low' }
export function AuditRiskBadge({ risk }: AuditRiskBadgeProps) {
  const map = {
    high:   'bg-severity-tint-critical text-severity-critical border-severity-critical/30',
    medium: 'bg-severity-tint-high text-severity-high border-severity-high/30',
    low:    'bg-bg-surface-2 text-text-tertiary border-border-default',
  }
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-sm border text-xs font-semibold tracking-wider ${map[risk]}`}>
      {risk === 'high' && <span className="w-1.5 h-1.5 rounded-full bg-current" />}
      {risk.charAt(0).toUpperCase() + risk.slice(1)}
    </span>
  )
}

// ── NodeIntegrityBadge ────────────────────────────────────────────────────────
interface NodeIntegrityBadgeProps { status: 'healthy' | 'degraded' | 'compromised' | 'offline' }
export function NodeIntegrityBadge({ status }: NodeIntegrityBadgeProps) {
  const map = {
    healthy: 'bg-severity-tint-low text-severity-low border-severity-low/30',
    degraded: 'bg-severity-tint-high text-severity-high border-severity-high/30',
    compromised:  'bg-severity-tint-critical text-severity-critical border-severity-critical/30',
    offline: 'bg-bg-surface-2 text-text-tertiary border-border-default',
  }
  return (
    <span className={`px-3 py-1 rounded-sm border text-xs font-semibold tracking-wider ${map[status]}`}>
      {status.toUpperCase()}
    </span>
  )
}
