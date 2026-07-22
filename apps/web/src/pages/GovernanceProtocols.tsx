import { Filter, Plus, Key, AlertTriangle, Shield } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { ProgressBar } from '../components/ui/ProgressBar'
import { policyDirectives, clearanceLevels } from '../data/governance'

const policyStatusColors: Record<string, string> = {
  enforced: 'bg-accent-emerald/10 text-accent-emerald border-accent-emerald/30',
  alert:    'bg-accent-amber/10    text-accent-amber   border-accent-amber/30',
  pending:  'bg-surface-hover      text-sentinel-400   border-surface-border',
}

const iconMap: Record<string, any> = { key: Key, warning: AlertTriangle, shield: Shield }

function PolicyCard({ d }: { d: typeof policyDirectives[0] }) {
  const Icon = iconMap[d.icon] ?? Shield
  const progressColor: 'green' | 'amber' | 'red' =
    d.enforcementProgress >= 90 ? 'green' : d.enforcementProgress >= 40 ? 'amber' : 'red'

  return (
    <div className="bg-surface-card border border-surface-border rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-surface-hover border border-surface-border flex items-center justify-center shrink-0">
            <Icon className="w-4 h-4 text-sentinel-300" />
          </div>
          <div>
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-semibold tracking-wide ${policyStatusColors[d.status]}`}>
              {d.status.toUpperCase()}
            </span>
          </div>
        </div>
        {/* Toggle switch */}
        <button className={`relative w-8 h-4 rounded-full transition-colors shrink-0 ${d.enabled ? 'bg-accent-emerald' : 'bg-surface-hover border border-surface-border'}`}>
          <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${d.enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
        </button>
      </div>
      <div>
        <h3 className="text-xs font-semibold text-sentinel-100 mb-1">{d.name}</h3>
        <p className="text-[11px] text-sentinel-400 leading-relaxed">{d.description}</p>
      </div>
      <div className="flex flex-wrap gap-1">
        {d.tags.map(t => (
          <span key={t} className="tag-pill">{t}</span>
        ))}
      </div>
      <ProgressBar value={d.enforcementProgress} color={progressColor} label="Enforcement" />
    </div>
  )
}

export default function GovernanceProtocols() {
  return (
    <div className="h-full overflow-y-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-sentinel-50">Protocol Engine</h1>
          <p className="text-xs text-sentinel-400 mt-0.5">Active Policy Enforcement & Clearance Architecture</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm"><Filter className="w-3.5 h-3.5" /> Filter</Button>
          <Button variant="primary"   size="sm"><Plus   className="w-3.5 h-3.5" /> Create Directive</Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Policy Cards (2/3) */}
        <div className="col-span-2 space-y-3">
          <h2 className="text-xs font-semibold text-sentinel-300 tracking-wide uppercase mb-2">Active Policies</h2>
          {policyDirectives.map(d => <PolicyCard key={d.id} d={d} />)}
        </div>

        {/* Right side (1/3) */}
        <div className="space-y-4">
          {/* Clearance Architecture */}
          <div className="bg-surface-card border border-surface-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold text-sentinel-100">Clearance Architecture</h2>
              <button className="text-[10px] tracking-wider text-sentinel-400 hover:text-sentinel-200 transition-colors uppercase">Manage Hierarchy</button>
            </div>
            <div className="space-y-2">
              {clearanceLevels.map(c => (
                <div key={c.code} className="flex items-center justify-between py-2 border-b border-surface-border last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-sentinel-100">{c.code}</span>
                    <span className="text-[11px] text-sentinel-400">{c.level}</span>
                  </div>
                  <span className="font-mono text-[11px] text-sentinel-300">{c.activeCount} active</span>
                </div>
              ))}
            </div>
          </div>

          {/* Enforcement summary */}
          <div className="bg-surface-card border border-surface-border rounded-xl p-4">
            <h2 className="text-xs font-semibold text-sentinel-100 mb-3">Enforcement Topology</h2>
            <div className="flex flex-col items-center gap-2 py-4">
              <div className="w-14 h-14 rounded-xl bg-accent-emerald/10 border border-accent-emerald/30 flex items-center justify-center">
                <Shield className="w-7 h-7 text-accent-emerald" />
              </div>
              <p className="text-[10px] text-sentinel-400 text-center leading-relaxed mt-1">
                All Tier 1 and Tier 2 policies<br/>currently enforced globally.
              </p>
              <div className="grid grid-cols-3 gap-3 w-full mt-3">
                <div className="text-center">
                  <p className="text-lg font-bold text-sentinel-50">5</p>
                  <p className="section-label">Active</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-accent-amber">2</p>
                  <p className="section-label">Alert</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-sentinel-400">1</p>
                  <p className="section-label">Pending</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
