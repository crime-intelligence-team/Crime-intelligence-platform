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
  in_progress: { label: 'In Progress',  icon: Clock,         color: 'text-severity-medium'     },
  open:        { label: 'Open',         icon: AlertCircle,   color: 'text-text-tertiary'      },
  resolved:    { label: 'Resolved',     icon: CheckCircle,   color: 'text-severity-low'    },
  escalated:   { label: 'Escalated',    icon: AlertCircle,   color: 'text-severity-critical' },
}

const severityRowAccent: Record<string, string> = {
  critical: 'border-l-severity-critical',
  elevated: 'border-l-severity-high',
  low:      'border-l-brand-500',
  info:     'border-l-text-tertiary',
}

function CaseRow({ c, isActive, onClick }: { c: Case; isActive: boolean; onClick: () => void }) {
  const sc = statusConfig[c.status]
  const StatusIcon = sc.icon
  const accentBorder = severityRowAccent[c.severity] ?? 'border-l-transparent'
  return (
    <div
      onClick={onClick}
      className={`grid grid-cols-[16px_95px_90px_130px_1fr_100px_120px_28px] gap-4 items-center px-5 py-3.5 border-b border-border-default border-l-2 cursor-pointer transition-all duration-150 group ${
        isActive
          ? `bg-brand-500/5 ${accentBorder}`
          : `hover:bg-bg-surface-2 ${accentBorder} hover:translate-x-0.5`
      }`}
    >
      <StatusDot status={c.severity === 'critical' ? 'critical' : c.severity === 'elevated' ? 'elevated' : 'active'} pulse={c.severity === 'critical'} />
      <span className="font-mono text-[11px] text-text-tertiary whitespace-nowrap">{c.caseId}</span>
      <div className="overflow-hidden min-w-0"><SeverityBadge severity={c.severity} className="w-full justify-start whitespace-nowrap" /></div>
      <div className="overflow-hidden min-w-0"><CategoryBadge category={c.category} className="w-full justify-start whitespace-nowrap" /></div>
      <span className="text-sm font-medium text-text-primary truncate" title={c.title}>{c.title}</span>
      <div className="flex items-center gap-1.5 text-xs truncate">
        <StatusIcon className={`w-3.5 h-3.5 shrink-0 ${sc.color}`} />
        <span className={sc.color}>{sc.label}</span>
      </div>
      <div className="text-xs text-text-tertiary text-right truncate">{c.assignee}</div>
      <div className="flex justify-end p-1 rounded hover:bg-bg-surface-hover transition-colors">
        <Pin className="w-3.5 h-3.5 text-text-disabled group-hover:text-brand-500 transition-colors" />
      </div>
    </div>
  )
}

