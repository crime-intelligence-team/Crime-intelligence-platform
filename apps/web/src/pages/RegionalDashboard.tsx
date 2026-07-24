import { useParams, useNavigate } from 'react-router-dom'
import { BarChart, Bar, ResponsiveContainer, Cell, Tooltip } from 'recharts'
import {
  ArrowLeft, Cpu, Bus, Building2, HeartPulse, Wifi,
} from 'lucide-react'
import { karnatakaDistricts } from '../data/districts'
import { incidentTrend72h } from '../data/analytics'

const entityIcons: Record<string, any> = {
  wifi: Wifi, bus: Bus, building: Building2, medical: HeartPulse, server: Cpu,
}
const statusDotColor: Record<string, string> = {
  critical: 'bg-severity-critical', elevated: 'bg-severity-elevated', normal: 'bg-sentinel-500',
}

export default function RegionalDashboard() {
  const { id } = useParams()
  const navigate = useNavigate()
  const district = karnatakaDistricts.find(d => d.id === id) ?? karnatakaDistricts[0]

  const peakIdx = incidentTrend72h.reduce((m, d, i, a) => d.v > a[m].v ? i : m, 0)

  const categories = [
    { label: 'Civil Unrest',    pct: 42, color: '#f43f5e' },
    { label: 'Infrastructure',  pct: 28, color: '#f59e0b' },
    { label: 'Cyber',           pct: 18, color: '#3b82f6' },
    { label: 'Logistics',       pct: 12, color: '#475569' },
  ]

  return (
    <div className="h-full overflow-y-auto p-6">
      {/* Back + header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <button onClick={() => navigate('/map')}
            className="flex items-center gap-1.5 text-xs text-sentinel-400 hover:text-sentinel-200 mb-2 transition-colors group">
            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" /> Back to Map
          </button>
          <h1 className="text-2xl font-bold text-sentinel-50">{district.name}</h1>
          <p className="text-xs text-sentinel-400 mt-0.5">District Intelligence Dashboard</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-severity-critical/10 border border-severity-critical/30 rounded-lg animate-pulse-glow-red">
          <span className="w-2 h-2 rounded-full bg-severity-critical animate-pulse" />
          <span className="text-xs font-semibold text-severity-critical tracking-widest">LIVE OPERATIONS</span>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3 mb-4 stagger-children">
        <div className="bg-surface-card border border-severity-critical/20 rounded-xl p-4" style={{ background: 'linear-gradient(135deg, rgba(239,68,68,0.06) 0%, transparent 60%)' }}>
          <p className="section-label mb-1">Total Active Incidents</p>
          <p className="text-3xl font-bold text-severity-critical animate-count-up">{district.totalIncidents.toLocaleString()}</p>
          <p className="text-[10px] text-accent-amber mt-1">▲ +{district.trend}% vs 24h</p>
        </div>
        <div className="bg-surface-card border border-accent-amber/20 rounded-xl p-4" style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.06) 0%, transparent 60%)' }}>
          <p className="section-label mb-1">Average Risk Score</p>
          <p className="text-3xl font-bold text-accent-amber animate-count-up">{district.riskScore}<span className="text-base text-sentinel-400">/100</span></p>
          <p className="text-[10px] text-sentinel-500 mt-1">— Stable</p>
        </div>
        <div className="bg-surface-card border border-accent-blue/20 rounded-xl p-4" style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.06) 0%, transparent 60%)' }}>
          <p className="section-label mb-1">Deployed Assets</p>
          <p className="text-3xl font-bold text-accent-blue animate-count-up">42</p>
          <p className="text-[10px] text-accent-emerald mt-1">✓ All units responding</p>
        </div>
        <div className="bg-surface-card border border-accent-emerald/20 rounded-xl p-4" style={{ background: 'linear-gradient(135deg, rgba(34,197,94,0.06) 0%, transparent 60%)' }}>
          <p className="section-label mb-1">System Uptime</p>
          <p className="text-3xl font-bold text-accent-emerald animate-count-up">99.98<span className="text-base text-sentinel-400">%</span></p>
          <p className="text-[10px] text-sentinel-500 mt-1">Node cluster nominal</p>
        </div>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-5 gap-4">
        {/* Left column (3/5) */}
        <div className="col-span-3 space-y-4">
          {/* Incident trend */}
          <div className="bg-surface-card border border-surface-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-sentinel-100">Incident Trend (72h)</h2>
              <button className="text-[10px] tracking-wider text-sentinel-400 border border-surface-border rounded px-2 py-1 hover:bg-surface-hover transition-colors">
                EXPORT
              </button>
            </div>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={incidentTrend72h} barSize={18}>
                  <Bar dataKey="v" radius={[2,2,0,0]}>
                    {incidentTrend72h.map((_, i) => (
                      <Cell key={i} fill={i === peakIdx ? '#f43f5e' : '#2d3a4d'} />
                    ))}
                  </Bar>
                  <Tooltip
                    contentStyle={{ background: '#1a2332', border: '1px solid #1e293b', borderRadius: 8, fontSize: 11 }}
                    labelStyle={{ color: '#94a3b8' }}
                    itemStyle={{ color: '#f1f5f9' }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Incident distribution */}
          <div className="bg-surface-card border border-surface-border rounded-xl p-5">
            <h2 className="text-sm font-semibold text-sentinel-100 mb-4">Incident Distribution by Category</h2>
            <div className="grid grid-cols-4 gap-4">
              {categories.map(c => (
                <div key={c.label}>
                  <p className="section-label mb-1.5">{c.label}</p>
                  <p className="text-xl font-bold mb-2" style={{ color: c.color }}>{c.pct}%</p>
                  <div className="h-1 rounded-full bg-surface-hover overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${c.pct}%`, background: c.color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right column (2/5) */}
        <div className="col-span-2 space-y-4">
          {/* Threat level */}
          <div className="bg-surface-card border border-severity-critical/30 rounded-xl p-5 relative overflow-hidden glow-red">
            <p className="section-label mb-4">Regional Threat Level</p>
            {/* Decorative chevron */}
            <div className="absolute right-4 top-6 opacity-10 select-none pointer-events-none">
              <span style={{ fontSize: 120, lineHeight: 1, color: '#f43f5e', fontWeight: 900, transform: 'rotate(-10deg)', display: 'block' }}>›</span>
            </div>
            <p className="text-4xl font-black text-severity-critical tracking-tight animate-pulse-glow-red" style={{ textShadow: '0 0 20px rgba(239,68,68,0.4)' }}>CRITICAL</p>
            <p className="text-xs text-sentinel-400 mt-2">Escalation Protocol Alpha Active</p>
            <div className="flex items-center gap-1.5 mt-3">
              <span className="w-1.5 h-1.5 rounded-full bg-severity-critical animate-pulse" />
              <span className="text-[10px] text-severity-critical/70 font-mono">PROT-ALPHA ENGAGED</span>
            </div>
          </div>

          {/* Priority entities */}
          <div className="bg-surface-card border border-surface-border rounded-xl p-5">
            <h2 className="text-sm font-semibold text-sentinel-100 mb-3">Top Priority Entities</h2>
            {district.priorityEntities.map(e => {
              const Icon = entityIcons[e.icon] ?? Cpu
              const iconBg = e.status === 'critical' ? 'bg-severity-critical/10 border-severity-critical/20' : e.status === 'elevated' ? 'bg-accent-amber/10 border-accent-amber/20' : 'bg-surface-hover border-surface-border'
              const iconColor = e.status === 'critical' ? 'text-severity-critical' : e.status === 'elevated' ? 'text-accent-amber' : 'text-sentinel-400'
              return (
                <div key={e.id} className="flex items-center gap-3 py-2.5 border-b border-surface-border last:border-0 hover:bg-surface-hover/50 transition-colors rounded-lg px-1 -mx-1">
                  <div className={`w-7 h-7 rounded border flex items-center justify-center shrink-0 ${iconBg}`}>
                    <Icon className={`w-3.5 h-3.5 ${iconColor}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-[11px] font-medium text-sentinel-100 truncate">{e.name}</p>
                    <p className="text-[10px] text-sentinel-400">{e.sector}</p>
                  </div>
                  <span className={`w-2 h-2 rounded-full shrink-0 ${statusDotColor[e.status]}`} />
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
