import { useState, useEffect, useCallback } from 'react'
import CytoscapeComponent from 'react-cytoscapejs'
import cytoscape from 'cytoscape'
import { X, ZoomIn, ZoomOut, AlertTriangle, ArrowRight, ArrowLeft, Search, Loader2, Route } from 'lucide-react'
import { ErrorBoundary } from '../ui/ErrorBoundary'
import { SkeletonGraph } from '../ui/Skeletons'
import { useApi } from '../../hooks/useApi'
import { useAppContext } from '../../context/AppContext'
import { networkApi } from '../../services/endpoints'
import { ApiError } from '../../services/client'
import type { EntityDetail, EntitySummary, EntityType, PathOut, RedactedField, RelationshipOut } from '@cip/shared-types'

function fieldText(v: string | RedactedField | null | undefined): string {
  if (v == null) return '—'
  if (typeof v === 'object' && 'redacted' in v) return `[REDACTED — ${v.reason.replace('_', ' ')}]`
  return v
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CY_STYLESHEET: any[] = [
  {
    selector: 'node',
    style: {
      'background-color': '#1a2332',
      'border-color': '#64748b',
      'border-width': 1.5,
      'label': 'data(label)',
      'font-family': 'JetBrains Mono, monospace',
      'font-size': '10px',
      'color': '#64748b',
      'text-valign': 'bottom',
      'text-margin-y': 4,
      'text-wrap': 'ellipsis',
      'max-width': 90,
      'width': 44,
      'height': 44,
      'shape': 'roundrectangle',
    } as any,
  },
  {
    selector: 'node[type = "person"]',
    style: { 'background-color': '#3b82f6', 'border-color': '#3b82f6' } as any,
  },
  {
    selector: 'node[type = "organization"]',
    style: { 'background-color': '#f59e0b', 'border-color': '#f59e0b' } as any,
  },
  {
    selector: 'node[type = "vehicle"]',
    style: { 'background-color': '#22c55e', 'border-color': '#22c55e' } as any,
  },
  {
    selector: 'node[type = "device"]',
    style: { 'background-color': '#a78bfa', 'border-color': '#a78bfa' } as any,
  },
  {
    selector: 'node[type = "address"]',
    style: { 'background-color': '#64748b', 'border-color': '#64748b' } as any,
  },
  {
    selector: 'node:selected',
    style: { 'border-color': '#f1f5f9', 'border-width': 2.5 } as any,
  },
  {
    selector: 'edge',
    style: {
      'width': 1.5,
      'line-color': '#2d3a4d',
      'target-arrow-color': '#2d3a4d',
      'curve-style': 'bezier',
      'target-arrow-shape': 'triangle',
      'arrow-scale': 0.6,
    } as any,
  },
]

const typeColor: Record<EntityType, string> = {
  person: 'text-accent-blue',
  organization: 'text-severity-high',
  vehicle: 'text-severity-low',
  device: 'text-viz-3',
  address: 'text-text-secondary',
}

// ── Graph data ────────────────────────────────────────────────────────────────
function useGraph() {
  const [entities, setEntities] = useState<EntitySummary[]>([])
  const [relationships, setRelationships] = useState<RelationshipOut[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const page = await networkApi.search('')
      const ents = page.items
      const relLists = await Promise.all(ents.map(e => networkApi.entityRelationships(e.id).then(p => p.items)))
      const seen = new Set<string>()
      const all: RelationshipOut[] = []
      ents.forEach((e, i) => {
        for (const r of relLists[i]) {
          if (r.source_entity.id !== e.id && r.target_entity.id !== e.id) continue
          if (seen.has(r.id)) continue
          seen.add(r.id)
          all.push(r)
        }
      })
      setEntities(ents)
      setRelationships(all)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load network')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return { entities, relationships, loading, error, reload: load }
}

function useEntityDetail(id: string) {
  const { data } = useApi(() => networkApi.entity(id), [id])
  return { data: data as EntityDetail | null }
}

function useRelationships(id: string) {
  const { data } = useApi(() => networkApi.entityRelationships(id), [id])
  return { data }
}

/** Reconstructs the ordered entity chain for a path — safer than trusting
 * each hop's own source/target order, since a hop's direction can run
 * either way along an undirected traversal (see PathOut's docstring). */
function pathChain(path: PathOut): EntitySummary[] {
  const chain: EntitySummary[] = [path.source_entity]
  let current = path.source_entity
  for (const r of path.relationships) {
    const next = r.source_entity.id === current.id ? r.target_entity : r.source_entity
    chain.push(next)
    current = next
  }
  return chain
}

// ── Path finder ───────────────────────────────────────────────────────────────
function PathFinder({ sourceId }: { sourceId: string }) {
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [target, setTarget] = useState<EntitySummary | null>(null)
  const [focused, setFocused] = useState(false)
  const [result, setResult] = useState<PathOut[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 300)
    return () => clearTimeout(t)
  }, [query])

  const { data: options } = useApi(
    () => (debounced.trim().length >= 2 ? networkApi.search(debounced.trim()) : Promise.resolve(null)),
    [debounced],
  )
  const candidates = (options?.items ?? []).filter(e => e.id !== sourceId)

  function pick(entity: EntitySummary) {
    setTarget(entity)
    setQuery(entity.label)
    setFocused(false)
    setResult(null)
    setError(null)
  }

  async function findPath() {
    if (!target) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      setResult(await networkApi.paths(sourceId, target.id))
    } catch (err) {
      if (err instanceof ApiError && err.code === 'entity_not_found') {
        setError('Target entity not found, or not visible at your access tier.')
      } else if (err instanceof ApiError && err.code === 'graph_unavailable') {
        setError('Relationship graph is temporarily unavailable. Try again shortly.')
      } else if (err instanceof ApiError && err.code === 'invalid_path_request') {
        setError('Source and target must be different entities.')
      } else {
        setError(err instanceof Error ? err.message : 'Failed to find a path.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <p className="section-label mb-2">Find Path To…</p>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-sentinel-500 pointer-events-none" />
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); setTarget(null); setResult(null); setError(null) }}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder="Search entity by name…"
          className="w-full pl-8 pr-3 py-1.5 bg-surface-card border border-surface-border rounded-lg text-xs text-sentinel-100 placeholder-sentinel-500 focus:outline-none focus:border-accent-blue/40"
        />
        {focused && !target && candidates.length > 0 && (
          <div className="absolute z-20 mt-1 w-full max-h-48 overflow-y-auto bg-surface-raised border border-surface-border rounded-lg shadow-lg">
            {candidates.map(e => (
              <button key={e.id} onMouseDown={() => pick(e)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-xs hover:bg-surface-hover transition-colors">
                <span className="truncate text-sentinel-200">{e.label}</span>
                <span className={`text-[10px] capitalize shrink-0 ml-2 ${typeColor[e.type]}`}>{e.type}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <button
        onClick={findPath}
        disabled={!target || loading}
        className="mt-2 w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-accent-blue/10 border border-accent-blue/30 text-accent-blue text-xs font-semibold hover:bg-accent-blue/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Route className="w-3.5 h-3.5" />} Find Path
      </button>

      {error && <p className="mt-2 text-[11px] text-severity-critical">{error}</p>}

      {result && result.length === 0 && !error && (
        <p className="mt-2 text-[11px] text-sentinel-500">No path found within the graph's search bounds.</p>
      )}

      {result && result.length > 0 && (
        <div className="mt-2 space-y-2">
          {result.map((path, i) => {
            const chain = pathChain(path)
            return (
              <div key={i} className="bg-surface-card border border-surface-border rounded-lg p-2.5">
                <p className="text-[10px] text-sentinel-500 mb-1.5">{path.length} hop{path.length === 1 ? '' : 's'}</p>
                <div className="flex flex-col gap-1">
                  {path.relationships.map((r, j) => (
                    <div key={r.id} className="flex items-center gap-1.5 text-[11px] text-sentinel-300">
                      <span className="truncate">{chain[j].label}</span>
                      <ArrowRight className="w-3 h-3 text-sentinel-500 shrink-0" />
                      <span className="text-sentinel-500 shrink-0">{r.type}</span>
                      <ArrowRight className="w-3 h-3 text-sentinel-500 shrink-0" />
                      <span className="truncate">{chain[j + 1].label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Node explorer panel ───────────────────────────────────────────────────────
export function NodeExplorerPanel({ entityId, onClose }: { entityId: string; onClose: () => void }) {
  const { addAlert } = useAppContext()
  const { data: detail } = useEntityDetail(entityId)
  const { data: relPage } = useRelationships(entityId)

  const attributes: { label: string; value: string }[] = []
  if (detail) {
    const push = (l: string, v: string | RedactedField | null | undefined) => {
      if (v == null) return
      attributes.push({ label: l, value: fieldText(v) })
    }
    if (detail.type === 'person') {
      push('Aliases', detail.aliases && typeof detail.aliases === 'string' ? detail.aliases : Array.isArray(detail.aliases) ? detail.aliases.join(', ') : null)
      push('Date of Birth', detail.date_of_birth)
      push('Phone', detail.phone_number)
    } else if (detail.type === 'organization') {
      push('Org Type', detail.org_type)
      push('Registration No.', detail.registration_number)
    } else if (detail.type === 'vehicle') {
      push('Registration No.', detail.registration_number)
      push('Make', detail.make)
      push('Model', detail.model)
      push('Color', detail.color)
    } else if (detail.type === 'device') {
      push('Device Type', detail.device_type)
      push('IMEI', detail.imei)
      push('Phone', detail.phone_number)
    } else if (detail.type === 'address') {
      push('Raw Text', detail.raw_text)
    }
  }

  return (
    <div className="absolute top-0 right-0 h-full w-[300px] bg-surface-raised border-l border-surface-border z-10 flex flex-col animate-slide-in-right">
      <div className="px-4 py-3 border-b border-surface-border flex items-center justify-between shrink-0">
        <h2 className="text-sm font-semibold text-sentinel-100">Entity Explorer</h2>
        <button onClick={onClose} className="p-1 rounded text-sentinel-500 hover:text-sentinel-200"><X className="w-3.5 h-3.5" /></button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {!detail ? (
          <div className="flex items-center gap-2 text-xs text-sentinel-400">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading entity…
          </div>
        ) : (
          <>
            {/* Entity identity */}
            <div className="bg-surface-card border border-surface-border rounded-lg p-3">
              <p className="text-xs text-sentinel-100 font-medium">{fieldText(detail.label)}</p>
              <p className="font-mono text-[10px] text-sentinel-500 mt-0.5">{detail.id}</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="bg-surface-card border border-surface-border rounded-lg p-2.5">
                <p className="section-label mb-1">Type</p>
                <p className={`text-xs font-semibold capitalize ${typeColor[detail.type]}`}>{detail.type}</p>
              </div>
              <div className="bg-surface-card border border-surface-border rounded-lg p-2.5">
                <p className="section-label mb-1">Classification</p>
                <p className="text-xs font-medium text-sentinel-200 capitalize">{detail.classification.replace(/_/g, ' ')}</p>
              </div>
            </div>

            {attributes.length > 0 && (
              <div className="bg-surface-card border border-surface-border rounded-lg p-3">
                <p className="section-label mb-2">Attributes</p>
                <div className="flex flex-col">
                  {attributes.map(a => (
                    <div key={a.label} className="py-1.5 border-b border-surface-border last:border-0">
                      <p className="text-[10px] uppercase tracking-wider text-sentinel-500">{a.label}</p>
                      <p className="text-xs text-sentinel-200 break-words">{a.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Relationships */}
            <div>
              <p className="section-label mb-2">Relationships</p>
              {(relPage?.items ?? []).length === 0 ? (
                <p className="text-xs text-sentinel-500">No known relationships.</p>
              ) : (relPage?.items ?? []).map(r => (
                <div key={r.id} className="flex items-center gap-2 py-2 border-b border-surface-border last:border-0">
                  {r.source_entity.id === detail.id ? (
                    <ArrowRight className="w-3 h-3 text-sentinel-400 shrink-0" />
                  ) : (
                    <ArrowLeft className="w-3 h-3 text-sentinel-400 shrink-0" />
                  )}
                  <span className="font-mono text-[10px] text-sentinel-500 flex-1 truncate">
                    {r.source_entity.id === detail.id ? r.target_entity.label : r.source_entity.label}
                  </span>
                  <span className="text-[10px] text-sentinel-400">{r.type} · {r.confidence.band}</span>
                </div>
              ))}
            </div>

            <PathFinder sourceId={detail.id} />
          </>
        )}
      </div>

      {/* Isolate button (local alert only) */}
      <div className="px-4 py-3 border-t border-surface-border shrink-0">
        <button
          onClick={() => addAlert({ severity: 'critical', title: `Entity ${entityId.slice(0, 8)} Isolated`, description: `Manual isolation triggered. Relationship access suspended.`, nodeId: entityId })}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-accent-rose/10 border border-accent-rose/30 text-accent-rose text-xs font-semibold hover:bg-accent-rose/20 transition-colors">
          <AlertTriangle className="w-3.5 h-3.5" /> ISOLATE ENTITY
        </button>
      </div>
    </div>
  )
}

// ── Interactive graph (Cytoscape) ─────────────────────────────────────────────
/** Self-contained interactive entity relationship graph — real data via
 * networkApi. Shared by the Network Workspace's "Network Graph" tab and
 * Node Registry's "Interactive Graph" tab (previously that tab did
 * nothing at all: its own tab state updated but nothing ever rendered
 * from it). */
export function NetworkGraphView() {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [zoom, setZoom] = useState(100)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [cyRef, setCyRef] = useState<any>(null)
  const [query, setQuery] = useState('')

  const { entities, relationships, loading, error, reload } = useGraph()

  const filteredEntities = query.trim()
    ? entities.filter(e => e.label.toLowerCase().includes(query.toLowerCase()))
    : entities

  const elements = [
    ...filteredEntities.map(e => ({ data: { id: e.id, label: e.label, type: e.type, classification: e.classification } })),
    ...relationships
      .filter(r => filteredEntities.some(e => e.id === r.source_entity.id) && filteredEntities.some(e => e.id === r.target_entity.id))
      .map(r => ({ data: { id: r.id, source: r.source_entity.id, target: r.target_entity.id, type: r.type } })),
  ]

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleNodeClick = useCallback((evt: any) => {
    const node = evt.target
    if (node.isNode && node.isNode()) setSelectedId(node.id())
  }, [])

  function zoomIn()  { if (cyRef) { cyRef.zoom(cyRef.zoom() * 1.2); setZoom(Math.round(cyRef.zoom() * 100)) } }
  function zoomOut() { if (cyRef) { cyRef.zoom(cyRef.zoom() / 1.2); setZoom(Math.round(cyRef.zoom() * 100)) } }

  return (
    <div className="flex-1 relative overflow-hidden">
      {/* Dot-grid canvas */}
      <div className="absolute inset-0 dot-grid opacity-50" />

      {loading ? (
        <SkeletonGraph />
      ) : (
        <ErrorBoundary label="Network graph failed to render">
          <CytoscapeComponent
            elements={elements}
            stylesheet={CY_STYLESHEET}
            style={{ width: '100%', height: '100%', background: 'transparent' }}
            cy={(cy: cytoscape.Core) => {
              setCyRef(cy)
              cy.on('tap', 'node', handleNodeClick)
              cy.on('tap', function (e: cytoscape.EventObject) {
                if (e.target === cy) setSelectedId(null)
              })
            }}
            // animate: false (not true): cose's animated layout self-reschedules
            // via requestAnimationFrame until it converges. cy.destroy() on
            // unmount (react-cytoscapejs's componentWillUnmount) doesn't cancel
            // an already-queued frame — the next one still fires, tries to
            // notify the now-null renderer, and throws
            // "Cannot read properties of null (reading 'notify')". animate:
            // false makes cytoscape compute final positions synchronously
            // instead of scheduling frames, which removes that code path
            // entirely rather than racing it. Trade-off: nodes settle into
            // place instantly instead of animating in.
            layout={{ name: 'cose', animate: false, padding: 40 }}
            userZoomingEnabled
            userPanningEnabled
          />
        </ErrorBoundary>
      )}

      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10">
          <p className="text-xs text-severity-critical">Failed to load network: {error}</p>
          <button onClick={reload} className="text-xs font-medium text-accent-blue hover:text-blue-400">Retry</button>
        </div>
      )}

      {/* Bottom control bar */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 bg-surface-raised/90 border border-surface-border rounded-xl px-3 py-2 backdrop-blur-sm">
        <button onClick={zoomOut} className="p-1.5 rounded text-sentinel-400 hover:text-sentinel-200 hover:bg-surface-hover transition-colors"><ZoomOut className="w-3.5 h-3.5" /></button>
        <span className="font-mono text-[11px] text-sentinel-300 w-10 text-center">{zoom}%</span>
        <button onClick={zoomIn} className="p-1.5 rounded text-sentinel-400 hover:text-sentinel-200 hover:bg-surface-hover transition-colors"><ZoomIn className="w-3.5 h-3.5" /></button>
        <div className="w-px h-4 bg-surface-border mx-1" />
        <span className="text-[10px] text-sentinel-400">
          {entities.length} entities · {relationships.length} relationships
        </span>
      </div>

      {/* Search bar */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2 bg-surface-raised/90 border border-surface-border rounded-lg px-3 py-2 backdrop-blur-sm w-64">
        <Search className="w-3.5 h-3.5 text-sentinel-400 shrink-0" />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Filter entities…"
          className="flex-1 bg-transparent text-xs text-sentinel-100 placeholder-sentinel-500 focus:outline-none"
        />
      </div>

      {/* Entity Explorer panel */}
      {selectedId && <NodeExplorerPanel entityId={selectedId} onClose={() => setSelectedId(null)} />}
    </div>
  )
}