function SummaryMetric({ label, value, unit, trend }: { label: string; value: string | number; unit?: string; trend?: 'up' | 'down' | 'flat' }) {
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus
  const trendColor = trend === 'up' ? 'text-severity-critical' : trend === 'down' ? 'text-severity-low' : 'text-text-tertiary'
  return (
    <div className="bg-bg-surface rounded-xl p-3.5 border border-border-default hover:border-border-strong transition-colors">
      <p className="section-label mb-1.5">{label}</p>
      <div className="flex items-end justify-between">
        <p className="text-2xl font-bold text-text-primary animate-count-up">
          {value}<span className="text-sm text-text-tertiary font-normal ml-0.5">{unit}</span>
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
        <div className="px-6 py-4 border-b border-border-default shrink-0 flex items-start justify-between bg-bg-surface-2/30">
          <div>
            <h1 className="text-xl font-bold text-text-primary flex items-center gap-3">
              Active Investigations
              {criticalCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-severity-tint-critical border border-severity-critical/30 text-severity-critical text-xs font-bold animate-pulse">
                  {criticalCount} Critical
                </span>
              )}
            </h1>
            <p className="text-xs text-text-tertiary mt-0.5">
              Monitoring <span className="text-text-secondary font-medium">{cases?.length ?? '—'}</span> ongoing cases
              {escalatedCount > 0 && <> · <span className="text-severity-high">{escalatedCount} escalated</span></>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm"><Filter className="w-3.5 h-3.5" /> Filter</Button>
            <Button variant="secondary" size="sm"><ArrowUpDown className="w-3.5 h-3.5" /> Sort</Button>
            <Button variant="secondary" size="sm" onClick={refetch}>↻ Refresh</Button>
          </div>
        </div>

        {/* Table header */}
        <div className="px-5 py-2.5 border-b border-border-default bg-bg-surface-2/60 shrink-0">
          <div className="grid grid-cols-[16px_95px_90px_130px_1fr_100px_120px_28px] gap-4 items-center text-[10px] font-semibold tracking-widest text-text-tertiary uppercase">
            <span></span>
            <span>ID</span>
            <span>Severity</span>
            <span>Category</span>
            <span>Title</span>
            <span>Status</span>
            <span className="text-right">Assigned</span>
            <span></span>
          </div>
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto stagger-children pb-6">
          {loading && Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)}
          {error && (
            <div className="flex flex-col items-center justify-center h-48 gap-2 text-text-tertiary">
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
          {/* Table footer indicating end of list */}
          {cases && cases.length > 0 && (
            <div className="flex justify-center py-8">
              <span className="px-4 py-1.5 rounded-full bg-bg-surface-2 border border-border-default text-[10px] tracking-widest text-text-tertiary uppercase">
                Showing {cases.length} of {cases.length} active investigations
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Right — Case Summary panel */}
      <div className="w-[300px] shrink-0 border-l border-border-default flex flex-col bg-bg-surface overflow-y-auto">
        <div className="px-4 py-4 border-b border-border-default">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-brand-500" />
            <h2 className="text-sm font-semibold text-text-primary">Case Summary</h2>
          </div>

          {loading ? (
            <div className="space-y-2">
              <SkeletonCard height="h-16" />
              <SkeletonCard height="h-16" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <SummaryMetric label="Active Volume" value={cases?.length ?? 0} trend="up" />
                <SummaryMetric label="Avg Resolution" value="1.2" unit="h" trend="down" />
              </div>

              {/* Investigation Health */}
              <div className="bg-bg-surface rounded-xl p-4 border border-border-default hover:border-border-strong transition-colors mb-2">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold tracking-wider text-text-secondary uppercase">Investigation Health</p>
                  <span className="text-[10px] font-medium text-severity-medium px-2 py-0.5 bg-severity-medium/10 rounded-sm">Sub-Optimal</span>
                </div>
                <ProgressBar value={78} color="amber" showValue={false} />
                <p className="text-[11px] text-text-tertiary mt-2.5 leading-relaxed">
                  Elevated caseload affecting standard SLA times.
                </p>
              </div>
              
              {/* Severity breakdown */}
              <div className="bg-bg-surface rounded-xl border border-border-default hover:border-border-strong transition-colors flex flex-col">
                <div className="px-4 py-3 border-b border-border-default">
                  <p className="text-xs font-semibold tracking-wider text-text-secondary uppercase">Severity Distribution</p>
                </div>
                <div className="flex flex-col">
                  {[
                    { label: 'Critical', count: criticalCount, color: 'bg-severity-critical', text: 'text-severity-critical' },
                    { label: 'Escalated', count: escalatedCount, color: 'bg-severity-high', text: 'text-severity-high' },
                    { label: 'Resolved', count: cases?.filter(c => c.status === 'resolved').length ?? 0, color: 'bg-severity-low', text: 'text-severity-low' },
                  ].map((s, i) => (
                    <div key={s.label} className="flex items-center justify-between px-4 py-2.5 border-b border-border-default last:border-0 hover:bg-bg-surface-2 transition-colors">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-2 h-2 rounded-full ${s.color}`} />
                        <span className="text-xs text-text-primary">{s.label}</span>
                      </div>
                      <span className={`text-xs font-bold font-mono ${s.text}`}>{s.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Mini map placeholder with grid */}
        <div className="px-4 py-4 flex-1 flex flex-col">
          <div 
            onClick={() => navigate('/geo')}
            className="flex-1 min-h-[128px] relative bg-bg-surface border border-border-default hover:border-brand-500 hover:shadow-[0_0_0_2px_rgba(59,130,246,0.15)] rounded-xl cursor-pointer transition-all overflow-hidden group scan-overlay"
          >
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 z-10 bg-bg-canvas/40 backdrop-blur-[2px] group-hover:bg-brand-500/10 group-hover:backdrop-blur-0 transition-all">
              <MapPin className="w-5 h-5 text-text-secondary group-hover:text-brand-500 transition-colors" />
              <span className="text-xs font-semibold tracking-wide text-text-primary">Live Threat Topography</span>
              <span className="text-[10px] text-text-tertiary group-hover:text-brand-400 transition-colors">View Map &rarr;</span>
            </div>
            <div className="absolute inset-0 opacity-[0.06] group-hover:opacity-[0.12] transition-opacity"
              style={{ backgroundImage: 'linear-gradient(#3B82F6 1px, transparent 1px), linear-gradient(90deg, #3B82F6 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
          </div>
        </div>
      </div>
    </div>
  )
}
