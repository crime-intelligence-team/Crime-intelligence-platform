import { useState } from 'react'
import { FileText, AlertTriangle, CheckCircle, Clock, Plus, Search, ChevronRight, X, Globe, Shield } from 'lucide-react'
import { SkeletonRow } from '../components/ui/Skeletons'

type DirectiveStatus = 'active' | 'pending' | 'expired' | 'escalated'
type DirectivePriority = 'critical' | 'high' | 'medium' | 'low'

interface Directive {
  id: string
  code: string
  title: string
  status: DirectiveStatus
  priority: DirectivePriority
  issuedBy: string
  issuedAt: string
  expiresAt: string
  scope: string
  description: string
  affectedNodes: number
}

const MOCK_DIRECTIVES: Directive[] = [
  { id: 'd1', code: 'DIR-2024-001A', title: 'Global Multi-Factor Mandate — Tier 1–3', status: 'active', priority: 'critical', issuedBy: 'OP-SYS-CORE', issuedAt: '2024-01-15 08:00 UTC', expiresAt: '2025-01-15 08:00 UTC', scope: 'Global / All Tiers', description: 'All Tier 1–3 operators must authenticate via MFA on every session. Enforcement automated. Non-compliant sessions terminated after 90s.', affectedNodes: 508 },
  { id: 'd2', code: 'DIR-2024-012C', title: 'Telemetry Retention Override — Sector 7', status: 'escalated', priority: 'high', issuedBy: 'OP-774A', issuedAt: '2024-03-02 11:15 UTC', expiresAt: '2024-12-31 23:59 UTC', scope: 'Region: Sector 7', description: 'Extended telemetry retention to 180 days for Sector 7 nodes due to ongoing investigation BLR-2024-089. Compliance Risk: 38%.', affectedNodes: 42 },
  { id: 'd3', code: 'DIR-2023-091B', title: 'Node Isolation Protocol — Alpha Tier', status: 'active', priority: 'high', issuedBy: 'CMD-LEVEL', issuedAt: '2023-11-20 09:00 UTC', expiresAt: '2026-11-20 09:00 UTC', scope: 'Alpha-Class Nodes', description: 'Automatic isolation of Alpha-class nodes on anomaly score ≥ 85. Triggered 3 times in last 30 days.', affectedNodes: 14 },
  { id: 'd4', code: 'DIR-2024-034D', title: 'Cross-District Data Sync Pause', status: 'pending', priority: 'medium', issuedBy: 'OP-219C', issuedAt: '2024-06-10 14:30 UTC', expiresAt: '2024-07-10 14:30 UTC', scope: 'Districts: BLR, MYS, MNG', description: 'Temporary pause on inter-district telemetry sync during infrastructure upgrade window. Pending CL-5 approval.', affectedNodes: 127 },
  { id: 'd5', code: 'DIR-2023-044A', title: 'Clearance Renewal Mandate — CL-3', status: 'expired', priority: 'low', issuedBy: 'SYS-AUTO', issuedAt: '2023-06-01 00:00 UTC', expiresAt: '2024-06-01 00:00 UTC', scope: 'CL-3 Operators', description: 'All CL-3 operators required to complete annual clearance renewal. 412 operators processed.', affectedNodes: 412 },
  { id: 'd6', code: 'DIR-2024-055B', title: 'Emergency Access Revocation — EXT-PROXY-99', status: 'active', priority: 'critical', issuedBy: 'CMD-LEVEL', issuedAt: '2024-07-19 04:22 UTC', expiresAt: 'Indefinite', scope: 'External: EXT-PROXY-99', description: 'Immediate revocation of all access credentials for EXT-PROXY-99. All connections terminated. Post-incident forensic hold active.', affectedNodes: 1 },
]

const statusConfig = {
  active:   { label: 'Active',   color: 'text-accent-emerald', bg: 'bg-accent-emerald/10 border-accent-emerald/30', icon: CheckCircle },
  pending:  { label: 'Pending',  color: 'text-accent-amber',   bg: 'bg-accent-amber/10 border-accent-amber/30',     icon: Clock        },
  expired:  { label: 'Expired',  color: 'text-sentinel-400',   bg: 'bg-surface-hover border-surface-border',        icon: X            },
  escalated:{ label: 'Escalated',color: 'text-severity-critical', bg: 'bg-severity-critical/10 border-severity-critical/30', icon: AlertTriangle },
}

