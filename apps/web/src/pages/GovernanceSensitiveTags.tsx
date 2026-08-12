import { useState, useEffect } from 'react'
import { Plus, X, Loader2, ShieldAlert, Search } from 'lucide-react'
import { useApi } from '../hooks/useApi'
import { useAuth } from '../context/AuthContext'
import { adminApi, networkApi } from '../services/endpoints'
import { ApiError } from '../services/client'
import { Button } from '../components/ui/Button'
import { SkeletonRow } from '../components/ui/Skeletons'
import type { ClassificationLevel, EntitySummary, SensitiveSubjectOut } from '@cip/shared-types'

const classificationPill: Record<string, string> = {
  open_operational: 'bg-severity-tint-low text-severity-low border-severity-low/30',
  restricted_operational: 'bg-severity-tint-info text-severity-info border-severity-info/30',
  protected: 'bg-severity-tint-high text-severity-high border-severity-high/30',
  sealed: 'bg-severity-tint-critical text-severity-critical border-severity-critical/30',
}

const inputCls = 'w-full bg-surface-raised border border-surface-border rounded-lg px-3 py-2 text-sm text-sentinel-100 focus:outline-none focus:border-accent-blue/40 transition-colors'
const labelCls = 'block text-[11px] uppercase font-semibold tracking-wider text-sentinel-500 mb-1.5'

