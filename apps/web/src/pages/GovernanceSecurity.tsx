import { ProgressBar } from '../components/ui/ProgressBar'
import { NodeIntegrityBadge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Shield, ExternalLink, Filter, Plus, Eye } from 'lucide-react'
import { securityDirectives, nodeIntegrity } from '../data/governance'

// ── Circular SVG Gauge ────────────────────────────────────────────────────────
function SecurityGauge({ value }: { value: number }) {
  const r = 56, cx = 70, cy = 70
  const circ = 2 * Math.PI * r
  const dash = (value / 100) * circ
  return (
    <div className="flex flex-col items-center">
      <svg width={140} height={140} viewBox="0 0 140 140">
        {/* Background ring */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1e293b" strokeWidth={10} />
        {/* Progress arc */}
        <circle cx={cx} cy={cy} r={r} fill="none"
          stroke="#22c55e" strokeWidth={10} strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          transform="rotate(-90 70 70)"
        />
        {/* Center text */}
        <text x={cx} y={cy - 8} textAnchor="middle" fontSize={22} fontWeight={700} fill="#f1f5f9" fontFamily="Inter, sans-serif">
          {value}%
        </text>
        <text x={cx} y={cy + 12} textAnchor="middle" fontSize={11} fill="#22c55e" letterSpacing={2} fontFamily="Inter, sans-serif">
          SECURE
        </text>
      </svg>
    </div>
  )
}

// ── Directive card ────────────────────────────────────────────────────────────
function DirectiveCard({ d }: { d: typeof securityDirectives[0] }) {
  const pct = d.enforcementProgress
  const color: 'green' | 'amber' | 'red' = pct >= 90 ? 'green' : pct >= 40 ? 'amber' : 'red'
  return (
    <div className="bg-surface-card border border-surface-border rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-[10px] text-sentinel-400">{d.dirCode}</span>
            <ExternalLink className="w-3 h-3 text-sentinel-600" />
          </div>
          <h3 className="text-xs font-semibold text-sentinel-100 leading-snug">{d.title}</h3>
        </div>
      </div>
      <p className="text-[11px] text-sentinel-400 leading-relaxed flex-1">{d.description}</p>
      <div>
        <div className="flex justify-between text-[10px] mb-1">
          <span className="text-sentinel-400">Enforcement Progress</span>
          <span className={`font-mono font-medium ${color === 'green' ? 'text-accent-emerald' : color === 'amber' ? 'text-accent-amber' : 'text-severity-critical'}`}>{pct}%</span>
        </div>
        <ProgressBar value={pct} color={color} showValue={false} height="thin" />
      </div>
    </div>
  )
}

export default function GovernanceSecurity() {
  return (
    <div className="h-full overflow-y-auto p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-sentinel-50">Governance & Compliance</h1>
          <p className="text-xs text-sentinel-400 mt-1">National Cyber Security Infrastructure Framework</p>
        </div>
        <div className="flex items-center gap-4 text-[10px] font-mono text-sentinel-400">
          <span className="px-2.5 py-1 bg-surface-card border border-surface-border rounded">LAST SYNC: 14:32:01 UTC</span>
          <span className="px-2.5 py-1 bg-surface-card border border-surface-border rounded">NODE REGION: GLOBAL_ALPHA</span>
        </div>
      </div>

      {/* Main 2-panel row */}
      <div className="grid grid-cols-5 gap-4 mb-4">
        {/* Security Posture (2/5) */}
        <div className="col-span-2 bg-surface-card border border-surface-border rounded-xl p-5 flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-sentinel-400" />
            <h2 className="text-sm font-semibold text-sentinel-100">Security Posture</h2>
          </div>
          <SecurityGauge value={88} />
          <div className="space-y-3">
            <ProgressBar value={98} color="green" label="Core Infrastructure"    />
            <ProgressBar value={76} color="amber" label="Endpoint Compliance"    />
          </div>
        </div>

        {/* Node Integrity Matrix (3/5) */}
        <div className="col-span-3 bg-surface-card border border-surface-border rounded-xl p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-sentinel-100 flex items-center gap-2">
              <Eye className="w-4 h-4 text-sentinel-400" /> Node Integrity Matrix
            </h2>
            <Button variant="secondary" size="sm"><Eye className="w-3.5 h-3.5" /> VIEW TOPOLOGY</Button>
          </div>

          {/* Quick stats row */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'GLOBAL UPTIME',     value: '99.97%'  },
              { label: 'ACTIVE NODES',       value: '1,247'   },
              { label: 'DATA STORES SYNCED', value: '98/100'  },
              { label: 'ANOMALIES DETECTED', value: '3', highlight: true },
            ].map(s => (
              <div key={s.label}
                className={`rounded-lg p-2.5 border text-center ${s.highlight ? 'bg-severity-critical/10 border-severity-critical/30' : 'bg-surface-raised border-surface-border'}`}>
                <p className="section-label mb-1">{s.label}</p>
                <p className={`text-lg font-bold font-mono ${s.highlight ? 'text-severity-critical' : 'text-sentinel-50'}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Node table */}
          <div className="rounded-lg overflow-hidden border border-surface-border">
            <div className="grid bg-surface-raised/50 border-b border-surface-border"
              style={{ gridTemplateColumns: '1fr 1fr 1.5fr 1fr' }}>
              {['NODE_ID','DESCRIPTION','TYPE','STATUS'].map(h => (
                <div key={h} className="px-3 py-2 section-label">{h}</div>
              ))}
            </div>
            {nodeIntegrity.map(n => (
              <div key={n.nodeId} className="grid items-center border-b border-surface-border last:border-0 hover:bg-surface-hover transition-colors"
                style={{ gridTemplateColumns: '1fr 1fr 1.5fr 1fr' }}>
                <div className="px-3 py-2.5 font-mono text-[11px] text-sentinel-100">{n.nodeId}</div>
                <div className="px-3 py-2.5 font-mono text-[11px] text-sentinel-300">{n.description}</div>
                <div className="px-3 py-2.5 font-mono text-[11px] text-sentinel-300 capitalize">{n.type}</div>
                <div className="px-3 py-2.5"><NodeIntegrityBadge status={n.status} /></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Active Directives */}
      <div className="bg-surface-card border border-surface-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-sentinel-100">Active Security Directives</h2>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm"><Filter className="w-3.5 h-3.5" /> FILTER</Button>
            <Button variant="primary" size="sm"><Plus className="w-3.5 h-3.5" /> ISSUE DIRECTIVE</Button>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {securityDirectives.map(d => <DirectiveCard key={d.id} d={d} />)}
        </div>
      </div>
    </div>
  )
}
