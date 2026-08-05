import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { AlertTriangle, Lock, Send, X, FileText, MapPin, Shield, User, MessageSquare, Loader2 } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { StepUpModal } from '../components/ui/StepUpModal'
import { useApi } from '../hooks/useApi'
import { useAuth } from '../context/AuthContext'
import { casesApi, mapApi } from '../services/endpoints'
import { ApiError } from '../services/client'
import type { RedactedField } from '@cip/shared-types'

function fieldText(v: string | RedactedField | null | undefined): string {
  if (v == null) return '—'
  if (typeof v === 'object' && 'redacted' in v) return `[REDACTED — ${v.reason.replace('_', ' ')}]`
  return v
}

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

const statusConfig: Record<string, { label: string; color: string }> = {
  open: { label: 'Open', color: 'text-accent-blue' },
  under_investigation: { label: 'Under Investigation', color: 'text-severity-medium' },
  pending_review: { label: 'Pending Review', color: 'text-severity-high' },
  closed: { label: 'Closed', color: 'text-severity-low' },
}
const STATUS_OPTIONS = ['open', 'under_investigation', 'pending_review', 'closed'] as const

// ── Page ──────────────────────────────────────────────────────────────────────
export default function CaseDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [input, setInput] = useState('')
  const [submittingNote, setSubmittingNote] = useState(false)
  const [stepUp, setStepUp] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportId, setExportId] = useState<string | null>(null)
  const [updatingStatus, setUpdatingStatus] = useState(false)

  const { data: c, loading, error, refetch } = useApi(
    () => (id ? casesApi.byId(id) : Promise.resolve(null)),
    [id],
  )
  const { data: notesPage, refetch: refetchNotes } = useApi(
    () => (id ? casesApi.notes(id) : Promise.resolve(null)),
    [id],
  )
  const { data: districtPage } = useApi(() => mapApi.districts())
  const districts = districtPage?.items ?? []

  const notes = notesPage?.items ?? []
  const district = c?.district_id ? districts.find(d => d.id === c.district_id) : undefined

  async function handleAddNote() {
    if (!id || !input.trim()) return
    setSubmittingNote(true)
    try {
      await casesApi.addNote(id, { body: input.trim() })
      setInput('')
      refetchNotes()
    } finally {
      setSubmittingNote(false)
    }
  }

  async function handleStatusChange(next: string) {
    if (!id || next === c?.status) return
    setUpdatingStatus(true)
    try {
      await casesApi.updateStatus(id, next)
      refetch()
    } finally {
      setUpdatingStatus(false)
    }
  }

  async function handleExport() {
    if (!id) return
    setExporting(true)
    setExportId(null)
    try {
      const res = await casesApi.export(id)
      setExportId(res.export_id)
    } catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.code === 'step_up_required')) {
        setStepUp(true)
      } else {
        setExportId(`error:${e instanceof Error ? e.message : 'export failed'}`)
      }
    } finally {
      setExporting(false)
    }
  }

  if (loading) {
    return <div className="flex h-full items-center justify-center text-sm text-sentinel-500 animate-pulse">Loading case…</div>
  }
  if (error || !c) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-sentinel-500">
        <p className="text-sm">Case not found.</p>
        <Button variant="secondary" size="sm" onClick={() => navigate('/cases')}>← Back to cases</Button>
      </div>
    )
  }

  const sc = statusConfig[c.status] ?? { label: c.status, color: 'text-text-tertiary' }
  const orderedNotes = [...notes].sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime())

  return (
    <div className="relative flex h-full overflow-hidden">
      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto p-6 gap-4">
        {/* Case header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <span className={`inline-flex items-center px-2.5 py-1 rounded-sm border text-[10px] font-semibold tracking-wider ${classificationPill[c.classification] ?? ''}`}>
                {classificationLabel[c.classification] ?? c.classification}
              </span>
              <span className="font-mono text-[11px] text-sentinel-400">{c.case_number}</span>
              <span className={`text-[11px] font-medium flex items-center gap-1 ${sc.color}`}>
                <AlertTriangle className="w-3 h-3" />
                <select
                  value={c.status}
                  disabled={updatingStatus}
                  onChange={e => handleStatusChange(e.target.value)}
                  className={`bg-transparent border-none outline-none cursor-pointer ${sc.color}`}
                >
                  {STATUS_OPTIONS.map(s => (
                    <option key={s} value={s} className="bg-surface-card text-sentinel-100">
                      {statusConfig[s].label}
                    </option>
                  ))}
                </select>
              </span>
              {c.created_at && <span className="text-[11px] text-sentinel-500">• Created {new Date(c.created_at).toLocaleString()}</span>}
            </div>
            <h1 className="text-xl font-bold text-sentinel-50 leading-snug">{c.title}</h1>
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
            <Button variant="secondary" size="sm" onClick={() => setStepUp(true)}>
              <Lock className="w-3.5 h-3.5" /> Export Report
            </Button>
          </div>
        </div>

        {/* Case summary */}
        <div className="bg-surface-card border border-surface-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3 border-b border-surface-border pb-3">
            <FileText className="w-4 h-4 text-sentinel-400" />
            <h2 className="text-sm font-semibold text-sentinel-100">Case Summary</h2>
          </div>
          <p className="text-xs text-sentinel-300 leading-relaxed whitespace-pre-wrap">
            {fieldText(c.summary)}
          </p>
        </div>

        {/* Notes */}
        <div className="bg-surface-card border border-surface-border rounded-xl flex flex-col overflow-hidden" style={{ minHeight: 280 }}>
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-surface-border shrink-0">
            <MessageSquare className="w-4 h-4 text-sentinel-400" />
            <h2 className="text-sm font-semibold text-sentinel-100">Investigation Notes</h2>
            <span className="text-[10px] text-sentinel-500 ml-auto">{orderedNotes.length} notes</span>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {orderedNotes.length === 0 && (
              <p className="text-xs text-sentinel-500 text-center py-8">No notes recorded yet. Add the first note below.</p>
            )}
            {orderedNotes.map(n => (
              <div key={n.id} className="bg-surface-raised border border-surface-border rounded-lg px-4 py-3">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-[11px] font-semibold text-sentinel-200 flex items-center gap-1.5">
                    <User className="w-3 h-3 text-sentinel-400" />
                    {user?.full_name ?? n.author_id.slice(0, 8)}
                  </span>
                  <span className="font-mono text-[10px] text-sentinel-500">
                    {n.created_at ? new Date(n.created_at).toLocaleString() : '—'}
                    {n.finding_state ? ` · ${n.finding_state}` : ''}
                  </span>
                </div>
                <p className="text-xs text-sentinel-100 leading-relaxed whitespace-pre-wrap">{fieldText(n.body)}</p>
                {n.visibility && n.visibility !== 'standard' && (
                  <span className="mt-2 inline-block text-[9px] font-semibold tracking-wider text-sentinel-400 border border-surface-border rounded px-1.5 py-0.5 uppercase">
                    {n.visibility}
                  </span>
                )}
              </div>
            ))}
          </div>

          <div className="px-4 py-3 border-t border-surface-border flex items-center gap-2 shrink-0">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAddNote() }}
              placeholder="Add an investigation note…"
              className="flex-1 bg-surface-raised border border-surface-border rounded-lg px-3 py-2 text-xs text-sentinel-100 placeholder-sentinel-500 focus:outline-none focus:border-accent-blue/40 transition-colors"
            />
            <button
              onClick={handleAddNote}
              disabled={submittingNote || !input.trim()}
              className="p-2 rounded-lg bg-accent-blue text-white hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submittingNote ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {exportId && (
          <div className="bg-surface-card border border-surface-border rounded-lg px-4 py-3 text-xs">
            {exportId.startsWith('error:') ? (
              <span className="text-severity-critical">{exportId.slice(6)}</span>
            ) : (
              <span className="text-severity-low">Report export initiated. Export ID <span className="font-mono">{exportId}</span></span>
            )}
          </div>
        )}
      </div>

      {/* Right panel — case metadata */}
      <div className="w-[260px] shrink-0 border-l border-surface-border bg-surface-raised overflow-y-auto">
        <div className="px-4 py-4 border-b border-surface-border flex items-center justify-between">
          <h2 className="text-sm font-semibold text-sentinel-100 flex items-center gap-2">
            <Shield className="w-4 h-4 text-sentinel-400" /> Case Details
          </h2>
          <button onClick={() => navigate('/cases')} className="p-1 rounded text-sentinel-500 hover:text-sentinel-200 transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="px-4 py-4 space-y-4">
          <div>
            <p className="section-label mb-1">Status</p>
            <p className={`text-xs font-semibold ${sc.color}`}>{sc.label}</p>
          </div>
          <div>
            <p className="section-label mb-1">District</p>
            <p className="text-xs font-medium text-sentinel-100 flex items-center gap-1.5">
              <MapPin className="w-3 h-3 text-sentinel-400" />
              {district?.name ?? (c.district_id ? c.district_id.slice(0, 8) : '—')}
            </p>
          </div>
          <div>
            <p className="section-label mb-1">Classification</p>
            <p className="text-xs font-medium text-sentinel-100">{classificationLabel[c.classification] ?? c.classification}</p>
          </div>
          <div>
            <p className="section-label mb-1">Lead Officer</p>
            <p className="font-mono text-[11px] text-sentinel-300">{c.lead_officer_id ? c.lead_officer_id.slice(0, 8) : 'Unassigned'}</p>
          </div>

          <div className="pt-2 border-t border-surface-border">
            <Button variant="secondary" size="md" className="w-full" onClick={handleExport} disabled={exporting}>
              {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
              {exporting ? 'Exporting…' : 'Generate Report'}
            </Button>
          </div>
        </div>
      </div>

      {stepUp && (
        <StepUpModal
          title="Step-Up Authorization"
          onClose={() => setStepUp(false)}
          onSuccess={async () => {
            await handleExport()
          }}
        />
      )}
    </div>
  )
}
