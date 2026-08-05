import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Filter, ArrowUpDown, Pin, CheckCircle, AlertCircle, Clock, BarChart3, MapPin, Plus, X } from 'lucide-react'
import { StatusDot } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { SkeletonRow, SkeletonCard } from '../components/ui/Skeletons'
import { useApi } from '../hooks/useApi'
import { useActiveCase } from '../context/AppContext'
import { casesApi, mapApi } from '../services/endpoints'
import { ApiError } from '../services/client'
import type { CaseSummary, ClassificationLevel } from '@cip/shared-types'

const statusConfig: Record<string, { label: string; icon: any; color: string }> = {
  open:                 { label: 'Open',                icon: AlertCircle, color: 'text-accent-blue' },
  under_investigation:  { label: 'Under Investigation',  icon: Clock,       color: 'text-severity-medium' },
  pending_review:       { label: 'Pending Review',       icon: Clock,       color: 'text-severity-high' },
  closed:               { label: 'Closed',               icon: CheckCircle, color: 'text-severity-low' },
}
const STATUS_ORDER = ['open', 'under_investigation', 'pending_review', 'closed'] as const

const classificationPill: Record<string, string> = {
  open_operational: 'bg-severity-tint-low text-severity-low border-severity-low/30',
  restricted_operational: 'bg-severity-tint-info text-severity-info border-severity-info/30',
  protected: 'bg-severity-tint-high text-severity-high border-severity-high/30',
  sealed: 'bg-severity-tint-critical text-severity-critical border-severity-critical/30',
}
const classificationLabel: Record<string, string> = {
  open_operational: 'OPEN OPERATIONAL',
  restricted_operational: 'RESTRICTED OPERATIONAL',
  protected: 'PROTECTED',
  sealed: 'SEALED',
}
const CLASSIFICATIONS: ClassificationLevel[] = ['open_operational', 'restricted_operational', 'protected', 'sealed']