// ── Tag / untag modal ─────────────────────────────────────────────────────────
function TagActionModal({ untarget, onClose, onDone }: {
  untarget: SensitiveSubjectOut | null // set = removing a tag from a known person; null = tagging a newly-searched one
  onClose: () => void
  onDone: () => void
}) {
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [target, setTarget] = useState<EntitySummary | null>(null)
  const [focused, setFocused] = useState(false)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 300)
    return () => clearTimeout(t)
  }, [query])

  const { data: options } = useApi(
    () => (!untarget && debounced.trim().length >= 2 ? networkApi.search(debounced.trim(), 'person') : Promise.resolve(null)),
    [debounced, untarget],
  )
  const candidates = options?.items ?? []

  const targetId = untarget?.id ?? target?.id

  async function handleSubmit() {
    if (!targetId) return
    setSubmitting(true)
    setError(null)
    try {
      await adminApi.setSensitiveTag(targetId, { is_protected_subject: !untarget, reason })
      onDone()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to update sensitive tag')
      setSubmitting(false)
    }
  }

  return (
    <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-[440px] bg-surface-raised border border-surface-border rounded-xl shadow-2xl p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-sentinel-100">
            {untarget ? 'Remove Sensitive Tag' : 'Tag a Sensitive Subject'}
          </h2>
          <button onClick={onClose} className="p-1 rounded text-sentinel-500 hover:text-sentinel-200"><X className="w-4 h-4" /></button>
        </div>
        <div className="space-y-4">
          {untarget ? (
            <p className="text-sm text-sentinel-200">{untarget.full_name}</p>
          ) : (
            <div>
              <label className={labelCls}>Person</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-sentinel-500 pointer-events-none" />
                <input
                  value={query}
                  onChange={e => { setQuery(e.target.value); setTarget(null) }}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setTimeout(() => setFocused(false), 150)}
                  placeholder="Search person by name…"
                  className={`${inputCls} pl-8`}
                />
                {focused && !target && candidates.length > 0 && (
                  <div className="absolute z-20 mt-1 w-full max-h-40 overflow-y-auto bg-surface-card border border-surface-border rounded-lg shadow-lg">
                    {candidates.map(e => (
                      <button key={e.id} onMouseDown={() => { setTarget(e); setQuery(e.label); setFocused(false) }}
                        className="w-full text-left px-3 py-2 text-xs text-sentinel-200 hover:bg-surface-hover transition-colors truncate">
                        {e.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          <div>
            <label className={labelCls}>Reason</label>
            <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3}
              placeholder={untarget ? 'Why this protection is being lifted' : 'Why this person must be flagged as a protected subject'}
              className={`${inputCls} resize-none`} />
          </div>
          {error && <p className="text-xs text-severity-critical bg-severity-critical/10 border border-severity-critical/30 rounded-md px-3 py-2">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button onClick={onClose}>Cancel</Button>
            <Button variant={untarget ? 'danger' : 'primary'} onClick={handleSubmit} disabled={submitting || !targetId || !reason.trim()}>
              {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : untarget ? 'Remove Tag' : 'Tag Person'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function GovernanceSensitiveTags() {
  const { hasPermission } = useAuth()
  const canManage = hasPermission('system:configure')

  const { data: subjects, loading, error, refetch } = useApi(() => adminApi.sensitiveTags())

  const [showTag, setShowTag] = useState(false)
  const [untarget, setUntarget] = useState<SensitiveSubjectOut | null>(null)

  if (!canManage) {
    return (
      <div className="h-full flex items-center justify-center bg-surface-base">
        <div className="max-w-sm text-center p-8 bg-surface-card border border-surface-border rounded-xl">
          <ShieldAlert className="w-6 h-6 text-accent-amber mx-auto mb-3" />
          <p className="text-sm font-semibold text-sentinel-100">Administrator Only</p>
          <p className="text-xs text-sentinel-400 mt-1.5 leading-relaxed">
            Sensitive-tag management requires the system:configure permission (administrator clearance).
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
              <ShieldAlert className="w-4 h-4 text-accent-blue" /> Sensitive Subjects
            </h1>
            <p className="text-xs text-sentinel-400 mt-0.5">
              Persons flagged is_protected_subject — blocks entity merges, gates the network graph at the
              Protected tier, and feeds priority alerting
            </p>
          </div>
          <button
            onClick={() => setShowTag(true)}
            className="flex items-center gap-2 px-4 py-2 bg-accent-blue text-white rounded-lg text-xs font-semibold hover:bg-accent-blue/90 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Tag a Person
          </button>
        </div>

        <div className="bg-surface-card border border-surface-border rounded-xl overflow-hidden">
          <div className="grid px-4 py-2.5 border-b border-surface-border text-[10px] font-semibold tracking-widest text-sentinel-500 uppercase"
            style={{ gridTemplateColumns: '1fr 200px 120px' }}>
            <span>Name</span><span>Classification</span><span className="text-right">Actions</span>
          </div>

          <div className="divide-y divide-surface-border">
            {loading && Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)}
            {!loading && error && (
              <div className="px-4 py-10 text-center text-xs text-severity-critical">Failed to load sensitive subjects: {error}</div>
            )}
            {!loading && !error && (subjects?.length ?? 0) === 0 && (
              <div className="px-4 py-10 text-center text-xs text-sentinel-500">No persons currently tagged as protected subjects.</div>
            )}
            {subjects?.map(s => (
              <div key={s.id} className="grid px-4 py-3 items-center hover:bg-surface-hover/50 transition-colors"
                style={{ gridTemplateColumns: '1fr 200px 120px' }}>
                <span className="text-sm text-sentinel-100 truncate">{s.full_name}</span>
                <span className={`inline-flex w-fit items-center px-2 py-0.5 rounded-sm border text-[9px] font-semibold tracking-wider ${classificationPill[s.classification as ClassificationLevel] ?? ''}`}>
                  {s.classification.replace(/_/g, ' ').toUpperCase()}
                </span>
                <div className="flex justify-end">
                  <button
                    onClick={() => setUntarget(s)}
                    className="px-2.5 py-1.5 rounded text-[10px] font-semibold text-severity-critical bg-severity-tint-critical border border-severity-critical/30 hover:bg-severity-critical/20 transition-colors"
                  >
                    Remove Tag
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showTag && (
        <TagActionModal untarget={null} onClose={() => setShowTag(false)} onDone={() => { setShowTag(false); refetch() }} />
      )}
      {untarget && (
        <TagActionModal untarget={untarget} onClose={() => setUntarget(null)} onDone={() => { setUntarget(null); refetch() }} />
      )}
    </div>
  )
}
