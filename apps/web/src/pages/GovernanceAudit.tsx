import { useState } from 'react'
import { Search, Filter, Download, ChevronLeft, ChevronRight } from 'lucide-react'
import { AuditRiskBadge, AuditStatusBadge } from '../components/ui/Badge'
import { auditLog } from '../data/governance'

const COLS = ['TIMESTAMP (UTC)', 'OPERATOR ID', 'ACTION TYPE', 'TARGET ENTITY', 'RISK', 'STATUS']

export default function GovernanceAudit() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const total = 247
  const filtered = auditLog.filter(e =>
    !search || [e.operatorId, e.actionType, e.targetEntity].some(s => s.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-surface-border shrink-0 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-sentinel-50">Global Audit Log</h1>
          <p className="text-xs text-sentinel-400 mt-0.5">Comprehensive record of all system events and access attempts.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-sentinel-500" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search log entries..."
              className="pl-8 pr-3 py-1.5 bg-surface-card border border-surface-border rounded-lg text-xs text-sentinel-100 placeholder-sentinel-500 focus:outline-none focus:border-accent-blue/40 w-52 transition-colors" />
          </div>
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-sentinel-300 border border-surface-border hover:bg-surface-hover transition-colors">
            <Filter className="w-3.5 h-3.5" /> Filter
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-sentinel-300 border border-surface-border hover:bg-surface-hover transition-colors">
            <Download className="w-3.5 h-3.5" /> Export
          </button>
        </div>
      </div>

      {/* Table header */}
      <div className="grid border-b border-surface-border bg-surface-raised/50 shrink-0"
        style={{ gridTemplateColumns: '160px 120px 1fr 1fr 80px 100px' }}>
        {COLS.map(c => (
          <div key={c} className="px-4 py-2.5 section-label">{c}</div>
        ))}
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-y-auto">
        {filtered.map(e => (
          <div key={e.id}
            className="grid items-center border-b border-surface-border hover:bg-surface-hover transition-colors"
            style={{ gridTemplateColumns: '160px 120px 1fr 1fr 80px 100px' }}>
            <div className="px-4 py-3 font-mono text-[10px] text-sentinel-300 leading-tight whitespace-pre-line">{e.timestamp}</div>
            <div className="px-4 py-3 font-mono text-[11px] text-sentinel-100">{e.operatorId}</div>
            <div className="px-4 py-3 text-xs text-sentinel-200">{e.actionType}</div>
            <div className="px-4 py-3 font-mono text-[11px] text-sentinel-300">{e.targetEntity}</div>
            <div className="px-4 py-3"><AuditRiskBadge risk={e.risk} /></div>
            <div className="px-4 py-3"><AuditStatusBadge status={e.status} /></div>
          </div>
        ))}
      </div>

      {/* Footer pagination */}
      <div className="px-6 py-3 border-t border-surface-border shrink-0 flex items-center justify-between">
        <span className="font-mono text-[11px] text-sentinel-400">{total} total entries</span>
        <div className="flex items-center gap-2">
          <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page===1}
            className="p-1.5 rounded text-sentinel-400 hover:text-sentinel-200 hover:bg-surface-hover disabled:opacity-40 transition-colors">
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          {[1,2,3,'...',10].map((p, i) => (
            typeof p === 'number'
              ? <button key={i} onClick={() => setPage(p)}
                  className={`w-7 h-7 rounded text-xs font-medium transition-colors ${p===page ? 'bg-accent-blue text-white' : 'text-sentinel-300 hover:bg-surface-hover'}`}>{p}</button>
              : <span key={i} className="text-sentinel-500 text-xs">...</span>
          ))}
          <button onClick={() => setPage(p => p+1)}
            className="p-1.5 rounded text-sentinel-400 hover:text-sentinel-200 hover:bg-surface-hover transition-colors">
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
