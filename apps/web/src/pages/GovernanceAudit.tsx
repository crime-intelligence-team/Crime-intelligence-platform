import { useState } from 'react'
import { Search, Filter, ChevronLeft, ChevronRight, ShieldAlert, Loader2, History } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { adminApi } from '../services/endpoints'
import { useApi } from '../hooks/useApi'
import type { AuditLogEntry } from '@cip/shared-types'

const PAGE_SIZE = 25

const inputCls = 'pl-8 pr-3 py-1.5 bg-surface-card border border-surface-border rounded-lg text-xs text-sentinel-100 placeholder-sentinel-500 focus:outline-none focus:border-accent-blue/40 w-56 transition-colors'

const actionRisk: Record<string, string> = {
  step_up: 'high',
  mfa_enrolled: 'medium',
  exception_approved: 'high',
  exception_denied: 'medium',
  merge_executed: 'high',
  merge_reversed: 'medium',
  confidence_review_submitted: 'medium',
  confidence_review_accepted: 'high',
  login: 'low',
  export: 'medium',
}

const MODULES = ['auth', 'cases', 'network', 'governance', 'map', 'dashboard']

function ActionBadge({ action, success }: { action: string; success: boolean }) {
  const risk = !success ? 'high' : actionRisk[action] ?? (action.startsWith('exception') ? 'medium' : 'low')
  const cls =
    risk === 'high'
      ? 'bg-severity-tint-critical text-severity-critical border-severity-critical/30'
      : risk === 'medium'
        ? 'bg-severity-tint-high text-severity-high border-severity-high/30'
        : 'bg-surface-hover text-sentinel-400 border-surface-border'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-sm border text-[10px] font-bold tracking-wider ${cls}`}>
      {action.toUpperCase()}{!success ? ' ✕' : ''}
    </span>
  )
}

function fmt(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`
}

