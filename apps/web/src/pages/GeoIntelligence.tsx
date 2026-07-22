import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { MapContainer, TileLayer, CircleMarker, Tooltip, Polyline, useMap } from 'react-leaflet'
import { BarChart, Bar, ResponsiveContainer } from 'recharts'
import 'leaflet/dist/leaflet.css'
import { X, AlertTriangle, Info, Navigation } from 'lucide-react'
import { RiskDriverBar } from '../components/ui/ProgressBar'
import { Button } from '../components/ui/Button'
import { StatusDot } from '../components/ui/Badge'
import { ErrorBoundary } from '../components/ui/ErrorBoundary'
import { SkeletonMap } from '../components/ui/Skeletons'
import { useApi } from '../hooks/useApi'
import { geoApi } from '../services/api'
import { heatmapPoints } from '../data/districts'
import type { District, GeoNetworkNode, MapMode } from '../types'
import L from 'leaflet'

// ── Heatmap layer via leaflet.heat ────────────────────────────────────────────
function HeatmapLayer() {
  const map = useMap()
  useEffect(() => {
    // @ts-ignore
    import('leaflet.heat').then(() => {
      // @ts-ignore
      const layer = L.heatLayer(
        heatmapPoints.map(p => [p.lat, p.lng, p.intensity]),
        { radius: 40, blur: 30, maxZoom: 10, max: 1.0,
          gradient: { 0.2: '#22c55e', 0.4: '#f59e0b', 0.7: '#f97316', 1.0: '#ef4444' } }
      )
      layer.addTo(map)
      return () => { map.removeLayer(layer) }
    })
  }, [map])
  return null
}

// ── District Quick Summary panel ──────────────────────────────────────────────
function DistrictQuickSummary({ district, onClose }: { district: District; onClose: () => void }) {
  const navigate = useNavigate()
  const trendBars = district.trendData.map((v, i) => ({ v, peak: i >= 5 }))
  const riskColor = district.riskScore >= 75 ? 'text-severity-critical' : district.riskScore >= 50 ? 'text-severity-elevated' : 'text-accent-emerald'

  return (
    <div className="absolute top-0 right-0 h-full w-[280px] bg-surface-raised border-l border-surface-border z-[999] flex flex-col animate-slide-in-right">
      <div className="px-4 py-3 border-b border-surface-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-accent-rose animate-pulse" />
          <span className="section-label">District Quick-Summary</span>
        </div>
        <button onClick={onClose} className="p-1 rounded text-sentinel-500 hover:text-sentinel-200"><X className="w-3.5 h-3.5" /></button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <h2 className="text-base font-bold text-sentinel-50">{district.name}</h2>

        <div className="grid grid-cols-2 gap-2">
          <div className="bg-surface-card rounded-lg p-3 border border-surface-border">
            <p className="section-label mb-1">Total Incidents</p>
            <p className="text-xl font-bold text-sentinel-50">{district.totalIncidents.toLocaleString()}</p>
            <p className={`text-[10px] mt-0.5 ${district.trend > 0 ? 'text-severity-critical' : 'text-accent-emerald'}`}>
              {district.trend > 0 ? `▲ +${district.trend}%` : `▼ ${district.trend}%`} vs last wk
            </p>
          </div>
          <div className="bg-surface-card rounded-lg p-3 border border-surface-border">
            <p className="section-label mb-1">Risk Score</p>
            <p className={`text-xl font-bold ${riskColor}`}>{district.riskScore}<span className="text-xs text-sentinel-400">/100</span></p>
            {district.riskScore >= 75 && <p className="text-[10px] text-severity-critical mt-0.5">Critical Threshold</p>}
          </div>
        </div>

        {district.priorityEntities.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="section-label">Priority Entities</p>
              <span className="text-[10px] text-sentinel-400">{district.priorityEntities.length} Active Tracking</span>
            </div>
            {district.priorityEntities.slice(0,3).map(e => (
              <div key={e.id} className="flex items-center gap-2 py-1.5 border-b border-surface-border last:border-0">
                <StatusDot status={e.status} />
                <span className="font-mono text-[11px] text-sentinel-200 flex-1 truncate">{e.name}</span>
                <span className="text-[10px] text-sentinel-400">{e.sector}</span>
              </div>
            ))}
          </div>
        )}

        <div>
          <p className="section-label mb-2">Incident Trend (72h)</p>
          <div className="bg-surface-card rounded-lg p-2 border border-surface-border h-20">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trendBars} barSize={6}>
                <Bar dataKey="v" fill="#475569"
                  label={false}
                  // Last 3 bars in rose
                  // @ts-ignore
                  shape={(props: any) => {
                    const isPeak = props.index >= trendBars.length - 3
                    return <rect {...props} fill={isPeak ? '#f43f5e' : '#2d3a4d'} rx={2} />
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="px-4 py-3 border-t border-surface-border shrink-0">
        <Button
          variant="secondary"
          className="w-full justify-center"
          onClick={() => navigate(`/map/district/${district.id}`)}
        >
          View Regional Dashboard →
        </Button>
      </div>
    </div>
  )
}

