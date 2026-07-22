import { useNavigate } from 'react-router-dom'
import { Filter, ArrowUpDown, Pin, CheckCircle, AlertCircle, Clock, BarChart3, MapPin } from 'lucide-react'
import { SeverityBadge, CategoryBadge, StatusDot } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { ProgressBar } from '../components/ui/ProgressBar'
import { SkeletonRow, SkeletonCard } from '../components/ui/Skeletons'
import { useApi } from '../hooks/useApi'
import { useActiveCase } from '../context/AppContext'
import { casesApi } from '../services/api'
import type { Case } from '../types'

const statusConfig = {
  in_progress: { label: 'In Progress',  icon: Clock,         color: 'text-accent-amber'    },
  open:        { label: 'Open',         icon: AlertCircle,   color: 'text-sentinel-300'     },
  resolved:    { label: 'Resolved',     icon: CheckCircle,   color: 'text-accent-emerald'   },
  escalated:   { label: 'Escalated',    icon: AlertCircle,   color: 'text-severity-critical' },
}

function CaseRow({ c, isActive, onClick }: { c: Case; isActive: boolean; onClick: () => void }) {
  const sc = statusConfig[c.status]
  const StatusIcon = sc.icon
  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-4 px-5 py-3.5 border-b border-surface-border cursor-pointer transition-colors group ${
        isActive ? 'bg-accent-blue/5 border-l-2 border-l-accent-blue' : 'hover:bg-surface-hover'
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
      <Pin className="w-3.5 h-3.5 text-sentinel-600 group-hover:text-sentinel-400 transition-colors shrink-0" />
    </div>
  )
}

export default function CaseWorkspace() {
  const navigate = useNavigate()
  const { activeCaseId, setActiveCase } = useActiveCase()
  const { data: cases, loading, error, refetch } = useApi(casesApi.list)

  function handleCaseClick(c: Case) {
    setActiveCase(c.id)
    navigate(`/cases/${c.id}`)
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left — investigation list */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-surface-border shrink-0 flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-sentinel-50">Active Investigations</h1>
            <p className="text-xs text-sentinel-400 mt-0.5">
              Monitoring {cases?.length ?? '—'} ongoing cases across global sectors.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm"><Filter className="w-3.5 h-3.5" /> Filter</Button>
            <Button variant="secondary" size="sm"><ArrowUpDown className="w-3.5 h-3.5" /> Sort</Button>
            <Button variant="secondary" size="sm" onClick={refetch}>↻ Refresh</Button>
          </div>
        </div>

        {/* Table header */}
        <div className="px-5 py-2.5 border-b border-surface-border bg-surface-raised/50 shrink-0">
          <div className="flex items-center gap-4 text-[10px] font-semibold tracking-widest text-sentinel-500 uppercase">
            <span className="w-2" />
            <span className="flex-1">Case</span>
            <span className="w-24 text-right">Status</span>
            <span className="w-28 text-right">Assigned</span>
            <span className="w-4" />
          </div>
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto">
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
            <BarChart3 className="w-4 h-4 text-sentinel-400" />
            <h2 className="text-sm font-semibold text-sentinel-100">Case Summary</h2>
          </div>

          {loading ? (
            <div className="space-y-2">
              <SkeletonCard height="h-16" />
              <SkeletonCard height="h-16" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2 mb-4">
                <div className="bg-surface-card rounded-lg p-3 border border-surface-border">
                  <p className="section-label mb-1">Active Volume</p>
                  <p className="text-2xl font-bold text-sentinel-50">{cases?.length ?? 0}</p>
                </div>
                <div className="bg-surface-card rounded-lg p-3 border border-surface-border">
                  <p className="section-label mb-1">Avg Resolution</p>
                  <p className="text-2xl font-bold text-sentinel-50">1.2<span className="text-sm text-sentinel-400">h</span></p>
                </div>
              </div>
              <div className="bg-surface-card rounded-lg p-3 border border-surface-border">
                <div className="flex items-center justify-between mb-2">
                  <p className="section-label">Investigation Health</p>
                  <span className="text-[10px] font-medium text-accent-amber">Sub-Optimal</span>
                </div>
                <ProgressBar value={78} color="amber" showValue={false} />
                <p className="text-[10px] text-sentinel-400 mt-2 leading-relaxed">
                  Elevated caseload affecting standard SLA times.
                </p>
              </div>
            </>
          )}
        </div>

        {/* Mini map placeholder */}
        <div className="flex-1 relative bg-surface-base">
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sentinel-500">
            <MapPin className="w-6 h-6" />
            <span className="text-xs tracking-wide">Live Threat Topography</span>
          </div>
          <div className="absolute inset-0 opacity-10"
            style={{ backgroundImage: 'linear-gradient(#1e293b 1px, transparent 1px), linear-gradient(90deg, #1e293b 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        </div>
      </div>
    </div>
  )
}
