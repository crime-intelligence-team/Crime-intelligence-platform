import { useEffect, useState } from 'react'
import { Plus, X, Loader2, Archive, ShieldAlert, ChevronDown, ChevronUp } from 'lucide-react'
import { useApi } from '../hooks/useApi'
import { useAuth } from '../context/AuthContext'
import { retentionApi } from '../services/endpoints'
import { ApiError } from '../services/client'
import { Button } from '../components/ui/Button'
import { SkeletonRow } from '../components/ui/Skeletons'
import type { RetentionCandidate, RetentionPolicyResponse } from '@cip/shared-types'

const ENTITY_TYPES = [
  { value: 'case', label: 'Case' },
  { value: 'note', label: 'Note' },
  { value: 'person', label: 'Person' },
  { value: 'organization', label: 'Organization' },
  { value: 'vehicle', label: 'Vehicle' },
  { value: 'device', label: 'Device' },
  { value: 'address', label: 'Address' },
]

const entityTypeLabel: Record<string, string> = Object.fromEntries(ENTITY_TYPES.map(t => [t.value, t.label]))

const inputCls = 'w-full bg-surface-raised border border-surface-border rounded-lg px-3 py-2 text-sm text-sentinel-100 focus:outline-none focus:border-accent-blue/40 transition-colors'
const labelCls = 'block text-[11px] uppercase font-semibold tracking-wider text-sentinel-500 mb-1.5'

