import { useState, useEffect } from 'react'
import { Pagination } from '../ui/Pagination'
import { Cpu, User, Building2, Car, MapPin, Search, ChevronRight } from 'lucide-react'
import { useApi } from '../../hooks/useApi'
import { networkApi } from '../../services/endpoints'
import { useNavigate } from 'react-router-dom'
import type { EntityType } from '@cip/shared-types'

const typeIconMap: Record<string, any> = {
  person: User, organization: Building2, vehicle: Car, device: Cpu, address: MapPin, unknown: Cpu,
}

const typeColors: Record<string, string> = {
  person: 'bg-accent-blue/10 text-accent-blue border-accent-blue/20',
  organization: 'bg-severity-high/10 text-severity-high border-severity-high/20',
  vehicle: 'bg-severity-low/10 text-severity-low border-severity-low/20',
  device: 'bg-viz-3/10 text-viz-3 border-viz-3/20',
  address: 'bg-surface-hover text-sentinel-300 border-surface-border',
}

const ENTITY_TYPES: (EntityType | 'all')[] = ['all', 'person', 'organization', 'vehicle', 'device', 'address']

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

/** Searchable/filterable entity table — real data via networkApi.search.
 * Shared by the standalone Node Registry page (/network/registry) and the
 * Network Workspace's Node Explorer tab. onSelectEntity lets an embedding
 * page react to a row click directly (e.g. open its own entity-detail
 * panel); the standalone page falls back to navigating to /network. */
export function EntityRegistryTable({ onSelectEntity }: { onSelectEntity?: (id: string) => void }) {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [typeFilter, setTypeFilter] = useState<EntityType | 'all'>('all')
  const [query, setQuery] = useState('')

  const { data: result, loading, error, refetch } = useApi(
    () => networkApi.search(query, typeFilter === 'all' ? undefined : typeFilter, page, 10),
    [page, typeFilter, query],
  )

  useEffect(() => { setPage(1) }, [typeFilter, query])

  const entities = result?.items ?? []
  const total = result?.total ?? 0

  const COLS = ['ENTITY ID', 'TYPE', 'LABEL', 'CLASSIFICATION']

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="px-6 py-3 border-b border-surface-border flex items-center gap-3 shrink-0 bg-surface-raised/50">
        <div className="flex items-center gap-2 bg-surface-raised border border-surface-border rounded-lg px-3 py-1.5 w-72">
          <Search className="w-3.5 h-3.5 text-sentinel-400 shrink-0" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search entities…"
            className="flex-1 bg-transparent text-xs text-sentinel-100 placeholder-sentinel-500 focus:outline-none"
          />
        </div>
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value as EntityType | 'all')}
          className="bg-surface-raised border border-surface-border rounded-lg px-3 py-1.5 text-xs text-sentinel-200 focus:outline-none focus:border-accent-blue/40"
        >
          {ENTITY_TYPES.map(t => (
            <option key={t} value={t}>{t === 'all' ? 'All types' : t[0].toUpperCase() + t.slice(1)}</option>
          ))}
        </select>
        <span className="ml-auto text-[11px] text-sentinel-400 font-mono">{total} records</span>
      </div>

      {/* Table header */}
      <div className="grid gap-0 border-b border-surface-border bg-surface-raised/30 shrink-0"
        style={{ gridTemplateColumns: '40px 260px 140px 1fr 180px 28px' }}>
        <div className="px-4 py-2.5" />
        {COLS.map(c => (
          <div key={c} className="px-3 py-2.5">
            <span className="section-label">{c}</span>
          </div>
        ))}
        <div />
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-y-auto">
        {loading && <div className="p-6 text-xs text-sentinel-500 animate-pulse">Loading registry…</div>}
        {error && (
          <div className="flex flex-col items-center gap-2 py-12 text-sentinel-500">
            <p className="text-xs text-severity-critical">Failed to load entities</p>
            <button onClick={refetch} className="text-xs font-medium text-accent-blue hover:text-blue-400">Retry</button>
          </div>
        )}
        {!loading && !error && entities.length === 0 && (
          <div className="py-12 text-center text-xs text-sentinel-500">No entities match the current filter.</div>
        )}
        {entities.map(e => {
          const Icon = typeIconMap[e.type] ?? Cpu
          return (
            <div key={e.id}
              className="grid items-center border-b border-surface-border hover:bg-surface-hover transition-colors cursor-pointer group"
              style={{ gridTemplateColumns: '40px 260px 140px 1fr 180px 28px' }}
              onClick={() => (onSelectEntity ? onSelectEntity(e.id) : navigate('/network'))}>
              <div className="px-4 py-3 flex items-center">
                <span className={`w-8 h-8 rounded border flex items-center justify-center ${typeColors[e.type] ?? typeColors.unknown}`}>
                  <Icon className="w-3.5 h-3.5" />
                </span>
              </div>
              <div className="px-3 py-3">
                <span className="font-mono text-[11px] text-sentinel-100">{e.id}</span>
              </div>
              <div className="px-3 py-3">
                <span className="text-xs text-sentinel-200 capitalize">{e.type}</span>
              </div>
              <div className="px-3 py-3">
                <span className="text-xs font-medium text-sentinel-100 truncate">{e.label}</span>
              </div>
              <div className="px-3 py-3">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-sm border text-[9px] font-semibold tracking-wider ${classificationPill[e.classification] ?? ''}`}>
                  {classificationLabel[e.classification] ?? e.classification}
                </span>
              </div>
              <div className="px-3 py-3 flex justify-end">
                <ChevronRight className="w-3.5 h-3.5 text-sentinel-600 group-hover:text-sentinel-300 transition-colors" />
              </div>
            </div>
          )
        })}
      </div>

      {/* Pagination */}
      <div className="px-6 py-3 border-t border-surface-border shrink-0 bg-surface-raised/50">
        <Pagination total={total} page={page} perPage={10} onPageChange={setPage} />
      </div>
    </div>
  )
}
