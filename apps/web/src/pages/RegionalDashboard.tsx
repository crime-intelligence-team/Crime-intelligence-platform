import { useParams, useNavigate } from 'react-router-dom'
import { BarChart, Bar, ResponsiveContainer, Cell, Tooltip } from 'recharts'
import {
  ArrowLeft, Cpu, Bus, Building2, HeartPulse, Wifi, ChevronRight
} from 'lucide-react'
import { karnatakaDistricts } from '../data/districts'
import { incidentTrend72h } from '../data/analytics'

const entityIcons: Record<string, any> = {
  wifi: Wifi, bus: Bus, building: Building2, medical: HeartPulse, server: Cpu,
}
const statusDotColor: Record<string, string> = {
  critical: 'bg-severity-critical', elevated: 'bg-severity-high', normal: 'bg-brand-500',
}

export default function RegionalDashboard() {
  const { id } = useParams()
  const navigate = useNavigate()
  const district = karnatakaDistricts.find(d => d.id === id) ?? karnatakaDistricts[0]

  const peakIdx = incidentTrend72h.reduce((m, d, i, a) => d.v > a[m].v ? i : m, 0)

  const categories = [
    { label: 'Civil Unrest',    pct: 42, color: 'text-viz-1', bg: 'bg-viz-1' },
    { label: 'Infrastructure',  pct: 28, color: 'text-viz-2', bg: 'bg-viz-2' },
    { label: 'Cyber',           pct: 18, color: 'text-viz-3', bg: 'bg-viz-3' },
    { label: 'Logistics',       pct: 12, color: 'text-viz-4', bg: 'bg-viz-4' },
  ]

  return (
    <div className="h-full overflow-y-auto p-6">
      {/* Back + header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <button onClick={() => navigate('/map')}
            className="flex items-center gap-1.5 text-[12px] font-medium text-text-tertiary hover:text-text-primary mb-2 transition-colors group">
            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" /> Back to Map
          </button>
          <h1 className="text-2xl font-bold text-text-primary">{district.name}</h1>
          <p className="text-[13px] text-text-secondary mt-0.5">District Intelligence Dashboard</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-brand-500/10 border border-brand-500/30 rounded-lg">
          <span className="w-2 h-2 rounded-full bg-brand-500 animate-pulse" />
          <span className="text-[11px] font-semibold text-brand-500 tracking-widest">LIVE OPERATIONS</span>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4 mb-5 stagger-children">
        <div className="bg-bg-surface-2 border border-border-subtle rounded-xl p-4 flex flex-col">
          <p className="section-label mb-1.5">Total Active Incidents</p>
          <p className="text-3xl font-bold text-text-primary animate-count-up">{district.totalIncidents.toLocaleString()}</p>
          <p className="text-[11px] font-medium text-severity-critical mt-1.5">▲ +{district.trend}% vs 24h</p>
        </div>
        <div className="bg-bg-surface-2 border border-border-subtle rounded-xl p-4 flex flex-col">
          <p className="section-label mb-1.5">Average Risk Score</p>
          <p className="text-3xl font-bold text-text-primary animate-count-up">
            {district.riskScore}<span className="text-[14px] font-medium text-text-secondary ml-1">/100</span>
          </p>
          <p className="text-[11px] font-medium text-text-secondary mt-1.5">— Stable</p>
        </div>
        <div className="bg-bg-surface-2 border border-border-subtle rounded-xl p-4 flex flex-col">
          <p className="section-label mb-1.5">Deployed Assets</p>
          <p className="text-3xl font-bold text-text-primary animate-count-up">42</p>
          <p className="text-[11px] font-medium text-severity-low mt-1.5">✓ All units responding</p>
        </div>
        <div className="bg-bg-surface-2 border border-border-subtle rounded-xl p-4 flex flex-col">
          <p className="section-label mb-1.5">System Uptime</p>
          <p className="text-3xl font-bold text-text-primary animate-count-up">
            99.98<span className="text-[14px] font-medium text-text-secondary ml-1">%</span>
          </p>
          <p className="text-[11px] font-medium text-text-secondary mt-1.5">Node cluster nominal</p>
        </div>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-5 gap-4">
        {/* Left column (3/5) */}
        <div className="col-span-3 space-y-4">
          {/* Incident trend */}
          <div className="bg-bg-surface-2 border border-border-subtle rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-text-primary">Incident Trend (72h)</h2>
              <button className="text-[10px] font-semibold tracking-wider text-text-secondary border border-border-subtle rounded px-2 py-1 hover:bg-bg-surface-hover transition-colors">
                EXPORT
              </button>
            </div>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={incidentTrend72h} barSize={18}>
                  <Bar dataKey="v" radius={[2,2,0,0]}>
                    {incidentTrend72h.map((_, i) => (
                      <Cell key={i} fill={i === peakIdx ? '#ef4444' : '#3E4B5A'} />
                    ))}
                  </Bar>
                  <Tooltip
                    contentStyle={{ background: '#1C2530', border: '1px solid #2D3947', borderRadius: 8, fontSize: 11 }}
                    labelStyle={{ color: '#94a3b8' }}
                    itemStyle={{ color: '#f1f5f9' }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Incident distribution */}
          <div className="bg-bg-surface-2 border border-border-subtle rounded-xl p-5">
            <h2 className="text-sm font-semibold text-text-primary mb-4">Incident Distribution by Category</h2>
            <div className="grid grid-cols-4 gap-4">
              {categories.map(c => (
                <div key={c.label}>
                  <p className="section-label mb-1.5">{c.label}</p>
                  <p className={`text-xl font-bold mb-2 ${c.color}`}>{c.pct}%</p>
                  <div className="h-[3px] rounded-full bg-bg-surface-hover overflow-hidden">
                    <div className={`h-full rounded-full ${c.bg} opacity-90`} style={{ width: `${c.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right column (2/5) */}
        <div className="col-span-2 space-y-4">
          {/* Threat level */}
          <div className="bg-bg-surface-2 border border-severity-critical/30 rounded-xl p-5 relative overflow-hidden bg-severity-critical/5">
            <p className="section-label mb-4">Regional Threat Level</p>
            {/* Standard chevron */}
            <div className="absolute right-4 top-5 text-text-tertiary opacity-50">
              <ChevronRight className="w-5 h-5" />
            </div>
            <p className="text-3xl font-bold text-severity-critical tracking-tight">CRITICAL</p>
            <p className="text-[13px] text-text-secondary mt-1.5">Escalation Protocol Alpha Active</p>
            <div className="flex items-center gap-2 mt-4 pt-3 border-t border-border-default/50">
              <span className="w-1.5 h-1.5 rounded-full bg-severity-critical animate-pulse" />
              <span className="text-[11px] text-text-primary font-mono font-medium">PROT-ALPHA ENGAGED</span>
            </div>
          </div>

          {/* Priority entities */}
          <div className="bg-bg-surface-2 border border-border-subtle rounded-xl p-5 flex flex-col">
            <h2 className="text-sm font-semibold text-text-primary mb-3">Top Priority Entities</h2>
            <div className="flex flex-col flex-1">
              {district.priorityEntities.map(e => {
                const Icon = entityIcons[e.icon] ?? Cpu
                const iconBg = e.status === 'critical' ? 'bg-severity-critical/10 border-severity-critical/20' : e.status === 'elevated' ? 'bg-severity-high/10 border-severity-high/20' : 'bg-bg-surface-hover border-border-default'
                const iconColor = e.status === 'critical' ? 'text-severity-critical' : e.status === 'elevated' ? 'text-severity-high' : 'text-text-secondary'
                return (
                  <div key={e.id} className="flex items-center gap-3 py-2.5 border-b border-border-subtle last:border-0 hover:bg-bg-surface-hover/50 transition-colors rounded-lg px-2 -mx-2">
                    <div className={`w-7 h-7 rounded border flex items-center justify-center shrink-0 ${iconBg}`}>
                      <Icon className={`w-3.5 h-3.5 ${iconColor}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-mono text-[11px] font-medium text-text-primary truncate">{e.name}</p>
                      <p className="text-[10px] text-text-secondary">{e.sector}</p>
                    </div>
                    <span className={`w-2 h-2 rounded-full shrink-0 ${statusDotColor[e.status]}`} />
                  </div>
                )
              })}
            </div>
            
            <div className="mt-2 pt-3 border-t border-border-default/50 text-center">
              <button className="text-[11px] uppercase font-semibold tracking-wider text-brand-500 hover:text-brand-400 transition-colors">
                View all priority entities &rarr;
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