function ClassificationBadge({ level }: { level: ClassificationLevel }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-sm border text-[10px] font-semibold tracking-wider ${classificationPill[level] ?? ''}`}>
      {classificationLabel[level] ?? level}
    </span>
  )
}

function CaseRow({ c, isActive, onClick }: { c: CaseSummary; isActive: boolean; onClick: () => void }) {
  const sc = statusConfig[c.status] ?? { label: c.status, icon: Clock, color: 'text-text-tertiary' }
  const StatusIcon = sc.icon
  return (
    <div
      onClick={onClick}
      className={`grid grid-cols-[16px_120px_1fr_110px_170px_120px_28px] gap-4 items-center px-5 py-3.5 border-b border-border-default cursor-pointer transition-all duration-150 group ${
        isActive ? 'bg-brand-500/5' : 'hover:bg-bg-surface-2 hover:translate-x-0.5'
      }`}
    >
      <StatusDot status={c.status !== 'closed' ? 'active' : 'normal'} />
      <span className="font-mono text-[11px] text-text-tertiary whitespace-nowrap">{c.case_number}</span>
      <span className="text-sm font-medium text-text-primary truncate" title={c.title}>{c.title}</span>
      <div className="flex items-center gap-1.5 text-xs truncate">
        <StatusIcon className={`w-3.5 h-3.5 shrink-0 ${sc.color}`} />
        <span className={`capitalize ${sc.color}`}>{sc.label}</span>
      </div>
      <div className="overflow-hidden min-w-0"><ClassificationBadge level={c.classification} /></div>
      <div className="text-[11px] text-text-tertiary truncate">
        {c.created_at ? new Date(c.created_at).toLocaleDateString() : '—'}
      </div>
      <div className="flex justify-end p-1 rounded hover:bg-bg-surface-hover transition-colors">
        <Pin className="w-3.5 h-3.5 text-text-disabled group-hover:text-brand-500 transition-colors" />
      </div>
    </div>
  )
}

function SummaryMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-bg-surface rounded-xl p-3.5 border border-border-default hover:border-border-strong transition-colors">
      <p className="section-label mb-1.5">{label}</p>
      <p className="text-2xl font-bold text-text-primary animate-count-up">
        {value}
      </p>
    </div>
  )
}

// ── Create Case modal ─────────────────────────────────────────────────────────
function CreateCaseModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [caseNumber, setCaseNumber] = useState('')
  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [classification, setClassification] = useState<ClassificationLevel>('restricted_operational')
  const [districtId, setDistrictId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { data: districtPage } = useApi(() => mapApi.districts())
  const districts = districtPage?.items ?? []

  async function handleSubmit() {
    setSubmitting(true)
    setError(null)
    try {
      const created = await casesApi.create({
        case_number: caseNumber,
        title,
        summary: summary || null,
        classification,
        district_id: districtId,
      })
      onCreated(created.id)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to create case')
      setSubmitting(false)
    }
  }

  const inputCls = 'w-full bg-bg-surface-2 border border-border-default rounded-md px-3 py-2 text-sm text-text-primary placeholder-text-tertiary focus:outline-none focus:border-brand-500/50 transition-colors'
  const labelCls = 'block text-[11px] uppercase font-semibold tracking-wider text-text-secondary mb-1.5'

  return (
    <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-[440px] bg-bg-elevated border border-border-default rounded-xl shadow-2xl p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-text-primary">New Case</h2>
          <button onClick={onClose} className="p-1 rounded text-text-tertiary hover:text-text-primary transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className={labelCls}>Case Number</label>
            <input value={caseNumber} onChange={e => setCaseNumber(e.target.value)} placeholder="e.g. CR-2026-0042"
              className={inputCls} />
            <p className="text-[10px] text-text-tertiary mt-1">3–32 letters, digits, or hyphens</p>
          </div>

          <div>
            <label className={labelCls}>Title</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Short investigation title"
              className={inputCls} />
          </div>

          <div>
            <label className={labelCls}>Summary (optional)</label>
            <textarea value={summary} onChange={e => setSummary(e.target.value)} rows={3}
              placeholder="Brief context for the investigation"
              className={`${inputCls} resize-none`} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>District</label>
              <select value={districtId} onChange={e => setDistrictId(e.target.value)} className={inputCls}>
                <option value="">Select district…</option>
                {districts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Classification</label>
              <select value={classification} onChange={e => setClassification(e.target.value as ClassificationLevel)} className={inputCls}>
                {CLASSIFICATIONS.map(c => <option key={c} value={c}>{classificationLabel[c]}</option>)}
              </select>
            </div>
          </div>

          {error && <p className="text-xs text-severity-critical bg-severity-tint-critical/30 border border-severity-critical/30 rounded-md px-3 py-2">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button variant="primary" onClick={handleSubmit} disabled={submitting || !caseNumber.trim() || !title.trim() || !districtId}>
              {submitting ? 'Creating…' : 'Create Case'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function CaseWorkspace() {
  const navigate = useNavigate()
  const { activeCaseId, setActiveCase } = useActiveCase()
  const [showCreate, setShowCreate] = useState(false)
  const { data: page, loading, error, refetch } = useApi(() => casesApi.list())
  const cases = page?.items ?? []

  // "Open" here means not yet closed (matches the backend KPI: open,
  // under_investigation and pending_review are all still active work).
  const openCount = cases.filter(c => c.status !== 'closed').length
  const closedCount = cases.filter(c => c.status === 'closed').length
  const statusCounts = Object.fromEntries(
    STATUS_ORDER.map(s => [s, cases.filter(c => c.status === s).length])
  ) as Record<typeof STATUS_ORDER[number], number>

  function handleCaseClick(c: CaseSummary) {
    setActiveCase(c.id)
    navigate(`/cases/${c.id}`)
  }

  function handleCreated(id: string) {
    setShowCreate(false)
    setActiveCase(id)
    refetch()
    navigate(`/cases/${id}`)
  }

  return (
    <div className="relative flex h-full overflow-hidden">
      {/* Left — investigation list */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border-default shrink-0 flex items-start justify-between bg-bg-surface-2/30">
          <div>
            <h1 className="text-xl font-bold text-text-primary flex items-center gap-3">
              Active Investigations
              {openCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-severity-tint-high border border-severity-high/30 text-severity-high text-xs font-bold">
                  {openCount} Open
                </span>
              )}
            </h1>
            <p className="text-xs text-text-tertiary mt-0.5">
              Monitoring <span className="text-text-secondary font-medium">{cases.length}</span> cases
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm"><Filter className="w-3.5 h-3.5" /> Filter</Button>
            <Button variant="secondary" size="sm"><ArrowUpDown className="w-3.5 h-3.5" /> Sort</Button>
            <Button variant="secondary" size="sm" onClick={refetch}>↻ Refresh</Button>
            <Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>
              <Plus className="w-3.5 h-3.5" /> New Case
            </Button>
          </div>
        </div>

        {/* Table header */}
        <div className="px-5 py-2.5 border-b border-border-default bg-bg-surface-2/60 shrink-0">
          <div className="grid grid-cols-[16px_120px_1fr_110px_170px_120px_28px] gap-4 items-center text-[10px] font-semibold tracking-widest text-text-tertiary uppercase">
            <span></span>
            <span>Case #</span>
            <span>Title</span>
            <span>Status</span>
            <span>Classification</span>
            <span>Created</span>
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
          {!loading && !error && cases.length === 0 && (
            <div className="flex flex-col items-center justify-center h-48 gap-2 text-text-tertiary">
              <p className="text-sm">No cases recorded yet.</p>
              <Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>
                <Plus className="w-3.5 h-3.5" /> Create the first case
              </Button>
            </div>
          )}
          {cases.map(c => (
            <CaseRow
              key={c.id}
              c={c}
              isActive={activeCaseId === c.id}
              onClick={() => handleCaseClick(c)}
            />
          ))}
          {cases.length > 0 && (
            <div className="flex justify-center py-8">
              <span className="px-4 py-1.5 rounded-full bg-bg-surface-2 border border-border-default text-[10px] tracking-widest text-text-tertiary uppercase">
                Showing {cases.length} of {page?.total ?? cases.length} cases
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
                <SummaryMetric label="Total Cases" value={cases.length} />
                <SummaryMetric label="Open" value={openCount} />
              </div>

              {/* Status distribution */}
              <div className="bg-bg-surface rounded-xl border border-border-default hover:border-border-strong transition-colors flex flex-col">
                <div className="px-4 py-3 border-b border-border-default">
                  <p className="text-xs font-semibold tracking-wider text-text-secondary uppercase">Status Distribution</p>
                </div>
                <div className="flex flex-col">
                  {[
                    { label: 'Open', count: statusCounts.open, color: 'bg-accent-blue', text: 'text-accent-blue' },
                    { label: 'Under Investigation', count: statusCounts.under_investigation, color: 'bg-severity-medium', text: 'text-severity-medium' },
                    { label: 'Pending Review', count: statusCounts.pending_review, color: 'bg-severity-high', text: 'text-severity-high' },
                    { label: 'Closed', count: closedCount, color: 'bg-severity-low', text: 'text-severity-low' },
                  ].map(s => (
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
            onClick={() => navigate('/map')}
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

      {/* Create case modal */}
      {showCreate && <CreateCaseModal onClose={() => setShowCreate(false)} onCreated={handleCreated} />}
    </div>
  )
}
