import { useMemo, useState } from 'react'
import { Search, ShieldAlert, Loader2, Users, GitBranch } from 'lucide-react'
import { useApi } from '../hooks/useApi'
import { useAuth } from '../context/AuthContext'
import { officersApi } from '../services/endpoints'
import { ApiError } from '../services/client'
import { SkeletonRow } from '../components/ui/Skeletons'
import type { OfficerSummary } from '@cip/shared-types'

const ROLE_ORDER = ['administrator', 'supervisor', 'detective', 'analyst', 'district_officer']

const roleMeta: Record<string, { label: string; cls: string }> = {
  administrator:    { label: 'Administrator',    cls: 'bg-severity-tint-critical text-severity-critical border-severity-critical/30' },
  supervisor:       { label: 'Supervisor',       cls: 'bg-accent-amber/15 text-accent-amber border-accent-amber/30' },
  detective:        { label: 'Detective',        cls: 'bg-accent-blue/15 text-accent-blue border-accent-blue/30' },
  analyst:          { label: 'Analyst',          cls: 'bg-severity-tint-low text-severity-low border-severity-low/30' },
  district_officer: { label: 'District Officer', cls: 'bg-surface-hover text-sentinel-400 border-surface-border' },
}

function RoleBadge({ role }: { role: string }) {
  const m = roleMeta[role] ?? { label: role, cls: 'bg-surface-hover text-sentinel-400 border-surface-border' }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-sm border text-[10px] font-semibold tracking-wide ${m.cls}`}>
      {m.label}
    </span>
  )
}

export default function GovernanceProtocols() {
  const { hasPermission } = useAuth()
  const canView = hasPermission('officer:view')
  const canManage = hasPermission('officer:manage')

  const { data: officers, loading, error, refetch } = useApi(() => officersApi.list(), [canView])
  const all = officers ?? []

  const [search, setSearch] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const byId = useMemo(() => new Map(all.map(o => [o.id, o])), [all])

  const roleCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const o of all) counts[o.role] = (counts[o.role] ?? 0) + 1
    return counts
  }, [all])

  const filtered = all.filter(o => {
    const q = search.toLowerCase()
    return !q || o.full_name.toLowerCase().includes(q) || o.official_id.toLowerCase().includes(q) || (o.unit ?? '').toLowerCase().includes(q)
  })

  async function handleManagerChange(officer: OfficerSummary, managerId: string) {
    setBusyId(officer.id)
    setActionError(null)
    try {
      await officersApi.setManager(officer.id, { manager_id: managerId || null })
      refetch()
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : 'Failed to update manager')
    } finally {
      setBusyId(null)
    }
  }

  if (!canView) {
    return (
      <div className="h-full flex items-center justify-center bg-surface-base">
        <div className="max-w-sm text-center p-8 bg-surface-card border border-surface-border rounded-xl">
          <ShieldAlert className="w-6 h-6 text-accent-amber mx-auto mb-3" />
          <p className="text-sm font-semibold text-sentinel-100">Supervisor Clearance Required</p>
          <p className="text-xs text-sentinel-400 mt-1.5 leading-relaxed">
            The officer directory requires the officer:view permission (supervisor or administrator clearance).
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
              <Users className="w-4 h-4 text-accent-blue" /> Officer Directory
            </h1>
            <p className="text-xs text-sentinel-400 mt-0.5">Roster, role clearance and reporting hierarchy</p>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-sentinel-500" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search officers..."
              className="pl-7 pr-3 py-1.5 bg-surface-card border border-surface-border rounded-lg text-[11px] text-sentinel-200 placeholder-sentinel-600 focus:outline-none focus:border-accent-blue/40 w-52" />
          </div>
        </div>

        {actionError && (
          <div className="mb-4 text-xs text-severity-critical bg-severity-critical/10 border border-severity-critical/30 rounded-lg px-4 py-2.5">{actionError}</div>
        )}

        <div className="grid grid-cols-3 gap-4">
          {/* Roster (2/3) */}
          <div className="col-span-2 bg-surface-card border border-surface-border rounded-xl overflow-hidden">
            <div className="grid px-4 py-2.5 border-b border-surface-border text-[10px] font-semibold tracking-widest text-sentinel-500 uppercase"
              style={{ gridTemplateColumns: '110px 1fr 130px 100px 170px' }}>
              <span>Official ID</span><span>Name</span><span>Role</span><span>Unit</span><span>Reports To</span>
            </div>

            <div className="divide-y divide-surface-border">
              {loading && Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={5} />)}
              {!loading && error && (
                <div className="px-4 py-10 text-center text-xs text-severity-critical">Failed to load officers: {error}</div>
              )}
              {!loading && !error && filtered.length === 0 && (
                <div className="px-4 py-10 text-center text-xs text-sentinel-500">No officers match your search.</div>
              )}
              {filtered.map(o => {
                const manager = o.manager_id ? byId.get(o.manager_id) : null
                return (
                  <div key={o.id} className="grid px-4 py-3 items-center hover:bg-surface-hover/50 transition-colors"
                    style={{ gridTemplateColumns: '110px 1fr 130px 100px 170px' }}>
                    <span className="font-mono text-[11px] text-sentinel-300">{o.official_id}</span>
                    <span className="text-xs font-medium text-sentinel-100 truncate pr-2">{o.full_name}</span>
                    <RoleBadge role={o.role} />
                    <span className="text-[11px] text-sentinel-400 truncate pr-2">{o.unit ?? '—'}</span>
                    {canManage ? (
                      <div className="flex items-center gap-1.5">
                        <select
                          value={o.manager_id ?? ''}
                          disabled={busyId === o.id}
                          onChange={e => handleManagerChange(o, e.target.value)}
                          className="flex-1 bg-surface-raised border border-surface-border rounded px-1.5 py-1 text-[10px] text-sentinel-200 focus:outline-none focus:border-accent-blue/40 disabled:opacity-50"
                        >
                          <option value="">— none —</option>
                          {all.filter(m => m.id !== o.id).map(m => (
                            <option key={m.id} value={m.id}>{m.full_name}</option>
                          ))}
                        </select>
                        {busyId === o.id && <Loader2 className="w-3 h-3 animate-spin text-sentinel-500 shrink-0" />}
                      </div>
                    ) : (
                      <span className="text-[11px] text-sentinel-400 truncate">{manager?.full_name ?? '—'}</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Right side (1/3) */}
          <div className="space-y-4">
            <div className="bg-surface-card border border-surface-border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <GitBranch className="w-3.5 h-3.5 text-sentinel-400" />
                <h2 className="text-xs font-semibold text-sentinel-100">Clearance Distribution</h2>
              </div>
              <div className="space-y-2">
                {ROLE_ORDER.map(role => (
                  <div key={role} className="flex items-center justify-between py-2 border-b border-surface-border last:border-0">
                    <RoleBadge role={role} />
                    <span className="font-mono text-[11px] text-sentinel-300">{roleCounts[role] ?? 0} active</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-surface-card border border-surface-border rounded-xl p-4">
              <h2 className="text-xs font-semibold text-sentinel-100 mb-2">Roster Total</h2>
              <p className="text-2xl font-bold text-sentinel-50">{all.length}</p>
              <p className="text-[10px] text-sentinel-500 mt-1">officers across all clearance levels</p>
            </div>

            {!canManage && (
              <p className="text-[11px] text-sentinel-500 leading-relaxed">
                Reassigning reporting lines requires officer:manage (administrator clearance).
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
