import { useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
  PieChart, Pie, Cell, ResponsiveContainer,
} from 'recharts'
import { Calendar, Filter, AlertTriangle } from 'lucide-react'
import { correlationMatrix, THREAT_CATEGORIES, temporalData, outliers, sectorData } from '../data/analytics'
import type { StatisticalOutlier } from '../types'

// ── Correlation Matrix ────────────────────────────────────────────────────────
function CorrelationMatrix() {
  const [hovered, setHovered] = useState<{ row: string; col: string; v: number } | null>(null)
  const SHORT = ['Cyber', 'Unre.', 'Supp.', 'Brea.', 'Phys.', 'Frau.']

  function cellColor(v: number) {
    if (v >= 0.8) return '#f43f5e'
    if (v >= 0.6) return '#fb7185'
    if (v >= 0.4) return '#3a2a35'
    if (v >= 0.2) return '#1f2a38'
    return '#1a2332'
  }

  return (
    <div className="bg-surface-card border border-surface-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-sentinel-100">Incident Correlation Matrix</h2>
        <div className="flex items-center gap-2 text-[10px] text-sentinel-400">
          <span>Low</span>
          <div className="w-20 h-2 rounded" style={{ background: 'linear-gradient(to right, #1a2332, #fb7185, #f43f5e)' }} />
          <span>High</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="inline-block">
          {/* Column headers (angled labels) */}
          <div style={{ display: 'grid', gridTemplateColumns: '120px repeat(6, 44px)', marginBottom: 4 }}>
            <div />
            {SHORT.map(s => (
              <div key={s} style={{ height: 52, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 4 }}>
                <span style={{ transform: 'rotate(-45deg)', fontSize: 9, color: '#64748b', transformOrigin: 'bottom center', whiteSpace: 'nowrap' }}>{s}</span>
              </div>
            ))}
          </div>

          {/* Matrix rows */}
          {THREAT_CATEGORIES.map((row, _ri) => (
            <div key={row} style={{ display: 'grid', gridTemplateColumns: '120px repeat(6, 44px)', marginBottom: 2 }}>
              <div style={{ display: 'flex', alignItems: 'center', paddingRight: 8 }}>
                <span style={{ fontSize: 10, color: '#64748b', textAlign: 'right', width: '100%' }}>{row}</span>
              </div>
              {THREAT_CATEGORIES.map((col, _ci) => {
                const cell = correlationMatrix.find(c => c.row === row && c.col === col)
                const v = cell?.value ?? 0
                return (
                  <div key={col}
                    style={{ width: 40, height: 40, borderRadius: 4, background: cellColor(v), cursor: 'default', margin: '0 2px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    onMouseEnter={() => setHovered({ row, col, v })}
                    onMouseLeave={() => setHovered(null)}
                    title={`${row} × ${col}: ${(v*100).toFixed(0)}%`}
                  >
                    {v >= 0.8 && <span style={{ fontSize: 9, color: '#f1f5f9', fontWeight: 700 }}>{(v*100).toFixed(0)}</span>}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {hovered && (
        <div className="mt-3 text-[11px] font-mono text-sentinel-300">
          <span className="text-accent-rose font-medium">{hovered.row}</span>
          {' × '}
          <span className="text-accent-rose font-medium">{hovered.col}</span>
          {' — '}
          <span className="text-sentinel-100">{(hovered.v * 100).toFixed(0)}% correlation</span>
        </div>
      )}
    </div>
  )
}

// ── Outlier card ──────────────────────────────────────────────────────────────
function OutlierCard({ o }: { o: StatisticalOutlier }) {
  const dotColor = o.severity === 'critical' ? 'bg-severity-critical' : o.severity === 'elevated' ? 'bg-severity-elevated' : 'bg-sentinel-500'
  const borderColor = o.severity === 'critical' ? 'border-l-severity-critical' : o.severity === 'elevated' ? 'border-l-severity-elevated' : 'border-l-sentinel-500'
  return (
    <div className={`bg-surface-card border border-surface-border border-l-2 ${borderColor} rounded-lg p-3 space-y-1.5`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} />
          <span className="text-xs font-semibold text-sentinel-100">Vector: {o.vector}</span>
        </div>
        <span className="font-mono text-[10px] text-sentinel-500 shrink-0">{o.timeDelta}</span>
      </div>
      <p className="text-[11px] text-sentinel-300 leading-relaxed pl-4">{o.description}</p>
    </div>
  )
}

// ── Custom donut center label ──────────────────────────────────────────────────
function DonutCenterLabel({ cx, cy, total }: { cx: number; cy: number; total: number }) {
  return (
    <>
      <text x={cx} y={cy - 8}  textAnchor="middle" fontSize={22} fontWeight={700} fill="#f1f5f9" fontFamily="Inter">
        {total}
      </text>
      <text x={cx} y={cy + 10} textAnchor="middle" fontSize={9}  fill="#64748b" letterSpacing={1.5} fontFamily="Inter">
        ACTIVE NODES
      </text>
    </>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ThreatAnalytics() {
  const [donutState, setDonutState] = useState<number | null>(null)

  return (
    <div className="h-full overflow-y-auto p-6">
      {/* Breadcrumb + header */}
      <div className="mb-6">
        <p className="text-[10px] text-sentinel-500 tracking-wider mb-1">ANALYTICS ENGINE › TREND CORRELATION</p>
        <div className="flex items-start justify-between">
          <h1 className="text-2xl font-bold text-sentinel-50">Deep-Dive Analytics View</h1>
          <div className="flex items-center gap-2 shrink-0">
            <button className="flex items-center gap-2 px-3 py-1.5 bg-surface-card border border-surface-border rounded-lg text-xs text-sentinel-200 hover:bg-surface-hover transition-colors">
              <Calendar className="w-3.5 h-3.5" /> Last 30 Days
            </button>
            <button className="flex items-center gap-2 px-3 py-1.5 bg-surface-card border border-surface-border rounded-lg text-xs text-sentinel-200 hover:bg-surface-hover transition-colors">
              <Filter className="w-3.5 h-3.5" /> Global Filter
            </button>
          </div>
        </div>
      </div>

      {/* Main grid — 3:2 */}
      <div className="grid grid-cols-5 gap-4">
        {/* Left column (3/5) */}
        <div className="col-span-3 space-y-4">
          {/* Correlation Matrix */}
          <CorrelationMatrix />

          {/* Temporal Vector Comparison */}
          <div className="bg-surface-card border border-surface-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-sm font-semibold text-sentinel-100">Temporal Vector Comparison</h2>
            </div>
            <div className="flex items-center gap-6 text-[11px] text-sentinel-400 mb-4">
              <span className="flex items-center gap-1.5"><span className="inline-block w-6 h-0.5 bg-sentinel-100 rounded" /> Current YTD</span>
              <span className="flex items-center gap-1.5"><span className="inline-block w-6 border-t border-dashed border-sentinel-500" /> 5-Yr Avg Baseline</span>
            </div>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={temporalData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="quarter" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} domain={[0, 100]} />
                  <Tooltip contentStyle={{ background: '#1a2332', border: '1px solid #1e293b', borderRadius: 8, fontSize: 11 }} />
                  <ReferenceLine x="Q3" stroke="#f43f5e" strokeDasharray="3 3" strokeWidth={1.5}
                    label={{ value: 'Anomalous Variance Det.', position: 'top', fontSize: 9, fill: '#fb7185' }} />
                  <Line type="monotone" dataKey="current"  stroke="#f1f5f9" strokeWidth={2} dot={{ r: 4, fill: '#f1f5f9' }} />
                  <Line type="monotone" dataKey="baseline" stroke="#475569" strokeWidth={1.5} strokeDasharray="4 4" dot={{ r: 3, fill: '#475569' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Right column (2/5) */}
        <div className="col-span-2 space-y-4">
          {/* Statistical Outliers */}
          <div className="bg-surface-card border border-surface-border rounded-xl p-5">
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-sm font-semibold text-sentinel-100">Statistical Outliers</h2>
              <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-accent-orange/10 text-accent-orange border border-accent-orange/30">
                <AlertTriangle className="w-3 h-3" /> 3 Detected
              </span>
            </div>
            <div className="space-y-2">
              {outliers.map(o => <OutlierCard key={o.id} o={o} />)}
            </div>
          </div>

          {/* Sector Distribution */}
          <div className="bg-surface-card border border-surface-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-sentinel-100">Sector Distribution</h2>
              <button className="text-sentinel-400 hover:text-sentinel-200 transition-colors text-base leading-none px-1">⋮</button>
            </div>

            <div className="flex items-center gap-4">
              <div className="h-[160px] w-[160px] shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={sectorData} cx="50%" cy="50%"
                      innerRadius={52} outerRadius={72}
                      dataKey="value" strokeWidth={0}
                      onMouseEnter={(_, i) => setDonutState(i)}
                      onMouseLeave={() => setDonutState(null)}
                    >
                      {sectorData.map((s, i) => (
                        <Cell key={s.name} fill={s.color} opacity={donutState === null || donutState === i ? 1 : 0.5} />
                      ))}
                    </Pie>
                    <DonutCenterLabel cx={80} cy={80} total={42} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Legend */}
              <div className="space-y-2.5 flex-1">
                {sectorData.map(s => (
                  <div key={s.name} className="flex items-center gap-2.5">
                    <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: s.color }} />
                    <span className="text-xs text-sentinel-300 flex-1">{s.name}</span>
                    <span className="font-mono text-xs font-medium text-sentinel-100">{s.value}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