const priorityConfig = {
  critical: 'bg-severity-critical/15 text-severity-critical border-severity-critical/30',
  high:     'bg-accent-amber/15 text-accent-amber border-accent-amber/30',
  medium:   'bg-accent-blue/15 text-accent-blue border-accent-blue/30',
  low:      'bg-surface-hover text-sentinel-400 border-surface-border',
}

export default function GovernanceDirectives() {
  const [search, setSearch]         = useState('')
  const [filterStatus, setFilter]   = useState<DirectiveStatus | 'all'>('all')
  const [selected, setSelected]     = useState<Directive | null>(null)
  const loading = false

  const filtered = MOCK_DIRECTIVES.filter(d => {
    const matchSearch = d.title.toLowerCase().includes(search.toLowerCase()) || d.code.toLowerCase().includes(search.toLowerCase())
    const matchStatus = filterStatus === 'all' || d.status === filterStatus
    return matchSearch && matchStatus
  })

  return (
    <div className="h-full overflow-hidden flex flex-col bg-surface-base">
      {/* Header */}
      <div className="px-6 py-4 border-b border-surface-border shrink-0 bg-surface-raised flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-sentinel-50">Directives</h1>
          <p className="text-xs text-sentinel-400 mt-0.5">{MOCK_DIRECTIVES.filter(d => d.status === 'active').length} active · {MOCK_DIRECTIVES.filter(d => d.status === 'escalated').length} escalated · {MOCK_DIRECTIVES.filter(d => d.status === 'pending').length} pending approval</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Status filter tabs */}
          <div className="flex items-center bg-surface-card border border-surface-border rounded-lg p-0.5 gap-0.5">
            {(['all', 'active', 'escalated', 'pending', 'expired'] as const).map(s => (
              <button key={s} onClick={() => setFilter(s)}
                className={`px-3 py-1 rounded text-[10px] font-semibold uppercase tracking-wider transition-colors ${
                  filterStatus === s ? 'bg-surface-hover text-sentinel-100' : 'text-sentinel-500 hover:text-sentinel-300'
                }`}>
                {s}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-sentinel-500" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search directives..."
              className="pl-7 pr-3 py-1.5 bg-surface-card border border-surface-border rounded-lg text-[11px] text-sentinel-200 placeholder-sentinel-600 focus:outline-none focus:border-accent-blue/40 w-44" />
          </div>
          <button className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-blue text-white rounded-lg text-xs font-semibold hover:bg-accent-blue/90 transition-colors">
            <Plus className="w-3.5 h-3.5" /> Create Directive
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Directive list */}
        <div className="flex-1 overflow-y-auto">
          {/* Table header */}
          <div className="grid px-5 py-2.5 border-b border-surface-border bg-surface-raised/50 text-[10px] font-semibold tracking-widest text-sentinel-500 uppercase"
            style={{ gridTemplateColumns: '130px 1fr 90px 90px 100px 100px 24px' }}>
            <span>Code</span><span>Directive</span><span>Priority</span><span>Status</span><span>Scope</span><span>Expires</span><span />
          </div>

          {loading ? (
            Array.from({length: 6}).map((_, i) => <SkeletonRow key={i} cols={6} />)
          ) : filtered.map(d => {
            const sc = statusConfig[d.status]
            const StatusIcon = sc.icon
            return (
              <div key={d.id} onClick={() => setSelected(d)}
                className={`grid px-5 py-4 border-b border-surface-border cursor-pointer transition-colors hover:bg-surface-hover items-center ${selected?.id === d.id ? 'bg-accent-blue/5 border-l-2 border-l-accent-blue' : ''}`}
                style={{ gridTemplateColumns: '130px 1fr 90px 90px 100px 100px 24px' }}>
                <span className="font-mono text-[10px] text-sentinel-400">{d.code}</span>
                <div className="pr-4">
                  <p className="text-xs font-medium text-sentinel-100 leading-snug">{d.title}</p>
                  <p className="text-[10px] text-sentinel-500 mt-0.5">{d.affectedNodes} nodes affected</p>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase w-fit ${priorityConfig[d.priority]}`}>{d.priority}</span>
                <div className={`flex items-center gap-1 px-2 py-0.5 rounded border w-fit text-[10px] font-semibold ${sc.bg} ${sc.color}`}>
                  <StatusIcon className="w-3 h-3" /> {sc.label}
                </div>
                <span className="text-[10px] text-sentinel-400 truncate pr-2">{d.scope}</span>
                <span className="font-mono text-[10px] text-sentinel-500 truncate">{d.expiresAt === 'Indefinite' ? '∞ Indefinite' : d.expiresAt.split(' ')[0]}</span>
                <ChevronRight className="w-3.5 h-3.5 text-sentinel-600" />
              </div>
            )
          })}

          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-sentinel-500">
              <FileText className="w-8 h-8 mb-2" />
              <p className="text-sm">No directives match your filter</p>
            </div>
          )}
        </div>

        {/* Detail drawer */}
        {selected && (
          <div className="w-[340px] shrink-0 border-l border-surface-border bg-surface-raised overflow-y-auto flex flex-col animate-slide-in-right">
            <div className="px-4 py-3 border-b border-surface-border flex items-center justify-between shrink-0">
              <h2 className="text-sm font-semibold text-sentinel-100">Directive Detail</h2>
              <button onClick={() => setSelected(null)} className="p-1 rounded text-sentinel-500 hover:text-sentinel-200"><X className="w-3.5 h-3.5" /></button>
            </div>

            <div className="px-4 py-4 space-y-4 flex-1">
              <div>
                <p className="font-mono text-[10px] text-sentinel-500 mb-1">{selected.code}</p>
                <h3 className="text-sm font-semibold text-sentinel-50 leading-snug">{selected.title}</h3>
              </div>

              <div className="flex gap-2">
                <span className={`text-[10px] font-bold px-2 py-1 rounded border ${priorityConfig[selected.priority]}`}>{selected.priority.toUpperCase()}</span>
                <span className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded border ${statusConfig[selected.status].bg} ${statusConfig[selected.status].color}`}>
                  {selected.status.toUpperCase()}
                </span>
              </div>

              <div className="space-y-3">
                {[
                  { label: 'Issued By',    value: selected.issuedBy,    icon: Shield },
                  { label: 'Issued At',    value: selected.issuedAt,    icon: Clock },
                  { label: 'Expires',      value: selected.expiresAt,   icon: Clock },
                  { label: 'Scope',        value: selected.scope,       icon: Globe },
                  { label: 'Affected Nodes', value: `${selected.affectedNodes} nodes`, icon: FileText },
                ].map(item => (
                  <div key={item.label} className="flex items-start gap-2">
                    <item.icon className="w-3.5 h-3.5 text-sentinel-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[10px] text-sentinel-500">{item.label}</p>
                      <p className="font-mono text-xs text-sentinel-200">{item.value}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-surface-card border border-surface-border rounded-lg p-3">
                <p className="text-[10px] font-semibold tracking-widest text-sentinel-500 uppercase mb-2">Description</p>
                <p className="text-xs text-sentinel-300 leading-relaxed">{selected.description}</p>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-2">
                {selected.status === 'pending' && (
                  <button className="w-full py-2.5 rounded-lg bg-accent-emerald/10 border border-accent-emerald/30 text-accent-emerald text-xs font-semibold hover:bg-accent-emerald/20 transition-colors">
                    ✓ Approve Directive
                  </button>
                )}
                {selected.status === 'active' && (
                  <button className="w-full py-2.5 rounded-lg bg-accent-amber/10 border border-accent-amber/30 text-accent-amber text-xs font-semibold hover:bg-accent-amber/20 transition-colors">
                    ⏸ Suspend Directive
                  </button>
                )}
                <button className="w-full py-2.5 rounded-lg bg-severity-critical/10 border border-severity-critical/30 text-severity-critical text-xs font-semibold hover:bg-severity-critical/20 transition-colors">
                  ⊗ Revoke Directive
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
