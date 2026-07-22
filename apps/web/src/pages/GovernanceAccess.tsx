import { useState } from 'react'
import { Users, Shield, Lock, Activity, Search, Filter, Plus, Eye, Ban, ChevronDown } from 'lucide-react'
import { useApi } from '../hooks/useApi'
import { governanceApi } from '../services/api'
import { SkeletonRow } from '../components/ui/Skeletons'
import { Pagination } from '../components/ui/Pagination'

const CLEARANCE_COLORS: Record<number, string> = {
  5: 'bg-severity-critical/15 border-severity-critical/40 text-severity-critical',
  4: 'bg-accent-amber/15 border-accent-amber/40 text-accent-amber',
  3: 'bg-accent-blue/15 border-accent-blue/40 text-accent-blue',
  2: 'bg-surface-hover border-surface-border text-sentinel-300',
  1: 'bg-surface-card border-surface-border text-sentinel-400',
}

const TIER_NAMES = ['', 'Observer', 'Analyst', 'Operational', 'Strategic', 'Command']

// Mock active sessions (local mock only — not in governance API yet)
const ACTIVE_SESSIONS = [
  { id: 'sess-001', operatorId: 'OP-774A', name: 'K. Chen', ip: '10.42.1.92', started: '11:24 UTC', region: 'BLR-DC', clearance: 4 },
  { id: 'sess-002', operatorId: 'SYS-AUTO', name: 'Automation Engine', ip: '10.0.0.1', started: '09:00 UTC', region: 'GLOBAL', clearance: 5 },
  { id: 'sess-003', operatorId: 'OP-219C', name: 'M. Rao', ip: '10.42.3.11', started: '12:05 UTC', region: 'MYS-OPS', clearance: 3 },
  { id: 'sess-004', operatorId: 'OP-441B', name: 'S. Kumar', ip: '10.42.2.57', started: '13:18 UTC', region: 'HBL-FWD', clearance: 3 },
]

// Permission toggle block
function PermissionToggle({ label, enabled }: { label: string; enabled: boolean }) {
  const [on, setOn] = useState(enabled)
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-surface-border last:border-0">
      <span className="text-xs text-sentinel-300">{label}</span>
      <button onClick={() => setOn(v => !v)}
        className={`relative w-10 h-5 rounded-full border transition-colors ${on ? 'bg-accent-blue/20 border-accent-blue/50' : 'bg-surface-hover border-surface-border'}`}>
        <span className={`absolute top-0.5 w-4 h-4 rounded-full transition-all ${on ? 'left-5 bg-accent-blue' : 'left-0.5 bg-sentinel-500'}`} />
      </button>
    </div>
  )
}

