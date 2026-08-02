import { useState } from 'react'
import { Merge, Search, X, Loader2, ShieldAlert, ArrowRight, Undo2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useApi } from '../hooks/useApi'
import { networkApi, entityResolutionApi } from '../services/endpoints'
import { ApiError } from '../services/client'
import { Button } from '../components/ui/Button'
import type { EntitySummary, MergeResponse } from '@cip/shared-types'

// ── Person picker ─────────────────────────────────────────────────────────────
function PersonPicker({ label, value, onSelect, excludeId }: {
  label: string
  value: EntitySummary | null
  onSelect: (e: EntitySummary | null) => void
  excludeId?: string | null
}) {
  const [q, setQ] = useState('')
  const { data: result, loading } = useApi(() => networkApi.search(q, 'person', 1, 8), [q])

  const options = (result?.items ?? []).filter(e => e.id !== excludeId)

  return (
    <div className="flex-1">
      <p className="text-[11px] uppercase font-semibold tracking-wider text-sentinel-500 mb-1.5">{label}</p>
      {value ? (
        <div className="flex items-center gap-2 bg-surface-raised border border-accent-blue/30 rounded-lg px-3 py-2">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-sentinel-100 truncate">{value.label}</p>
            <p className="font-mono text-[10px] text-sentinel-500">{value.id}</p>
          </div>
          <button onClick={() => onSelect(null)} className="p-1 rounded text-sentinel-500 hover:text-sentinel-200"><X className="w-3.5 h-3.5" /></button>
        </div>
      ) : (
        <div>
          <div className="flex items-center gap-2 bg-surface-raised border border-surface-border rounded-lg px-3 py-2">
            <Search className="w-3.5 h-3.5 text-sentinel-400 shrink-0" />
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Search persons…"
              className="flex-1 bg-transparent text-xs text-sentinel-100 placeholder-sentinel-500 focus:outline-none"
            />
            {loading && <Loader2 className="w-3 h-3 animate-spin text-sentinel-500" />}
          </div>
          {q.trim() && (
            <div className="mt-1.5 border border-surface-border rounded-lg overflow-hidden bg-surface-raised">
              {options.length === 0 && <p className="px-3 py-2 text-[11px] text-sentinel-500">No persons match.</p>}
              {options.map(e => (
                <button key={e.id} onClick={() => { onSelect(e); setQ('') }}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-surface-hover transition-colors text-left">
                  <span className="flex-1 min-w-0">
                    <span className="block text-xs font-medium text-sentinel-100 truncate">{e.label}</span>
                    <span className="font-mono text-[10px] text-sentinel-500">{e.id.slice(0, 8)} · {e.classification.replace(/_/g, ' ')}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function EntityResolution() {
  const { hasPermission } = useAuth()
  const canMerge = hasPermission('entity:merge')

  const [primary, setPrimary] = useState<EntitySummary | null>(null)
  const [absorbed, setAbsorbed] = useState<EntitySummary | null>(null)
  const [merging, setMerging] = useState(false)
  const [mergeError, setMergeError] = useState<string | null>(null)
  const [history, setHistory] = useState<MergeResponse[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)

  async function handleMerge() {
    if (!primary || !absorbed) return
    setMerging(true)
    setMergeError(null)
    try {
      const res = await entityResolutionApi.merge({
        primary_entity_id: primary.id,
        absorbed_entity_id: absorbed.id,
      })
      setHistory(prev => [res, ...prev])
      setPrimary(null)
      setAbsorbed(null)
    } catch (e) {
      setMergeError(e instanceof ApiError ? e.message : 'Merge failed')
    } finally {
      setMerging(false)
    }
  }

  async function handleReverse(event: MergeResponse) {
    setBusyId(event.id)
    setMergeError(null)
    try {
      const res = await entityResolutionApi.reverseMerge(event.id)
      setHistory(prev => prev.map(h => (h.id === res.id ? res : h)))
    } catch (e) {
      setMergeError(e instanceof ApiError ? e.message : 'Reverse failed')
    } finally {
      setBusyId(null)
    }
  }

  if (!canMerge) {
    return (
      <div className="h-full flex items-center justify-center bg-surface-base">
        <div className="max-w-sm text-center p-8 bg-surface-card border border-surface-border rounded-xl">
          <ShieldAlert className="w-6 h-6 text-accent-amber mx-auto mb-3" />
          <p className="text-sm font-semibold text-sentinel-100">Administrator Only</p>
          <p className="text-xs text-sentinel-400 mt-1.5 leading-relaxed">
            Entity resolution requires the entity:merge permission (administrator clearance).
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto bg-surface-base">
      <div className="max-w-[1200px] mx-auto px-6 py-6">
        <h1 className="text-xl font-bold text-sentinel-50 flex items-center gap-2">
          <Merge className="w-4 h-4 text-accent-blue" /> Entity Resolution
        </h1>
        <p className="text-xs text-sentinel-400 mt-0.5 mb-6">Merge duplicate persons into a single identity, and reverse mistaken merges</p>

        {mergeError && (
          <div className="mb-4 text-xs text-severity-critical bg-severity-critical/10 border border-severity-critical/30 rounded-lg px-4 py-2.5">{mergeError}</div>
        )}

        <div className="grid grid-cols-5 gap-4">
          {/* Merge form */}
          <div className="col-span-3">
            <div className="bg-surface-card border border-surface-border rounded-xl p-5">
              <h2 className="text-sm font-semibold text-sentinel-100 mb-4">Merge Persons</h2>
              <div className="flex items-start gap-3">
                <PersonPicker label="Primary (kept)" value={primary} onSelect={setPrimary} excludeId={absorbed?.id} />
                <div className="pt-7"><ArrowRight className="w-4 h-4 text-sentinel-500" /></div>
                <PersonPicker label="Absorbed (into primary)" value={absorbed} onSelect={setAbsorbed} excludeId={primary?.id} />
              </div>
              <div className="flex justify-end mt-5">
                <Button variant="primary" size="md" onClick={handleMerge} disabled={merging || !primary || !absorbed || primary.id === absorbed.id}>
                  {merging ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Merge className="w-3.5 h-3.5" />}
                  {merging ? 'Merging…' : 'Merge Entities'}
                </Button>
              </div>
              <p className="mt-3 text-[10px] text-sentinel-500 leading-relaxed">
                Aliases are unioned and the stricter classification is kept. Protected subjects cannot be merged, and absorbed persons are marked as merged.
              </p>
            </div>
          </div>

          {/* Merge history */}
          <div className="col-span-2">
            <div className="bg-surface-card border border-surface-border rounded-xl p-5 flex flex-col">
              <h2 className="text-sm font-semibold text-sentinel-100 mb-4">Merge Events (this session)</h2>
              {history.length === 0 ? (
                <p className="text-xs text-sentinel-500 py-8 text-center">No merges performed this session.</p>
              ) : (
                <div className="flex flex-col divide-y divide-surface-border">
                  {history.map(ev => (
                    <div key={ev.id} className="py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs text-sentinel-100 truncate">
                            <span className="font-mono text-[10px]">{ev.primary_entity_id.slice(0, 8)}</span>
                            <ArrowRight className="w-3 h-3 text-sentinel-500 inline mx-1" />
                            <span className="font-mono text-[10px]">{ev.absorbed_entity_id.slice(0, 8)}</span>
                          </p>
                          <p className={`text-[10px] font-bold tracking-wider mt-0.5 ${ev.status === 'merged' ? 'text-severity-low' : 'text-sentinel-500'}`}>
                            {ev.status.toUpperCase()}
                          </p>
                        </div>
                        {ev.status === 'merged' && (
                          <button
                            onClick={() => handleReverse(ev)}
                            disabled={busyId === ev.id}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded text-[10px] font-semibold text-sentinel-300 border border-surface-border hover:bg-surface-hover transition-colors disabled:opacity-50 shrink-0"
                          >
                            {busyId === ev.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Undo2 className="w-3 h-3" />} Reverse
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
