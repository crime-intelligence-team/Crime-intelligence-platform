import { useState } from 'react'
import { ShieldCheck, ShieldAlert, Check, X, Loader2, GitPullRequest, Search } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useApi } from '../hooks/useApi'
import { adminApi, mapApi, networkApi } from '../services/endpoints'
import { ApiError } from '../services/client'
import { Button } from '../components/ui/Button'
import type { ConfidenceReviewResponse, EntitySummary, RelationshipOut, ZoneRiskOut } from '@cip/shared-types'

const statusMeta: Record<string, { label: string; cls: string }> = {
  pending: { label: 'PENDING', cls: 'bg-accent-amber/15 border-accent-amber/40 text-accent-amber' },
  accepted: { label: 'ACCEPTED', cls: 'bg-severity-tint-low border-severity-low/40 text-severity-low' },
  rejected: { label: 'REJECTED', cls: 'bg-severity-tint-critical border-severity-critical/40 text-severity-critical' },
  escalated: { label: 'ESCALATED', cls: 'bg-surface-hover border-surface-border text-sentinel-400' },
}

const inputCls = 'w-full bg-surface-raised border border-surface-border rounded-lg px-3 py-2 text-sm text-sentinel-100 placeholder-sentinel-500 focus:outline-none focus:border-accent-blue/40 transition-colors'
const labelCls = 'block text-[11px] uppercase font-semibold tracking-wider text-sentinel-500 mb-1.5'

