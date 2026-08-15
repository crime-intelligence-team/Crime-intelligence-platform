import { useState } from 'react'
import { Plus, X, Loader2, Database, ShieldAlert } from 'lucide-react'
import { useApi } from '../hooks/useApi'
import { useAuth } from '../context/AuthContext'
import { dataSourcesApi } from '../services/endpoints'
import { ApiError } from '../services/client'
import { Button } from '../components/ui/Button'
import { SkeletonRow } from '../components/ui/Skeletons'
import type { DataSourceResponse } from '@cip/shared-types'

const SOURCE_TYPES = [
  { value: 'case_management', label: 'Case Management' },
  { value: 'sensor_feed', label: 'Sensor Feed' },
  { value: 'partner_agency', label: 'Partner Agency' },
  { value: 'manual_entry', label: 'Manual Entry' },
  { value: 'other', label: 'Other' },
]

const CADENCES = [
  { value: 'real_time', label: 'Real-time' },
  { value: 'hourly', label: 'Hourly' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'manual', label: 'Manual' },
]

const sourceTypeLabel: Record<string, string> = Object.fromEntries(SOURCE_TYPES.map(t => [t.value, t.label]))
const cadenceLabel: Record<string, string> = Object.fromEntries(CADENCES.map(c => [c.value, c.label]))

const inputCls = 'w-full bg-surface-raised border border-surface-border rounded-lg px-3 py-2 text-sm text-sentinel-100 focus:outline-none focus:border-accent-blue/40 transition-colors'
const labelCls = 'block text-[11px] uppercase font-semibold tracking-wider text-sentinel-500 mb-1.5'

// ── Register source modal ─────────────────────────────────────────────────────
function RegisterSourceModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('')
  const [sourceType, setSourceType] = useState(SOURCE_TYPES[0].value)
  const [owner, setOwner] = useState('')
  const [cadence, setCadence] = useState(CADENCES[0].value)
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    setSubmitting(true)
    setError(null)
    try {
      await dataSourcesApi.create({
        name: name.trim(),
        source_type: sourceType,
        owner: owner.trim(),
        cadence,
        description: description.trim() || null,
      })
      onCreated()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to register data source')
      setSubmitting(false)
    }
  }

  const valid = name.trim().length > 0 && owner.trim().length > 0

  return (
    <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-[460px] bg-surface-raised border border-surface-border rounded-xl shadow-2xl p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-sentinel-100">Register Data Source</h2>
          <button onClick={onClose} className="p-1 rounded text-sentinel-500 hover:text-sentinel-200"><X className="w-4 h-4" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className={labelCls}>Source Name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Regional CAD Feed"
              className={inputCls} />
            <p className="text-[10px] text-sentinel-500 mt-1">Must match the source_name value ingested records will carry.</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Type</label>
              <select value={sourceType} onChange={e => setSourceType(e.target.value)} className={inputCls}>
                {SOURCE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Cadence</label>
              <select value={cadence} onChange={e => setCadence(e.target.value)} className={inputCls}>
                {CADENCES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>Owner</label>
            <input value={owner} onChange={e => setOwner(e.target.value)} placeholder="Team or unit responsible"
              className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Description (optional)</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
              className={`${inputCls} resize-none`} />
          </div>
          {error && <p className="text-xs text-severity-critical bg-severity-critical/10 border border-severity-critical/30 rounded-md px-3 py-2">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button onClick={onClose}>Cancel</Button>
            <Button variant="primary" onClick={handleSubmit} disabled={submitting || !valid}>
              {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Register Source'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function GovernanceDataSources() {
  const { hasPermission } = useAuth()
  const canManage = hasPermission('system:configure')

  const { data: page, loading, error, refetch } = useApi(() => dataSourcesApi.list())
  const sources = page?.items ?? []

  const [showCreate, setShowCreate] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  async function handleDeactivate(s: DataSourceResponse) {
    setBusyId(s.id)
    setActionError(null)
    try {
      await dataSourcesApi.deactivate(s.id)
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
            Data source registry management requires the system:configure permission (administrator clearance).
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
              <Database className="w-4 h-4 text-accent-blue" /> Data Source Registry
            </h1>
            <p className="text-xs text-sentinel-400 mt-0.5">
              Provenance sources feeding ingested records — every case, person, organization, vehicle,
              device, and address stamps a source_name at ingestion; this catalogs what those are.
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-accent-blue text-white rounded-lg text-xs font-semibold hover:bg-accent-blue/90 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Register Source
          </button>
        </div>

        {actionError && (
          <div className="mb-4 text-xs text-severity-critical bg-severity-critical/10 border border-severity-critical/30 rounded-lg px-4 py-2.5">{actionError}</div>
        )}

        <div className="bg-surface-card border border-surface-border rounded-xl overflow-hidden">
          <div className="grid px-4 py-2.5 border-b border-surface-border text-[10px] font-semibold tracking-widest text-sentinel-500 uppercase"
            style={{ gridTemplateColumns: '1fr 150px 150px 120px 90px 90px 100px' }}>
            <span>Name</span><span>Type</span><span>Owner</span><span>Cadence</span><span>Records</span><span>Status</span><span className="text-right">Actions</span>
          </div>

          <div className="divide-y divide-surface-border">
            {loading && Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)}
            {!loading && error && (
              <div className="px-4 py-10 text-center text-xs text-severity-critical">Failed to load data sources: {error}</div>
            )}
            {!loading && !error && sources.length === 0 && (
              <div className="px-4 py-10 text-center text-xs text-sentinel-500">No data sources registered yet.</div>
            )}
            {sources.map(s => (
              <div key={s.id} className="grid px-4 py-3 items-center hover:bg-surface-hover/50 transition-colors"
                style={{ gridTemplateColumns: '1fr 150px 150px 120px 90px 90px 100px' }}>
                <div className="min-w-0">
                  <p className="text-sm text-sentinel-100 truncate">{s.name}</p>
                  {s.description && <p className="text-[11px] text-sentinel-500 truncate" title={s.description}>{s.description}</p>}
                </div>
                <span className="text-xs text-sentinel-300">{sourceTypeLabel[s.source_type] ?? s.source_type}</span>
                <span className="text-xs text-sentinel-300 truncate">{s.owner}</span>
                <span className="text-xs text-sentinel-300">{cadenceLabel[s.cadence] ?? s.cadence}</span>
                <span className="text-xs font-mono text-sentinel-200">{s.record_count.toLocaleString()}</span>
                <span className={`text-[10px] font-bold tracking-wider ${s.active ? 'text-severity-low' : 'text-sentinel-500'}`}>
                  {s.active ? 'ACTIVE' : 'INACTIVE'}
                </span>
                <div className="flex justify-end">
                  {s.active ? (
                    <button
                      onClick={() => handleDeactivate(s)}
                      disabled={busyId === s.id}
                      className="px-2.5 py-1.5 rounded text-[10px] font-semibold text-severity-critical bg-severity-tint-critical border border-severity-critical/30 hover:bg-severity-critical/20 transition-colors disabled:opacity-50"
                    >
                      {busyId === s.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Deactivate'}
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

      {showCreate && <RegisterSourceModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); refetch() }} />}
    </div>
  )
}
