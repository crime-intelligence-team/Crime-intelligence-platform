import { useState } from 'react'
import { Plus, X, Loader2, Shield, ShieldAlert } from 'lucide-react'
import { useApi } from '../hooks/useApi'
import { useAuth } from '../context/AuthContext'
import { redactionsApi } from '../services/endpoints'
import { ApiError } from '../services/client'
import { Button } from '../components/ui/Button'
import { SkeletonRow } from '../components/ui/Skeletons'
import type { ClassificationLevel, RedactionPolicyResponse } from '@cip/shared-types'

const ENTITY_TYPES = ['note', 'case', 'entity', 'person', 'organization', 'vehicle', 'device', 'address']

const REDACTION_FIELDS: Record<string, string[]> = {
  note: ['body'],
  case: ['summary'],
  entity: ['label'],
  person: ['aliases', 'date_of_birth'],
  organization: ['org_type'],
  vehicle: ['registration_number', 'make', 'model', 'color'],
  device: ['phone_number', 'imei', 'device_type'],
  address: ['raw_text'],
}

const CLASSIFICATIONS: { value: ClassificationLevel; label: string }[] = [
  { value: 'open_operational', label: 'Open Operational' },
  { value: 'restricted_operational', label: 'Restricted Operational' },
  { value: 'protected', label: 'Protected' },
  { value: 'sealed', label: 'Sealed' },
]

const classificationPill: Record<string, string> = {
  open_operational: 'bg-severity-tint-low text-severity-low border-severity-low/30',
  restricted_operational: 'bg-severity-tint-info text-severity-info border-severity-info/30',
  protected: 'bg-severity-tint-high text-severity-high border-severity-high/30',
  sealed: 'bg-severity-tint-critical text-severity-critical border-severity-critical/30',
}