// ── Zone Inspector panel ──────────────────────────────────────────────────────
function ZoneInspector({ district, onClose }: { district: District; onClose: () => void }) {
  const riskColor = district.riskScore >= 75 ? 'text-severity-critical' : 'text-severity-elevated'
  return (
    <div className="absolute top-0 right-0 h-full w-[300px] bg-surface-raised border-l border-surface-border z-[999] flex flex-col animate-slide-in-right">
      <div className="px-4 py-3 border-b border-surface-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-accent-rose animate-pulse" />
          <h2 className="text-sm font-semibold text-sentinel-100">Zone Inspector</h2>
        </div>
        <button onClick={onClose} className="p-1 rounded text-sentinel-500 hover:text-sentinel-200"><X className="w-3.5 h-3.5" /></button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <p className="section-label">{district.name.toUpperCase()}</p>
        <div className="flex items-end gap-2">
          <span className={`text-4xl font-bold ${riskColor}`}>{district.riskScore}</span>
          <span className="text-sm text-sentinel-400 mb-1">/100</span>
          {district.riskScore >= 75 && (
            <span className="mb-1 px-2 py-0.5 text-[10px] font-semibold bg-severity-critical/20 text-severity-critical border border-severity-critical/30 rounded">
              Critical Risk
            </span>
          )}
        </div>

        <div>
          <p className="section-label mb-3">Top Risk Drivers</p>
          <div className="space-y-3">
            {district.riskDrivers.map(r => (
              <RiskDriverBar key={r.label} label={r.label} value={r.value} color={r.color} />
            ))}
          </div>
        </div>

        <div className="bg-surface-card border border-surface-border rounded-lg p-3">
          <p className="section-label mb-2 flex items-center gap-1">
            <span>▸</span> Analysis Summary
          </p>
          <p className="text-[11px] text-sentinel-300 leading-relaxed">
            High volume of sentiment volatility detected in Sector 4 combined with recent infrastructure alerts indicating potential node failures.
          </p>
        </div>
      </div>

      <div className="px-4 py-3 border-t border-surface-border shrink-0">
        <Button variant="secondary" className="w-full justify-center">View Detailed Telemetry</Button>
      </div>
    </div>
  )
}

