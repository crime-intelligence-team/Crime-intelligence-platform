import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { BarChart, Bar, ResponsiveContainer, Cell, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowLeft, MapPin, ShieldAlert, Activity, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { useApi } from '../hooks/useApi'
import { mapApi, dashboardApi } from '../services/endpoints'

const classificationLabel: Record<string, string> = {
  open_operational: 'Open Operational',
  restricted_operational: 'Restricted Operational',
  protected: 'Protected',
  sealed: 'Sealed',
}

const movementMeta: Record<string, { icon: any; color: string; label: string }> = {
  increasing: { icon: TrendingUp, color: 'text-severity-critical', label: 'Increasing' },
  decreasing: { icon: TrendingDown, color: 'text-severity-low', label: 'Decreasing' },
  stable: { icon: Minus, color: 'text-text-tertiary', label: 'Stable' },
}

function KpiCard({ label, value, note }: { label: string; value: number; note?: string }) {
  return (
    <div className="bg-bg-surface-2 border border-border-subtle rounded-xl p-4 flex flex-col">
      <p className="section-label mb-1.5">{label}</p>
      <p className="text-3xl font-bold text-text-primary animate-count-up">{value.toLocaleString()}</p>
      {note && <p className="text-[11px] font-medium text-text-secondary mt-1.5">{note}</p>}
    </div>
  )
}

export default function RegionalDashboard() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [window, setWindow] = useState<'7d' | '30d' | '90d'>('7d')

  const { data: district, loading: districtLoading, error: districtError } = useApi(
    () => (id ? mapApi.district(id) : Promise.resolve(null)),
    [id],
  )
  const { data: dashboard, loading: dashLoading } = useApi(
    () => (id ? dashboardApi.byRegion(id) : Promise.resolve(null)),
    [id],
  )

  if (districtLoading || dashLoading) {
    return (
      <div className="h-full overflow-y-auto p-6 flex flex-col gap-4 animate-pulse">
        <div className="h-7 w-64 bg-bg-surface-2 rounded-lg" />
        <div className="grid grid-cols-4 gap-4">
          {[0, 1, 2, 3].map(i => <div key={i} className="h-28 bg-bg-surface-2 rounded-xl" />)}
        </div>
        <div className="grid grid-cols-5 gap-4">
          <div className="col-span-3 h-96 bg-bg-surface-2 rounded-xl" />
          <div className="col-span-2 h-96 bg-bg-surface-2 rounded-xl" />
        </div>
      </div>
    )
  }

  if (districtError || !district) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 text-text-tertiary">
        <p className="text-sm">Region not found or outside your jurisdiction.</p>
        <button onClick={() => navigate('/map')} className="text-xs font-medium text-brand-500 hover:text-brand-400">
          ← Back to Map
        </button>
      </div>
    )
  }

  const trend = dashboard?.trends.find(t => t.window === window)
  const trendPoints = trend?.points ?? []
  const peakIdx = trendPoints.reduce((m, d, i, a) => (d.value > a[m].value ? i : m), 0)
  const total = trendPoints.reduce((s, p) => s + p.value, 0)

  const hotspots = dashboard?.hotspots ?? []
  const priorityEntities = dashboard?.priority_entities ?? []

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
        <KpiCard label="Total Incidents" value={dashboard?.kpis.total_incidents ?? 0} note="All-time in region" />
        <KpiCard label="Open Cases" value={dashboard?.kpis.open_cases ?? 0} note="Currently under investigation" />
        <KpiCard label="Active Gangs" value={dashboard?.kpis.active_gangs ?? 0} note="Tracked organizations" />
        <KpiCard label="High-Priority Entities" value={dashboard?.kpis.high_priority_entities ?? 0} note="Above review threshold" />
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-5 gap-4">
        {/* Left column (3/5) */}
        <div className="col-span-3 space-y-4">
          {/* Incident trend */}
          <div className="bg-bg-surface-2 border border-border-subtle rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-text-primary">Incident Trend</h2>
              <div className="flex items-center gap-1">
                {(['7d', '30d', '90d'] as const).map(w => (
                  <button key={w} onClick={() => setWindow(w)}
                    className={`text-[10px] font-semibold tracking-wider px-2.5 py-1 rounded transition-colors ${window === w ? 'bg-brand-500/15 text-brand-500 border border-brand-500/30' : 'text-text-secondary border border-border-subtle hover:bg-bg-surface-hover'}`}>
                    {w.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-[11px] text-text-secondary -mt-2 mb-3">
              {total} incidents in the last {window === '7d' ? 7 : window === '30d' ? 30 : 90} days (complete days only)
            </p>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trendPoints} barSize={window === '7d' ? 18 : 10}>
                  <XAxis dataKey="date" tickFormatter={(d: string) => d.slice(5)} tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} width={28} />
                  <Bar dataKey="value" radius={[2, 2, 0, 0]}>
                    {trendPoints.map((p, i) => (
                      <Cell key={p.date} fill={i === peakIdx ? '#ef4444' : '#3E4B5A'} />
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

          {/* Hotspots */}
          <div className="bg-bg-surface-2 border border-border-subtle rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <ShieldAlert className="w-4 h-4 text-severity-critical" />
              <h2 className="text-sm font-semibold text-text-primary">Regional Hotspots (30-day window)</h2>
            </div>
            {hotspots.length === 0 ? (
              <p className="text-xs text-text-tertiary py-4 text-center">No hotspots recorded in the trailing window.</p>
            ) : (
              <div className="flex flex-col">
                {hotspots.map((h, i) => {
                  const m = movementMeta[h.movement ?? 'stable'] ?? movementMeta.stable
                  const MovementIcon = m.icon
                  return (
                    <div key={h.location_id} className="flex items-center gap-3 py-2.5 border-b border-border-subtle last:border-0">
                      <span className="w-6 h-6 rounded bg-bg-surface-hover border border-border-default flex items-center justify-center text-[11px] font-bold font-mono text-text-secondary shrink-0">
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-text-primary truncate">{h.label}</p>
                        <p className="text-[11px] text-text-secondary">{h.incident_count} incidents</p>
                      </div>
                      <span className={`flex items-center gap-1 text-[11px] font-medium ${m.color}`}>
                        <MovementIcon className="w-3.5 h-3.5" /> {m.label}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right column (2/5) */}
        <div className="col-span-2 space-y-4">
          {/* Region snapshot */}
          <div className="bg-bg-surface-2 border border-border-subtle rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <MapPin className="w-4 h-4 text-brand-500" />
              <h2 className="text-sm font-semibold text-text-primary">Region Snapshot</h2>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-bg-surface-hover/50 border border-border-subtle rounded-lg p-3">
                <p className="section-label mb-1">Code</p>
                <p className="font-mono text-xs text-text-primary">{district.code}</p>
              </div>
              <div className="bg-bg-surface-hover/50 border border-border-subtle rounded-lg p-3">
                <p className="section-label mb-1">Population</p>
                <p className="text-sm font-semibold text-text-primary">
                  {district.population != null ? district.population.toLocaleString() : '—'}
                </p>
              </div>
              <div className="col-span-2 bg-bg-surface-hover/50 border border-border-subtle rounded-lg p-3">
                <p className="section-label mb-1">Classification</p>
                <p className="text-sm font-semibold text-text-primary">
                  {classificationLabel[district.classification] ?? district.classification}
                </p>
              </div>
            </div>
          </div>

          {/* Priority entities */}
          <div className="bg-bg-surface-2 border border-border-subtle rounded-xl p-5 flex flex-col">
            <div className="flex items-center gap-2 mb-3">
              <Activity className="w-4 h-4 text-severity-high" />
              <h2 className="text-sm font-semibold text-text-primary">Top Priority Entities</h2>
            </div>
            {priorityEntities.length === 0 ? (
              <p className="text-xs text-text-tertiary py-4 text-center">
                No priority entities recorded yet.
              </p>
            ) : (
              <div className="flex flex-col flex-1">
                {priorityEntities.map(e => (
                  <div key={e.id} className="flex items-center gap-3 py-2.5 border-b border-border-subtle last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="font-mono text-[11px] font-medium text-text-primary truncate">{e.label}</p>
                      <p className="text-[10px] text-text-secondary capitalize">{e.type}</p>
                    </div>
                    <span className="text-[10px] text-text-tertiary font-mono">{e.confidence?.band ?? '—'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