export default function GovernanceAudit() {
  const { hasPermission } = useAuth()
  const canView = hasPermission('audit:view')

  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [moduleFilter, setModuleFilter] = useState('')
  const [outcomeFilter, setOutcomeFilter] = useState<'' | 'success' | 'failed'>('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const { data, loading, error, refetch } = useApi(
    () =>
      adminApi.audit({
        page,
        page_size: PAGE_SIZE,
        q: search || undefined,
        action: actionFilter || undefined,
        module: moduleFilter || undefined,
        success: outcomeFilter === '' ? undefined : outcomeFilter === 'success',
        date_from: dateFrom ? new Date(dateFrom).toISOString() : undefined,
        date_to: dateTo ? new Date(dateTo).toISOString() : undefined,
      }),
    [page, search, actionFilter, moduleFilter, outcomeFilter, dateFrom, dateTo],
  )

  function applySearch(e: React.FormEvent) {
    e.preventDefault()
    setPage(1)
    refetch()
  }

  if (!canView) {
    return (
      <div className="h-full flex items-center justify-center bg-surface-base">
        <div className="max-w-sm text-center p-8 bg-surface-card border border-surface-border rounded-xl">
          <ShieldAlert className="w-6 h-6 text-accent-amber mx-auto mb-3" />
          <p className="text-sm font-semibold text-sentinel-100">Supervisor or Administrator Required</p>
          <p className="text-xs text-sentinel-400 mt-1.5 leading-relaxed">
            The audit log requires the audit:view permission.
          </p>
        </div>
      </div>
    )
  }

  const entries = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="h-full flex flex-col bg-surface-base">
      {/* Header */}
      <div className="px-6 py-4 border-b border-surface-border shrink-0 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-bold text-sentinel-50 flex items-center gap-2">
              <History className="w-4 h-4 text-accent-blue" /> Global Audit Log
            </h1>
            <p className="text-xs text-sentinel-400 mt-0.5">Append-only record of searches, views, exports, notes, and approvals.</p>
          </div>
          <form onSubmit={applySearch} className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-sentinel-500" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search log entries..."
              className={inputCls} />
          </form>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-sentinel-500 pointer-events-none" />
            <select value={actionFilter} onChange={e => { setActionFilter(e.target.value); setPage(1) }}
              className="pl-8 pr-3 py-1.5 bg-surface-card border border-surface-border rounded-lg text-xs text-sentinel-100 focus:outline-none focus:border-accent-blue/40 transition-colors">
              <option value="">All actions</option>
              {[...new Set(entries.map(e => e.action))].sort().map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
          <select value={moduleFilter} onChange={e => { setModuleFilter(e.target.value); setPage(1) }}
            className="px-3 py-1.5 bg-surface-card border border-surface-border rounded-lg text-xs text-sentinel-100 focus:outline-none focus:border-accent-blue/40 transition-colors">
            <option value="">All modules</option>
            {MODULES.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <select value={outcomeFilter} onChange={e => { setOutcomeFilter(e.target.value as typeof outcomeFilter); setPage(1) }}
            className="px-3 py-1.5 bg-surface-card border border-surface-border rounded-lg text-xs text-sentinel-100 focus:outline-none focus:border-accent-blue/40 transition-colors">
            <option value="">Any outcome</option>
            <option value="success">Success only</option>
            <option value="failed">Failed only</option>
          </select>
          <div className="flex items-center gap-1.5 text-xs text-sentinel-400">
            <span>From</span>
            <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1) }}
              className="px-2 py-1.5 bg-surface-card border border-surface-border rounded-lg text-xs text-sentinel-100 focus:outline-none focus:border-accent-blue/40 transition-colors" />
            <span>To</span>
            <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1) }}
              className="px-2 py-1.5 bg-surface-card border border-surface-border rounded-lg text-xs text-sentinel-100 focus:outline-none focus:border-accent-blue/40 transition-colors" />
          </div>
        </div>
      </div>

      {/* Table header */}
      <div className="grid border-b border-surface-border bg-surface-raised/50 shrink-0"
        style={{ gridTemplateColumns: '140px 150px 150px 100px 130px 1fr 90px' }}>
        <div className="px-4 py-2.5 section-label">TIMESTAMP (UTC)</div>
        <div className="px-4 py-2.5 section-label">ACTOR</div>
        <div className="px-4 py-2.5 section-label">ROLE / JURISDICTION</div>
        <div className="px-4 py-2.5 section-label">MODULE</div>
        <div className="px-4 py-2.5 section-label">ACTION</div>
        <div className="px-4 py-2.5 section-label">RESOURCE / DETAIL</div>
        <div className="px-4 py-2.5 section-label">ID</div>
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-y-auto">
        {loading && !entries.length ? (
          <div className="p-6 flex items-center justify-center text-sentinel-500">
            <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading audit trail…
          </div>
        ) : error ? (
          <div className="p-6 text-xs text-severity-critical bg-severity-critical/10 border border-severity-critical/30 rounded-lg m-6">
            {error}
          </div>
        ) : entries.length === 0 ? (
          <div className="p-10 text-center text-xs text-sentinel-500">No audit entries match this filter.</div>
        ) : (
          entries.map((e: AuditLogEntry) => (
            <div key={e.id}
              className="grid items-center border-b border-surface-border hover:bg-surface-hover transition-colors"
              style={{ gridTemplateColumns: '140px 150px 150px 100px 130px 1fr 90px' }}>
              <div className="px-4 py-3 font-mono text-[10px] text-sentinel-300">{fmt(e.created_at)}</div>
              <div className="px-4 py-3 font-mono text-[11px] text-sentinel-100 truncate">
                {e.actor_name ?? (e.actor_id ? `${e.actor_id.slice(0, 8)}…` : 'SYSTEM')}
              </div>
              <div className="px-4 py-3 text-[11px] text-sentinel-300 truncate">
                {e.actor_role ? e.actor_role.replace(/_/g, ' ') : '—'}
                {e.actor_district_name ? <span className="block text-[10px] text-sentinel-500 truncate">{e.actor_district_name}</span> : null}
              </div>
              <div className="px-4 py-3 text-[11px] text-sentinel-400 uppercase tracking-wide">{e.module ?? '—'}</div>
              <div className="px-4 py-3"><ActionBadge action={e.action} success={e.success} /></div>
              <div className="px-4 py-3 text-xs text-sentinel-300 leading-relaxed">
                <span className="text-sentinel-200">{e.resource_type ?? '—'}</span>
                {e.detail ? <span className="block font-mono text-[10px] text-sentinel-400 truncate max-w-[560px]">{e.detail}</span> : null}
              </div>
              <div className="px-4 py-3 font-mono text-[10px] text-sentinel-500 truncate">{e.resource_id?.slice(0, 8) ?? '—'}</div>
            </div>
          ))
        )}
      </div>

      {/* Footer pagination */}
      <div className="px-6 py-3 border-t border-surface-border shrink-0 flex items-center justify-between">
        <span className="font-mono text-[11px] text-sentinel-400">{total} total entries · page {page}/{totalPages}</span>
        <div className="flex items-center gap-2">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="p-1.5 rounded text-sentinel-400 hover:text-sentinel-200 hover:bg-surface-hover disabled:opacity-40 transition-colors">
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <span className="font-mono text-xs text-sentinel-400">{page}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
            className="p-1.5 rounded text-sentinel-400 hover:text-sentinel-200 hover:bg-surface-hover disabled:opacity-40 transition-colors">
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