function ZoneTargetPicker({ value, onChange }: { value: ZoneRiskOut | null; onChange: (z: ZoneRiskOut | null) => void }) {
  const [districtId, setDistrictId] = useState('')
  const { data: districts } = useApi(() => mapApi.districts(1, 100), [])
  const { data: zones, loading } = useApi(() => (districtId ? mapApi.zones(districtId, 1, 100) : Promise.resolve(null)), [districtId])

  return (
    <div className="space-y-2">
      <div>
        <label className={labelCls}>District</label>
        <select value={districtId} onChange={e => { setDistrictId(e.target.value); onChange(null) }} className={inputCls}>
          <option value="">Select a district…</option>
          {(districts?.items ?? []).map(d => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      </div>
      {districtId && (
        <div className="border border-surface-border rounded-lg overflow-hidden">
          {loading ? (
            <div className="px-3 py-2 flex items-center gap-2 text-[11px] text-sentinel-500"><Loader2 className="w-3 h-3 animate-spin" /> Loading zone scores…</div>
          ) : (zones?.items ?? []).length === 0 ? (
            <p className="px-3 py-2 text-[11px] text-sentinel-500">No persisted score runs in this district — run zone scoring first.</p>
          ) : (
            (zones?.items ?? []).map(z => {
              const selectable = z.score_id != null
              return (
                <button key={z.id} onClick={() => selectable && onChange(value?.id === z.id ? null : z)}
                  disabled={!selectable}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${value?.id === z.id ? 'bg-accent-blue/10 border-l-2 border-accent-blue' : 'hover:bg-surface-hover'} ${!selectable ? 'opacity-50 cursor-not-allowed' : ''}`}>
                  <span className="flex-1 min-w-0">
                    <span className="block text-xs font-medium text-sentinel-100">{z.name}</span>
                    <span className="font-mono text-[10px] text-sentinel-500">{z.recommended_interpretation} · {new Date(z.run_timestamp).toLocaleString()}</span>
                  </span>
                  <span className="text-xs font-mono text-sentinel-300">score {z.score}</span>
                </button>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}

function EdgeTargetPicker({ value, onChange }: { value: RelationshipOut | null; onChange: (e: RelationshipOut | null) => void }) {
  const [q, setQ] = useState('')
  const [entity, setEntity] = useState<EntitySummary | null>(null)
  const { data: searchResult, loading: searching } = useApi(() => networkApi.search(q, undefined, 1, 6), [q])
  const { data: rels, loading: loadingRels } = useApi(
    () => (entity ? networkApi.entityRelationships(entity.id, 1, 100) : Promise.resolve(null)),
    [entity?.id],
  )

  const edges = (rels?.items ?? []).filter(r => r.mirror_id != null)

  return (
    <div className="space-y-2">
      <div>
        <label className={labelCls}>Entity</label>
        <div className="flex items-center gap-2 bg-surface-raised border border-surface-border rounded-lg px-3 py-2">
          <Search className="w-3.5 h-3.5 text-sentinel-400 shrink-0" />
          <input value={q} onChange={e => setQ(e.target.value)}
            placeholder="Search an entity to expose its edges…"
            className="flex-1 bg-transparent text-xs text-sentinel-100 placeholder-sentinel-500 focus:outline-none" />
          {searching && <Loader2 className="w-3 h-3 animate-spin text-sentinel-500" />}
        </div>
        {q.trim() && (
          <div className="mt-1.5 border border-surface-border rounded-lg overflow-hidden bg-surface-raised">
            {(searchResult?.items ?? []).length === 0 && <p className="px-3 py-2 text-[11px] text-sentinel-500">No entities match.</p>}
            {(searchResult?.items ?? []).map(e => (
              <button key={e.id} onClick={() => { setEntity(e); setQ(''); onChange(null) }}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-surface-hover transition-colors text-left">
                <span className="flex-1 min-w-0">
                  <span className="block text-xs font-medium text-sentinel-100 truncate">{e.label}</span>
                  <span className="font-mono text-[10px] text-sentinel-500">{e.type} · {e.id.slice(0, 8)}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
      {entity && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className={labelCls}>Edges from {entity.label}</span>
            <button onClick={() => setEntity(null)} className="text-[10px] text-sentinel-500 hover:text-sentinel-300">clear</button>
          </div>
          <div className="border border-surface-border rounded-lg overflow-hidden">
            {loadingRels ? (
              <div className="px-3 py-2 flex items-center gap-2 text-[11px] text-sentinel-500"><Loader2 className="w-3 h-3 animate-spin" /> Loading edges…</div>
            ) : edges.length === 0 ? (
              <p className="px-3 py-2 text-[11px] text-sentinel-500">No mirror-backed edges found for this entity.</p>
            ) : (
              edges.map(r => (
                <button key={r.id} onClick={() => onChange(value?.id === r.id ? null : r)}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${value?.id === r.id ? 'bg-accent-blue/10 border-l-2 border-accent-blue' : 'hover:bg-surface-hover'}`}>
                  <span className="flex-1 min-w-0">
                    <span className="block text-xs font-medium text-sentinel-100 truncate">
                      {r.source_entity.label} → {r.target_entity.label}
                    </span>
                    <span className="font-mono text-[10px] text-sentinel-500">{r.type} · {r.verification_status}</span>
                  </span>
                  <span className="text-xs font-mono text-sentinel-300">conf {r.confidence.score}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function GovernanceIntegrity() {
  const { hasPermission } = useAuth()
  const canReview = hasPermission('confidence:review')

  const [targetType, setTargetType] = useState<'edge' | 'zone_score'>('zone_score')
  const [zone, setZone] = useState<ZoneRiskOut | null>(null)
  const [edge, setEdge] = useState<RelationshipOut | null>(null)
  const [action, setAction] = useState<'dispute' | 'confirm'>('confirm')
  const [proposed, setProposed] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [session, setSession] = useState<ConfidenceReviewResponse[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)
  const [queueError, setQueueError] = useState<string | null>(null)

  const targetId = targetType === 'zone_score' ? (zone?.score_id ?? null) : (edge?.mirror_id ?? null)
  const currentScore = targetType === 'zone_score' ? (zone?.score ?? null) : (edge?.confidence.score ?? null)

  async function handleSubmit() {
    setFormError(null)
    if (!targetId) {
      setFormError(targetType === 'zone_score'
        ? 'Select a zone score run to review.'
        : 'Select a relationship edge to review.')
      return
    }
    const proposedScore = action === 'dispute' ? Number(proposed) : null
    if (action === 'dispute' && (proposedScore === null || Number.isNaN(proposedScore) || proposedScore < 0 || proposedScore > 100)) {
      setFormError('Proposed score must be an integer between 0 and 100.')
      return
    }
    setSubmitting(true)
    try {
      const created = await adminApi.submitConfidenceReview({
        target_type: targetType,
        target_id: targetId,
        action,
        proposed_score: proposedScore,
      })
      setSession(prev => [created, ...prev])
      setZone(null)
      setEdge(null)
      setProposed('')
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : 'Submission failed')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDecision(review: ConfidenceReviewResponse, decision: 'accept' | 'reject') {
    setBusyId(review.id)
    setQueueError(null)
    try {
      const updated = await adminApi.decideConfidenceReview(review.id, { decision })
      setSession(prev => prev.map(r => (r.id === updated.id ? updated : r)))
    } catch (e) {
      setQueueError(e instanceof ApiError ? e.message : 'Decision failed')
    } finally {
      setBusyId(null)
    }
  }

  if (!canReview) {
    return (
      <div className="h-full flex items-center justify-center bg-surface-base">
        <div className="max-w-sm text-center p-8 bg-surface-card border border-surface-border rounded-xl">
          <ShieldAlert className="w-6 h-6 text-accent-amber mx-auto mb-3" />
          <p className="text-sm font-semibold text-sentinel-100">Supervisor or Administrator Required</p>
          <p className="text-xs text-sentinel-400 mt-1.5 leading-relaxed">
            Confidence reviews require the confidence:review permission.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto bg-surface-base">
      <div className="max-w-[1200px] mx-auto px-6 py-6">
        <h1 className="text-xl font-bold text-sentinel-50 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-accent-blue" /> Confidence Review
        </h1>
        <p className="text-xs text-sentinel-400 mt-0.5 mb-6">Dispute or confirm relationship / zone-score confidence, then adjudicate the queue</p>

        <div className="grid grid-cols-5 gap-4">
          {/* Submit review */}
          <div className="col-span-2">
            <div className="bg-surface-card border border-surface-border rounded-xl p-5">
              <h2 className="text-sm font-semibold text-sentinel-100 mb-4">Submit Review</h2>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Target Type</label>
                    <select value={targetType} onChange={e => { setTargetType(e.target.value as 'edge' | 'zone_score'); setZone(null); setEdge(null) }} className={inputCls}>
                      <option value="zone_score">Zone Score</option>
                      <option value="edge">Relationship Edge</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Action</label>
                    <select value={action} onChange={e => setAction(e.target.value as 'dispute' | 'confirm')} className={inputCls}>
                      <option value="confirm">Confirm</option>
                      <option value="dispute">Dispute</option>
                    </select>
                  </div>
                </div>

                {targetType === 'zone_score'
                  ? <ZoneTargetPicker value={zone} onChange={setZone} />
                  : <EdgeTargetPicker value={edge} onChange={setEdge} />}

                {currentScore != null && (
                  <p className="text-[11px] text-sentinel-400">
                    Current score: <span className="font-mono text-sentinel-100">{currentScore}</span>
                    <span className="text-sentinel-500"> · target {targetId?.slice(0, 8)}</span>
                  </p>
                )}

                {action === 'dispute' && (
                  <div>
                    <label className={labelCls}>Proposed Score (0–100)</label>
                    <input type="number" min={0} max={100} value={proposed} onChange={e => setProposed(e.target.value)} className={inputCls} />
                  </div>
                )}
                {formError && <p className="text-xs text-severity-critical bg-severity-critical/10 border border-severity-critical/30 rounded-md px-3 py-2">{formError}</p>}
                <Button variant="primary" size="md" className="w-full" onClick={handleSubmit} disabled={submitting}>
                  {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Submit Review'}
                </Button>
              </div>
            </div>
            <p className="mt-3 text-[10px] text-sentinel-500 leading-relaxed">
              Targets come from live data: zone scores (per district, via score_id) and relationship edges (per entity, via mirror_id).
              Accepted disputes write the proposed score to the relational mirror and fire a confidence-change alert.
            </p>
          </div>

          {/* Queue */}
          <div className="col-span-3">
            <div className="bg-surface-card border border-surface-border rounded-xl p-5 flex flex-col">
              <div className="flex items-center gap-2 mb-4">
                <GitPullRequest className="w-4 h-4 text-sentinel-400" />
                <h2 className="text-sm font-semibold text-sentinel-100">Review Queue (this session)</h2>
              </div>

              {queueError && (
                <div className="mb-3 text-xs text-severity-critical bg-severity-critical/10 border border-severity-critical/30 rounded-lg px-4 py-2.5">{queueError}</div>
              )}

              {session.length === 0 ? (
                <p className="text-xs text-sentinel-500 py-8 text-center">No reviews submitted this session.</p>
              ) : (
                <div className="flex flex-col divide-y divide-surface-border">
                  {session.map(r => {
                    const sm = statusMeta[r.review_status] ?? statusMeta.pending
                    return (
                      <div key={r.id} className="py-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-sentinel-100">
                              <span className="font-mono">{r.target_type}</span> · {r.action}
                              <span className="font-mono text-sentinel-500 ml-2">{r.target_id.slice(0, 8)}</span>
                            </p>
                            <p className="text-[11px] text-sentinel-400 mt-0.5">
                              {r.original_score != null ? `current ${r.original_score}` : 'no score'} →{' '}
                              {r.proposed_score != null ? r.proposed_score : '—'} · {new Date(r.created_at ?? '').toLocaleString()}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-sm border text-[10px] font-bold tracking-wider ${sm.cls}`}>{sm.label}</span>
                            {r.review_status === 'pending' && (
                              <>
                                <button
                                  onClick={() => handleDecision(r, 'accept')}
                                  disabled={busyId === r.id}
                                  className="flex items-center gap-1 px-2.5 py-1.5 rounded text-[10px] font-semibold bg-severity-tint-low text-severity-low border border-severity-low/30 hover:bg-severity-low/20 transition-colors disabled:opacity-50"
                                >
                                  {busyId === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Accept
                                </button>
                                <button
                                  onClick={() => handleDecision(r, 'reject')}
                                  disabled={busyId === r.id}
                                  className="flex items-center gap-1 px-2.5 py-1.5 rounded text-[10px] font-semibold bg-severity-tint-critical text-severity-critical border border-severity-critical/30 hover:bg-severity-critical/20 transition-colors disabled:opacity-50"
                                >
                                  <X className="w-3 h-3" /> Reject
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