// ── Define policy modal ─────────────────────────────────────────────────────
function DefinePolicyModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [entityType, setEntityType] = useState(ENTITY_TYPES[0].value)
  const [retentionDays, setRetentionDays] = useState('2555')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    setSubmitting(true)
    setError(null)
    try {
      await retentionApi.create({
        entity_type: entityType,
        retention_days: parseInt(retentionDays, 10),
        reason: reason.trim(),
      })
      onCreated()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to define retention policy')
      setSubmitting(false)
    }
  }

  const days = parseInt(retentionDays, 10)
  const valid = Number.isFinite(days) && days > 0 && reason.trim().length > 0

  return (
    <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-[460px] bg-surface-raised border border-surface-border rounded-xl shadow-2xl p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-sentinel-100">Define Retention Policy</h2>
          <button onClick={onClose} className="p-1 rounded text-sentinel-500 hover:text-sentinel-200"><X className="w-4 h-4" /></button>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Entity Type</label>
              <select value={entityType} onChange={e => setEntityType(e.target.value)} className={inputCls}>
                {ENTITY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Retention (days)</label>
              <input type="number" min={1} value={retentionDays} onChange={e => setRetentionDays(e.target.value)}
                className={inputCls} />
            </div>
          </div>
          {entityType === 'case' && (
            <p className="text-[10px] text-sentinel-500 -mt-2">Only closed cases are ever eligible, regardless of age.</p>
          )}
          <div>
            <label className={labelCls}>Reason</label>
            <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2}
              placeholder="Policy basis / authority for this retention window"
              className={`${inputCls} resize-none`} />
          </div>
          <p className="text-[10px] text-sentinel-500 leading-relaxed">
            Flag-only: this defines a candidate list for review. Nothing is ever deleted or
            archived automatically.
          </p>
          {error && <p className="text-xs text-severity-critical bg-severity-critical/10 border border-severity-critical/30 rounded-md px-3 py-2">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button onClick={onClose}>Cancel</Button>
            <Button variant="primary" onClick={handleSubmit} disabled={submitting || !valid}>
              {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Define Policy'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Candidates row ────────────────────────────────────────────────────────────
function CandidatesPanel({ policyId }: { policyId: string }) {
  const [candidates, setCandidates] = useState<RetentionCandidate[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    retentionApi.candidates(policyId)
      .then(page => setCandidates(page.items))
      .catch(e => setError(e instanceof ApiError ? e.message : 'Failed to load candidates'))
      .finally(() => setLoading(false))
  }, [policyId])

  return (
    <div className="col-span-full bg-surface-base border-t border-surface-border px-4 py-3">
      {loading && <p className="text-xs text-sentinel-500">Loading candidates…</p>}
      {!loading && error && <p className="text-xs text-severity-critical">{error}</p>}
      {!loading && !error && candidates && candidates.length === 0 && (
        <p className="text-xs text-sentinel-500">No records currently past this policy's retention window.</p>
      )}
      {!loading && !error && candidates && candidates.length > 0 && (
        <div className="space-y-1 max-h-56 overflow-y-auto">
          {candidates.map(c => (
            <div key={c.id} className="flex items-center justify-between text-xs px-2 py-1.5 rounded bg-surface-raised">
              <span className="text-sentinel-200 truncate">{c.label}</span>
              <span className="text-sentinel-500 font-mono shrink-0 ml-3">{c.age_days}d old</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function GovernanceRetention() {
  const { hasPermission } = useAuth()
  const canManage = hasPermission('system:configure')

  const { data: page, loading, error, refetch } = useApi(() => retentionApi.list())
  const policies = page?.items ?? []

  const [showCreate, setShowCreate] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  async function handleDeactivate(p: RetentionPolicyResponse) {
    setBusyId(p.id)
    setActionError(null)
    try {
      await retentionApi.deactivate(p.id)
      refetch()
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : 'Deactivation failed')
    } finally {
      setBusyId(null)
    }
  }

  if (!canManage) {
    return (
      <div className="h-full flex items-center justify-center bg-surface-base">
        <div className="max-w-sm text-center p-8 bg-surface-card border border-surface-border rounded-xl">
          <ShieldAlert className="w-6 h-6 text-accent-amber mx-auto mb-3" />
          <p className="text-sm font-semibold text-sentinel-100">Administrator Only</p>
          <p className="text-xs text-sentinel-400 mt-1.5 leading-relaxed">
            Retention policy management requires the system:configure permission (administrator clearance).
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative h-full overflow-y-auto bg-surface-base">
      <div className="max-w-[1200px] mx-auto px-6 py-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-sentinel-50 flex items-center gap-2">
              <Archive className="w-4 h-4 text-accent-blue" /> Retention Policies
            </h1>
            <p className="text-xs text-sentinel-400 mt-0.5 max-w-2xl">
              Flag-only: defines how long a record may age before it's surfaced as retention-eligible.
              Nothing is ever deleted or archived automatically — a human reviews each policy's
              candidate list and decides what to do outside this system.
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-accent-blue text-white rounded-lg text-xs font-semibold hover:bg-accent-blue/90 transition-colors shrink-0"
          >
            <Plus className="w-3.5 h-3.5" /> Define Policy
          </button>
        </div>

        {actionError && (
          <div className="mb-4 text-xs text-severity-critical bg-severity-critical/10 border border-severity-critical/30 rounded-lg px-4 py-2.5">{actionError}</div>
        )}

        <div className="bg-surface-card border border-surface-border rounded-xl overflow-hidden">
          <div className="grid px-4 py-2.5 border-b border-surface-border text-[10px] font-semibold tracking-widest text-sentinel-500 uppercase"
            style={{ gridTemplateColumns: '1fr 130px 110px 90px 160px' }}>
            <span>Entity Type</span><span>Retention</span><span>Candidates</span><span>Status</span><span className="text-right">Actions</span>
          </div>

          <div className="divide-y divide-surface-border">
            {loading && Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)}
            {!loading && error && (
              <div className="px-4 py-10 text-center text-xs text-severity-critical">Failed to load retention policies: {error}</div>
            )}
            {!loading && !error && policies.length === 0 && (
              <div className="px-4 py-10 text-center text-xs text-sentinel-500">No retention policies defined yet.</div>
            )}
            {policies.map(p => (
              <div key={p.id} className="grid grid-cols-1">
                <div className="grid px-4 py-3 items-center hover:bg-surface-hover/50 transition-colors"
                  style={{ gridTemplateColumns: '1fr 130px 110px 90px 160px' }}>
                  <div className="min-w-0">
                    <p className="text-sm text-sentinel-100">{entityTypeLabel[p.entity_type] ?? p.entity_type}</p>
                    <p className="text-[11px] text-sentinel-500 truncate" title={p.reason}>{p.reason}</p>
                  </div>
                  <span className="text-xs text-sentinel-300">{p.retention_days.toLocaleString()} days</span>
                  <span className="text-xs font-mono text-sentinel-200">{p.candidate_count.toLocaleString()}</span>
                  <span className={`text-[10px] font-bold tracking-wider ${p.active ? 'text-severity-low' : 'text-sentinel-500'}`}>
                    {p.active ? 'ACTIVE' : 'INACTIVE'}
                  </span>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded text-[10px] font-semibold text-sentinel-300 bg-surface-raised border border-surface-border hover:text-sentinel-100 transition-colors"
                    >
                      {expandedId === p.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      Candidates
                    </button>
                    {p.active && (
                      <button
                        onClick={() => handleDeactivate(p)}
                        disabled={busyId === p.id}
                        className="px-2.5 py-1.5 rounded text-[10px] font-semibold text-severity-critical bg-severity-tint-critical border border-severity-critical/30 hover:bg-severity-critical/20 transition-colors disabled:opacity-50"
                      >
                        {busyId === p.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Deactivate'}
                      </button>
                    )}
                  </div>
                </div>
                {expandedId === p.id && <CandidatesPanel policyId={p.id} />}
              </div>
            ))}
          </div>
        </div>
      </div>

      {showCreate && <DefinePolicyModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); refetch() }} />}
    </div>
  )
}