// ── Create policy modal ───────────────────────────────────────────────────────
function CreatePolicyModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [entityType, setEntityType] = useState('note')
  const [field, setField] = useState('body')
  const [minClass, setMinClass] = useState<ClassificationLevel>('protected')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fields = REDACTION_FIELDS[entityType] ?? []

  const inputCls = 'w-full bg-surface-raised border border-surface-border rounded-lg px-3 py-2 text-sm text-sentinel-100 focus:outline-none focus:border-accent-blue/40 transition-colors'
  const labelCls = 'block text-[11px] uppercase font-semibold tracking-wider text-sentinel-500 mb-1.5'

  async function handleSubmit() {
    setSubmitting(true)
    setError(null)
    try {
      await redactionsApi.createPolicy({ entity_type: entityType, field, min_classification: minClass, reason })
      onCreated()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Policy creation failed')
      setSubmitting(false)
    }
  }

  return (
    <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-[460px] bg-surface-raised border border-surface-border rounded-xl shadow-2xl p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-sentinel-100">Create Redaction Policy</h2>
          <button onClick={onClose} className="p-1 rounded text-sentinel-500 hover:text-sentinel-200"><X className="w-4 h-4" /></button>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Entity Type</label>
              <select value={entityType} onChange={e => { setEntityType(e.target.value); setField(REDACTION_FIELDS[e.target.value]?.[0] ?? '') }} className={inputCls}>
                {ENTITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Field</label>
              <select value={field} onChange={e => setField(e.target.value)} className={inputCls}>
                {fields.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>Minimum Classification</label>
            <select value={minClass} onChange={e => setMinClass(e.target.value as ClassificationLevel)} className={inputCls}>
              {CLASSIFICATIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            <p className="text-[10px] text-sentinel-500 mt-1">Fires when the target record's classification is at or above this tier.</p>
          </div>
          <div>
            <label className={labelCls}>Reason</label>
            <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} placeholder="Why this field must be redacted on export"
              className={`${inputCls} resize-none`} />
          </div>
          {error && <p className="text-xs text-severity-critical bg-severity-critical/10 border border-severity-critical/30 rounded-md px-3 py-2">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button onClick={onClose}>Cancel</Button>
            <Button variant="primary" onClick={handleSubmit} disabled={submitting || !reason.trim()}>
              {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Create Policy'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function GovernanceSecurity() {
  const { hasPermission } = useAuth()
  const canManage = hasPermission('redaction:manage')

  const { data: page, loading, error, refetch } = useApi(() => redactionsApi.policies())
  const policies = page?.items ?? []

  const [showCreate, setShowCreate] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  async function handleDeactivate(p: RedactionPolicyResponse) {
    setBusyId(p.id)
    setActionError(null)
    try {
      await redactionsApi.deactivatePolicy(p.id)
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
            Redaction policy management requires the redaction:manage permission (administrator clearance).
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative h-full overflow-y-auto bg-surface-base">
      <div className="max-w-[1200px] mx-auto px-6 py-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-sentinel-50 flex items-center gap-2">
              <Shield className="w-4 h-4 text-accent-blue" /> Redaction Policies
            </h1>
            <p className="text-xs text-sentinel-400 mt-0.5">Export-time redaction rules applied to shared case and entity data</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-accent-blue text-white rounded-lg text-xs font-semibold hover:bg-accent-blue/90 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Create Policy
          </button>
        </div>

        {actionError && (
          <div className="mb-4 text-xs text-severity-critical bg-severity-critical/10 border border-severity-critical/30 rounded-lg px-4 py-2.5">{actionError}</div>
        )}

        {/* Table */}
        <div className="bg-surface-card border border-surface-border rounded-xl overflow-hidden">
          <div className="grid px-4 py-2.5 border-b border-surface-border text-[10px] font-semibold tracking-widest text-sentinel-500 uppercase"
            style={{ gridTemplateColumns: '200px 120px 160px 1fr 90px 110px' }}>
            <span>Target</span><span>Decision</span><span>Min Classification</span><span>Reason</span><span>Status</span><span className="text-right">Actions</span>
          </div>

          <div className="divide-y divide-surface-border">
            {loading && Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)}
            {!loading && error && (
              <div className="px-4 py-10 text-center text-xs text-severity-critical">Failed to load policies: {error}</div>
            )}
            {!loading && !error && policies.length === 0 && (
              <div className="px-4 py-10 text-center text-xs text-sentinel-500">No redaction policies defined yet.</div>
            )}
            {policies.map(p => (
              <div key={p.id} className="grid px-4 py-3 items-center hover:bg-surface-hover/50 transition-colors"
                style={{ gridTemplateColumns: '200px 120px 160px 1fr 90px 110px' }}>
                <span className="font-mono text-[11px] text-sentinel-100">{p.entity_type}.{p.field}</span>
                <span className="text-xs text-sentinel-300 uppercase">{p.decision}</span>
                <span className={`inline-flex w-fit items-center px-2 py-0.5 rounded-sm border text-[9px] font-semibold tracking-wider ${classificationPill[p.min_classification] ?? ''}`}>
                  {p.min_classification.replace(/_/g, ' ').toUpperCase()}
                </span>
                <span className="text-xs text-sentinel-300 truncate pr-2" title={p.reason}>{p.reason}</span>
                <span className={`text-[10px] font-bold tracking-wider ${p.active ? 'text-severity-low' : 'text-sentinel-500'}`}>
                  {p.active ? 'ACTIVE' : 'INACTIVE'}
                </span>
                <div className="flex justify-end">
                  {p.active ? (
                    <button
                      onClick={() => handleDeactivate(p)}
                      disabled={busyId === p.id}
                      className="px-2.5 py-1.5 rounded text-[10px] font-semibold text-severity-critical bg-severity-tint-critical border border-severity-critical/30 hover:bg-severity-critical/20 transition-colors disabled:opacity-50"
                    >
                      {busyId === p.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Deactivate'}
                    </button>
                  ) : (
                    <span className="text-[10px] text-sentinel-600">—</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showCreate && <CreatePolicyModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); refetch() }} />}
    </div>
  )
}