export default function GovernanceAccess() {
  const [search, setSearch]     = useState('')
  const [page, setPage]         = useState(1)
  const [expanded, setExpanded] = useState<string | null>(null)
  const { data: levels, loading } = useApi(governanceApi.clearanceLevels)

  const filteredSessions = ACTIVE_SESSIONS.filter(s =>
    s.operatorId.toLowerCase().includes(search.toLowerCase()) ||
    s.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="h-full overflow-y-auto bg-surface-base">
      <div className="max-w-[1200px] mx-auto px-6 py-6">

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-sentinel-50">Access Control</h1>
            <p className="text-xs text-sentinel-400 mt-0.5">Operator clearance tiers, active sessions, and permission management</p>
          </div>
          <div className="flex gap-2">
            <button className="flex items-center gap-2 px-4 py-2 bg-surface-card border border-surface-border text-sentinel-300 rounded-lg text-xs font-semibold hover:bg-surface-hover transition-colors">
              <Filter className="w-3.5 h-3.5" /> Filter
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-accent-blue text-white rounded-lg text-xs font-semibold hover:bg-accent-blue/90 transition-colors">
              <Plus className="w-3.5 h-3.5" /> Add Operator
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          {[
            { icon: Users,  label: 'Total Operators', value: '508', sub: '+3 this week' },
            { icon: Activity, label: 'Active Sessions',  value: ACTIVE_SESSIONS.length.toString(), sub: 'Currently online' },
            { icon: Shield, label: 'CL-5 Command',      value: '12',  sub: 'Full authority' },
            { icon: Lock,   label: 'Locked Accounts',   value: '2',   sub: 'Pending review' },
          ].map(s => (
            <div key={s.label} className="bg-surface-card border border-surface-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-semibold tracking-widest text-sentinel-500 uppercase">{s.label}</span>
                <s.icon className="w-4 h-4 text-sentinel-600" />
              </div>
              <p className="text-2xl font-bold text-sentinel-50">{s.value}</p>
              <p className="text-[10px] text-sentinel-500 mt-0.5">{s.sub}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-4">
          {/* Left — Clearance Architecture */}
          <div className="col-span-1">
            <div className="bg-surface-card border border-surface-border rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-surface-border flex items-center justify-between">
                <h2 className="text-sm font-semibold text-sentinel-100">Clearance Architecture</h2>
                <button className="text-[10px] text-accent-blue hover:underline">Manage Hierarchy</button>
              </div>
              {loading ? (
                <div className="p-4 space-y-2">{Array.from({length:5}).map((_,i)=><SkeletonRow key={i} cols={2} />)}</div>
              ) : (
                <div>
                  {(levels ?? []).map(cl => (
                    <div key={cl.code}>
                      <div
                        onClick={() => setExpanded(expanded === cl.code ? null : cl.code)}
                        className="flex items-center gap-3 px-4 py-3 border-b border-surface-border hover:bg-surface-hover cursor-pointer transition-colors"
                      >
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${CLEARANCE_COLORS[cl.level] ?? ''}`}>
                          {cl.code}
                        </span>
                        <div className="flex-1">
                          <p className="text-xs font-medium text-sentinel-100">{cl.name}</p>
                          <p className="text-[10px] text-sentinel-500">{TIER_NAMES[cl.level]}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-sentinel-50">{cl.activeCount}</p>
                          <p className="text-[10px] text-sentinel-500">Active</p>
                        </div>
                        <ChevronDown className={`w-3.5 h-3.5 text-sentinel-500 transition-transform ${expanded === cl.code ? 'rotate-180' : ''}`} />
                      </div>
                      {expanded === cl.code && (
                        <div className="px-4 py-3 bg-surface-base border-b border-surface-border animate-fade-in">
                          <p className="text-[10px] text-sentinel-400 mb-3">{cl.description}</p>
                          <div className="space-y-0.5">
                            <PermissionToggle label="Read system logs"    enabled={cl.level >= 1} />
                            <PermissionToggle label="Export case reports" enabled={cl.level >= 2} />
                            <PermissionToggle label="Create directives"   enabled={cl.level >= 4} />
                            <PermissionToggle label="Emergency override"  enabled={cl.level >= 5} />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right — Active Sessions */}
          <div className="col-span-2">
            <div className="bg-surface-card border border-surface-border rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-surface-border flex items-center justify-between">
                <h2 className="text-sm font-semibold text-sentinel-100 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-accent-emerald" />
                  Active Sessions
                  <span className="text-[10px] font-normal text-sentinel-500">— {ACTIVE_SESSIONS.length} online</span>
                </h2>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-sentinel-500" />
                  <input value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Search operators..."
                    className="pl-7 pr-3 py-1.5 bg-surface-hover border border-surface-border rounded-lg text-[11px] text-sentinel-200 placeholder-sentinel-600 focus:outline-none focus:border-accent-blue/40 w-44"
                  />
                </div>
              </div>

              {/* Session table header */}
              <div className="grid px-4 py-2 border-b border-surface-border text-[10px] font-semibold tracking-widest text-sentinel-500 uppercase"
                style={{ gridTemplateColumns: '100px 1fr 100px 80px 80px 72px' }}>
                <span>Operator</span><span>Name</span><span>Region</span><span>Started</span><span>CL</span><span>Actions</span>
              </div>

              {filteredSessions.map(s => (
                <div key={s.id}
                  className="grid px-4 py-3.5 border-b border-surface-border hover:bg-surface-hover transition-colors items-center"
                  style={{ gridTemplateColumns: '100px 1fr 100px 80px 80px 72px' }}>
                  <span className="font-mono text-xs text-sentinel-100">{s.operatorId}</span>
                  <div>
                    <p className="text-xs text-sentinel-200">{s.name}</p>
                    <p className="text-[10px] text-sentinel-500 font-mono">{s.ip}</p>
                  </div>
                  <span className="text-[11px] text-sentinel-400">{s.region}</span>
                  <span className="font-mono text-[10px] text-sentinel-400">{s.started}</span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border w-fit ${CLEARANCE_COLORS[s.clearance]}`}>
                    CL-{s.clearance}
                  </span>
                  <div className="flex items-center gap-1">
                    <button title="View" className="p-1.5 rounded hover:bg-surface-border text-sentinel-500 hover:text-sentinel-200 transition-colors"><Eye className="w-3 h-3" /></button>
                    <button title="Revoke" className="p-1.5 rounded hover:bg-severity-critical/10 text-sentinel-500 hover:text-severity-critical transition-colors"><Ban className="w-3 h-3" /></button>
                  </div>
                </div>
              ))}

              <div className="px-4 py-3 flex items-center justify-between border-t border-surface-border">
                <span className="text-[10px] text-sentinel-500">Showing {filteredSessions.length} sessions</span>
                <Pagination page={page} total={filteredSessions.length} perPage={10} onPageChange={setPage} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
