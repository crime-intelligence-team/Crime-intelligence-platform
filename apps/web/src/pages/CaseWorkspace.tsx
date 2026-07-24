import { useNavigate } from 'react-router-dom'
import { Filter, ArrowUpDown, Pin, CheckCircle, AlertCircle, Clock, BarChart3, MapPin, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { SeverityBadge, CategoryBadge, StatusDot } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { ProgressBar } from '../components/ui/ProgressBar'
import { SkeletonRow, SkeletonCard } from '../components/ui/Skeletons'
import { useApi } from '../hooks/useApi'
import { useActiveCase } from '../context/AppContext'
import { casesApi } from '../services/api'
import type { Case } from '../types'

const statusConfig = {
  in_progress: { label: 'In Progress',  icon: Clock,         color: 'text-accent-amber'     },
  open:        { label: 'Open',         icon: AlertCircle,   color: 'text-sentinel-300'      },
  resolved:    { label: 'Resolved',     icon: CheckCircle,   color: 'text-accent-emerald'    },
  escalated:   { label: 'Escalated',    icon: AlertCircle,   color: 'text-severity-critical' },
}

const severityRowAccent: Record<string, string> = {
  critical: 'border-l-severity-critical',
  elevated: 'border-l-accent-amber',
  low:      'border-l-accent-blue',
  info:     'border-l-sentinel-500',
}

function CaseRow({ c, isActive, onClick }: { c: Case; isActive: boolean; onClick: () => void }) {
  const sc = statusConfig[c.status]
  const StatusIcon = sc.icon
  const accentBorder = severityRowAccent[c.severity] ?? 'border-l-transparent'
  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-4 px-5 py-3.5 border-b border-surface-border border-l-2 cursor-pointer transition-all duration-150 group ${
        isActive
          ? `bg-accent-blue/5 ${accentBorder}`
          : `hover:bg-surface-hover ${accentBorder} hover:translate-x-0.5`
      }`}
    >
      <StatusDot status={c.severity === 'critical' ? 'critical' : c.severity === 'elevated' ? 'elevated' : 'active'} pulse={c.severity === 'critical'} />
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <span className="font-mono text-[11px] text-sentinel-400 shrink-0">{c.caseId}</span>
        <SeverityBadge severity={c.severity} />
        <CategoryBadge category={c.category} />
        <span className="text-sm font-medium text-sentinel-100 truncate ml-1">{c.title}</span>
      </div>
      <div className="flex items-center gap-1.5 shrink-0 text-xs">
        <StatusIcon className={`w-3.5 h-3.5 ${sc.color}`} />
        <span className={sc.color}>{sc.label}</span>
      </div>
      <div className="text-xs text-sentinel-400 shrink-0 min-w-[100px] text-right">{c.assignee}</div>
      <Pin className="w-3.5 h-3.5 text-sentinel-600 group-hover:text-accent-blue transition-colors shrink-0" />
    </div>
  )
}

function SummaryMetric({ label, value, unit, trend }: { label: string; value: string | number; unit?: string; trend?: 'up' | 'down' | 'flat' }) {
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus
  const trendColor = trend === 'up' ? 'text-severity-critical' : trend === 'down' ? 'text-accent-emerald' : 'text-sentinel-500'
  return (
    <div className="bg-surface-card rounded-xl p-3.5 border border-surface-border hover:border-sentinel-500/30 transition-colors">
      <p className="section-label mb-1.5">{label}</p>
      <div className="flex items-end justify-between">
        <p className="text-2xl font-bold text-sentinel-50 animate-count-up">
          {value}<span className="text-sm text-sentinel-400 font-normal ml-0.5">{unit}</span>
        </p>
        {trend && <TrendIcon className={`w-4 h-4 ${trendColor}`} />}
      </div>
    </div>
  )
}

export default function CaseWorkspace() {
  const navigate = useNavigate()
  const { activeCaseId, setActiveCase } = useActiveCase()
  const { data: cases, loading, error, refetch } = useApi(casesApi.list)

  const criticalCount  = cases?.filter(c => c.severity === 'critical').length ?? 0
  const escalatedCount = cases?.filter(c => c.status  === 'escalated').length ?? 0

  function handleCaseClick(c: Case) {
    setActiveCase(c.id)
    navigate(`/cases/${c.id}`)
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left — investigation list */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-surface-border shrink-0 flex items-start justify-between bg-surface-raised/30">
          <div>
            <h1 className="text-xl font-bold text-sentinel-50 flex items-center gap-3">
              Active Investigations
              {criticalCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-severity-critical/15 border border-severity-critical/30 text-severity-critical text-xs font-bold animate-pulse">
                  {criticalCount} Critical
                </span>
              )}
            </h1>
            <p className="text-xs text-sentinel-400 mt-0.5">
              Monitoring <span className="text-sentinel-200 font-medium">{cases?.length ?? '—'}</span> ongoing cases
              {escalatedCount > 0 && <> · <span className="text-accent-amber">{escalatedCount} escalated</span></>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm"><Filter className="w-3.5 h-3.5" /> Filter</Button>
            <Button variant="secondary" size="sm"><ArrowUpDown className="w-3.5 h-3.5" /> Sort</Button>
            <Button variant="secondary" size="sm" onClick={refetch}>↻ Refresh</Button>
          </div>
        </div>

        {/* Table header */}
        <div className="px-5 py-2.5 border-b border-surface-border bg-surface-raised/60 shrink-0">
          <div className="flex items-center gap-4 text-[10px] font-semibold tracking-widest text-sentinel-500 uppercase">
            <span className="w-2" />
            <span className="flex-1">Case</span>
            <span className="w-24 text-right">Status</span>
            <span className="w-28 text-right">Assigned</span>
            <span className="w-4" />
          </div>
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto stagger-children">
          {loading && Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)}
          {error && (
            <div className="flex flex-col items-center justify-center h-48 gap-2 text-sentinel-400">
              <p className="text-sm">Failed to load cases</p>
              <Button variant="secondary" size="sm" onClick={refetch}>Retry</Button>
            </div>
          )}
          {cases?.map(c => (
            <CaseRow
              key={c.id}
              c={c}
              isActive={activeCaseId === c.id}
              onClick={() => handleCaseClick(c)}
            />
          ))}
        </div>
      </div>

      {/* Right — Case Summary panel */}
      <div className="w-[300px] shrink-0 border-l border-surface-border flex flex-col bg-surface-raised overflow-y-auto">
        <div className="px-4 py-4 border-b border-surface-border">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-accent-blue" />
            <h2 className="text-sm font-semibold text-sentinel-100">Case Summary</h2>
          </div>

          {loading ? (
            <div className="space-y-2">
              <SkeletonCard height="h-16" />
              <SkeletonCard height="h-16" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <SummaryMetric label="Active Volume" value={cases?.length ?? 0} trend="up" />
                <SummaryMetric label="Avg Resolution" value="1.2" unit="h" trend="down" />
              </div>
              <div className="bg-surface-card rounded-xl p-3.5 border border-surface-border mb-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="section-label">Investigation Health</p>
                  <span className="text-[10px] font-medium text-accent-amber">Sub-Optimal</span>
                </div>
                <ProgressBar value={78} color="amber" showValue={false} />
                <p className="text-[10px] text-sentinel-400 mt-2 leading-relaxed">
                  Elevated caseload affecting standard SLA times.
                </p>
              </div>
              {/* Severity breakdown */}
              {[
                { label: 'Critical', count: criticalCount, color: 'bg-severity-critical', text: 'text-severity-critical' },
                { label: 'Escalated', count: escalatedCount, color: 'bg-accent-amber', text: 'text-accent-amber' },
                { label: 'Resolved', count: cases?.filter(c => c.status === 'resolved').length ?? 0, color: 'bg-accent-emerald', text: 'text-accent-emerald' },
              ].map(s => (
                <div key={s.label} className="flex items-center justify-between py-2 border-b border-surface-border last:border-0">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${s.color}`} />
                    <span className="text-xs text-sentinel-300">{s.label}</span>
                  </div>
                  <span className={`text-xs font-bold font-mono ${s.text}`}>{s.count}</span>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Mini map placeholder with grid */}
        <div className="flex-1 relative bg-surface-base scan-overlay overflow-hidden">
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sentinel-500 z-10">
            <MapPin className="w-5 h-5 animate-float" />
            <span className="text-xs tracking-wide">Live Threat Topography</span>
            <span className="text-[10px] text-sentinel-600">Map view available in Geo Intelligence</span>
          </div>
          <div className="absolute inset-0 opacity-[0.06]"
            style={{ backgroundImage: 'linear-gradient(#3b82f6 1px, transparent 1px), linear-gradient(90deg, #3b82f6 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        </div>
      </div>
    </div>
  )
}