// ── Intelligence Preview panel ────────────────────────────────────────────────
function IntelligencePreview({ onClose }: { onClose: () => void }) {
  return (
    <div className="absolute top-0 right-0 h-full w-[280px] bg-surface-raised border-l border-surface-border z-[999] flex flex-col animate-slide-in-right">
      <div className="px-4 py-3 border-b border-surface-border flex items-center justify-between shrink-0">
        <h2 className="text-sm font-semibold text-sentinel-100">Intelligence Preview</h2>
        <button onClick={onClose} className="p-1 rounded text-sentinel-500 hover:text-sentinel-200"><X className="w-3.5 h-3.5" /></button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <div className="space-y-2">
          {[['Network Status','● Active','text-accent-emerald'],['Active Nodes','42',''],['Total Edges','845','']].map(([l,v,c]) => (
            <div key={l} className="flex justify-between text-xs">
              <span className="text-sentinel-400">{l}</span>
              <span className={`font-medium text-sentinel-100 ${c}`}>{v}</span>
            </div>
          ))}
        </div>
        <div>
          <p className="section-label mb-3">Active Relationships</p>
          {[{label:'Cross-District Traffic',level:'high' as const,v:72},{label:'Data Exfiltration Risk',level:'elevated' as const,v:58}].map(r => (
            <div key={r.label} className="flex items-center gap-2 mb-2">
              <span className="text-[11px] text-sentinel-300 flex-1">{r.label}</span>
              <div className="w-20 h-1.5 bg-surface-hover rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${r.level === 'high' ? 'bg-severity-critical' : 'bg-accent-amber'}`} style={{width:`${r.v}%`}} />
              </div>
              <span className={`text-[10px] font-medium ${r.level === 'high' ? 'text-severity-critical' : 'text-accent-amber'}`}>
                {r.level === 'high' ? 'High' : 'Elevated'}
              </span>
            </div>
          ))}
        </div>
        <div>
          <p className="section-label mb-3">Anomaly Detection</p>
          {[
            {icon:AlertTriangle,title:'Spike in Hub-02 Activity',desc:'Unusual values of encrypted payload detected radiating from shared sector.',t:'warning'},
            {icon:Info,title:'New Sub-Network Identifier',desc:'3 nascent nodes detected connecting to BLE-B1 perimeter layer.',t:'info'},
          ].map(a => (
            <div key={a.title} className="bg-surface-card border border-surface-border rounded-lg p-3 mb-2">
              <div className="flex items-center gap-2 mb-1">
                <a.icon className={`w-3.5 h-3.5 shrink-0 ${a.t === 'warning' ? 'text-accent-amber' : 'text-accent-blue'}`} />
                <span className="text-[11px] font-medium text-sentinel-100">{a.title}</span>
              </div>
              <p className="text-[10px] text-sentinel-400 leading-relaxed">{a.desc}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="px-4 py-3 border-t border-surface-border shrink-0">
        <Button variant="secondary" className="w-full justify-center">Open Full Workspace →</Button>
      </div>
    </div>
  )
}

// ── Main GeoIntelligence page ─────────────────────────────────────────────────
export default function GeoIntelligence() {
  const [searchParams, setSearchParams] = useSearchParams()
  const mode = (searchParams.get('mode') ?? 'default') as MapMode
  const setMode = (m: string) => setSearchParams(m === 'default' ? {} : { mode: m })

  const [selectedDistrict, setSelectedDistrict] = useState<District | null>(null)
  const [networkOpen, setNetworkOpen] = useState(mode === 'network')

  const { data: districts, loading: districtLoading } = useApi(geoApi.districts)
  const { data: netNodes }  = useApi(geoApi.networkNodes)
  const { data: netEdges }  = useApi(geoApi.networkEdges)

  const activeDistricts  = districts ?? []
  const activeNetNodes   = netNodes  ?? []
  const activeNetEdges   = netEdges  ?? []

  useEffect(() => { if (mode === 'network') setNetworkOpen(true) }, [mode])

  const severityColor = (score: number) =>
    score >= 75 ? '#ef4444' : score >= 50 ? '#f59e0b' : '#22c55e'

  const nodeColor = (n: GeoNetworkNode) =>
    n.status === 'critical' ? '#f43f5e' : n.type === 'primary' ? '#f1f5f9' : '#475569'

  return (
    <div className="relative h-full flex flex-col">
      {/* Tab bar */}
      <div className="shrink-0 flex items-center border-b border-surface-border bg-surface-raised px-4 gap-1">
        {['default','zone','network'].map(m => (
          <button key={m} onClick={() => setMode(m)}
            className={`px-4 py-2.5 text-xs font-medium capitalize transition-colors border-b-2 -mb-px ${mode===m ? 'border-accent-blue text-accent-blue' : 'border-transparent text-sentinel-400 hover:text-sentinel-200'}`}>
            {m === 'default' ? 'Default' : m === 'zone' ? 'Zone Mode' : 'Network'}
          </button>
        ))}

        {/* Zone legend */}
        {mode === 'zone' && (
          <div className="ml-auto flex items-center gap-3 text-[10px] text-sentinel-300">
            <div className="flex items-center gap-1.5">
              <div className="w-20 h-2 rounded" style={{background:'linear-gradient(to right,#22c55e,#f59e0b,#f97316,#ef4444)'}} />
              <span>Low</span><span className="text-sentinel-500">→</span><span>Critical</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-severity-critical inline-block" /> Critical
              <span className="w-2 h-2 rounded-full bg-severity-elevated inline-block ml-1" /> Elevated
            </div>
          </div>
        )}
      </div>

      {/* Map container */}
      <div className="flex-1 relative overflow-hidden">
        {districtLoading ? (
          <SkeletonMap />
        ) : (
        <ErrorBoundary label="Map layer failed to load">
        <MapContainer
          center={[14.5, 75.7]}
          zoom={7}
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
        >
          <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />

          {/* Default mode markers */}
          {mode === 'default' && activeDistricts.map(d => (
            <CircleMarker key={d.id} center={[d.lat, d.lng]}
              radius={8} fillColor={severityColor(d.riskScore)} color={severityColor(d.riskScore)}
              weight={2} fillOpacity={0.85} opacity={0.9}
              eventHandlers={{ click: () => setSelectedDistrict(d) }}>
              <Tooltip direction="top" offset={[0,-8]} permanent={false} className="sentinel-tooltip">
                {d.name}
              </Tooltip>
            </CircleMarker>
          ))}

          {/* Zone mode — heatmap */}
          {mode === 'zone' && <HeatmapLayer />}

          {/* Network mode */}
          {mode === 'network' && (
            <>
              {activeNetEdges.map(e => {
                const src = activeNetNodes.find(n => n.id === e.source)!
                const tgt = activeNetNodes.find(n => n.id === e.target)!
                if (!src || !tgt) return null
                return (
                  <Polyline key={`${e.source}-${e.target}`}
                    positions={[[src.lat,src.lng],[tgt.lat,tgt.lng]]}
                    color="#64748b" weight={e.type==='high_volume'?2:1}
                    dashArray={e.type==='latent'?'4 6':undefined} opacity={0.6} />
                )
              })}
              {activeNetNodes.map(n => (
                <CircleMarker key={n.id} center={[n.lat,n.lng]}
                  radius={n.type==='primary'?9:n.type==='hub'?7:5}
                  fillColor={nodeColor(n)} color={nodeColor(n)}
                  weight={2} fillOpacity={0.9} opacity={1}
                  eventHandlers={{ click: () => setNetworkOpen(true) }}>
                  <Tooltip direction="right" permanent className="bg-transparent border-0 shadow-none">
                    <span className="font-mono text-[10px] text-white">{n.name}</span>
                  </Tooltip>
                </CircleMarker>
              ))}

              {/* Network legend */}
              <div className="absolute bottom-6 left-4 z-[999] bg-surface-card/90 border border-surface-border rounded-lg px-3 py-2 text-[10px] text-sentinel-300 space-y-1.5 backdrop-blur-sm">
                <p className="section-label mb-1">Network Legend</p>
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-sentinel-50 border border-sentinel-400 inline-block" /> Primary Node</div>
                <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-sentinel-400 inline-block ml-0.5" /> Secondary Hub</div>
                <div className="flex items-center gap-2"><span className="inline-block w-4 h-px bg-sentinel-400 ml-0.5" /> High Volume</div>
                <div className="flex items-center gap-2"><span className="inline-block w-4 h-px bg-sentinel-500 ml-0.5" style={{borderTop:'1px dashed #475569'}} /> Latent Link</div>
              </div>
            </>
          )}
        </MapContainer>
        </ErrorBoundary>
        )}

        {/* Right panels */}
        {mode === 'default' && selectedDistrict && (
          <DistrictQuickSummary district={selectedDistrict} onClose={() => setSelectedDistrict(null)} />
        )}
        {mode === 'zone' && selectedDistrict && (
          <ZoneInspector district={selectedDistrict} onClose={() => setSelectedDistrict(null)} />
        )}
        {mode === 'network' && networkOpen && (
          <IntelligencePreview onClose={() => setNetworkOpen(false)} />
        )}

        {/* Zone click helper */}
        {mode === 'zone' && !selectedDistrict && (
          <div className="absolute bottom-6 right-4 z-[500] flex items-center gap-2 bg-surface-card/80 border border-surface-border rounded-lg px-3 py-2 text-[11px] text-sentinel-400 backdrop-blur-sm">
            <Navigation className="w-3.5 h-3.5" /> Click a hotspot to inspect
          </div>
        )}
      </div>
    </div>
  )
}
