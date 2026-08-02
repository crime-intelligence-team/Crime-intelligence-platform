import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { MapContainer, TileLayer, CircleMarker, Tooltip, Polyline, useMap } from 'react-leaflet'
import { BarChart, Bar, ResponsiveContainer } from 'recharts'
import 'leaflet/dist/leaflet.css'
import { X, AlertTriangle, Info, Navigation, Activity, MapPin } from 'lucide-react'
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

// ── Shared Geo Panels Architecture ────────────────────────────────────────────

function GeoPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute top-4 right-4 w-[340px] bg-bg-elevated/85 backdrop-blur-[16px] border border-border-default rounded-lg shadow-[0_8px_24px_rgba(0,0,0,0.4)] z-[999] p-6 flex flex-col gap-6 animate-slide-in-right">
      {children}
    </div>
  )
}

function GeoPanelHeader({ eyebrow, icon: Icon, title, onClose }: { eyebrow: string; icon: any; title: string; onClose: () => void }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-text-secondary">
          <Icon className="w-3.5 h-3.5" />
          <span className="text-[11px] uppercase font-semibold tracking-wider">{eyebrow}</span>
        </div>
        <button onClick={onClose} className="p-1 rounded text-text-tertiary hover:text-text-primary transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>
      <h2 className="text-[20px] font-bold text-text-primary leading-none">{title}</h2>
    </div>
  )
}

function GeoPanelStatCard({ label, value, subtext }: { label: string; value: React.ReactNode; subtext?: React.ReactNode }) {
  return (
    <div className="bg-bg-surface-2/75 border border-border-subtle rounded-md p-4 flex flex-col gap-2">
      <p className="text-[11px] uppercase font-semibold text-text-secondary tracking-wider">{label}</p>
      <div className="text-[24px] font-bold text-text-primary leading-none">{value}</div>
      {subtext && <div className="text-[12px] mt-1">{subtext}</div>}
    </div>
  )
}

function GeoPanelDataRow({ label, value, children }: { label: string; value?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="min-h-[40px] flex items-center justify-between border-b border-border-subtle last:border-0 py-2">
      <span className="text-[13px] font-medium text-text-secondary">{label}</span>
      {value && <span className="text-[13px] font-semibold text-text-primary">{value}</span>}
      {children}
    </div>
  )
}

function GeoPanelBar({ label, value, color }: { label: string; value: number; color: string }) {
  const bg = color === 'rose' || color === 'red' ? 'bg-severity-critical/80' : color === 'amber' ? 'bg-severity-high/80' : 'bg-severity-low/80'
  return (
    <div className="flex flex-col gap-1.5 py-2 border-b border-border-subtle last:border-0">
      <div className="flex justify-between items-center text-[13px]">
        <span className="font-medium text-text-secondary">{label}</span>
        <span className="font-semibold text-text-primary">{value}%</span>
      </div>
      <div className="h-[6px] w-full bg-bg-surface-2/75 rounded-full overflow-hidden border border-border-default/50">
        <div className={`h-full ${bg} rounded-full`} style={{ width: `${value}%` }} />
      </div>
    </div>
  )
}

function GeoPanelCardItem({ icon: Icon, title, desc, iconColor }: { icon: any; title: string; desc: string; iconColor: string }) {
  return (
    <div className="bg-bg-surface-2/75 border border-border-subtle rounded-md p-3 flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <Icon className={`w-5 h-5 ${iconColor}`} />
        <span className="text-[13px] font-semibold text-text-primary">{title}</span>
      </div>
      <p className="text-[12px] text-text-secondary leading-relaxed">{desc}</p>
    </div>
  )
}

function GeoPanelCallout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-bg-surface-2/75 rounded-md p-4 border-l-[3px] border-l-brand-500">
      <p className="text-[13px] text-text-secondary leading-relaxed">{children}</p>
    </div>
  )
}

function GeoPanelFooterButton({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="w-full h-[44px] bg-brand-500 hover:bg-brand-400 text-white font-semibold rounded-md flex items-center justify-center transition-colors">
      {children}
    </button>
  )
}

// ── District Quick Summary panel ──────────────────────────────────────────────
function DistrictQuickSummary({ district, onClose }: { district: District; onClose: () => void }) {
  const navigate = useNavigate()
  const trendBars = district.trendData.map((v, i) => ({ v, peak: i >= 5 }))
  const riskColor = district.riskScore >= 75 ? 'text-severity-critical' : district.riskScore >= 50 ? 'text-severity-high' : 'text-severity-low'

  return (
    <GeoPanel>
      <GeoPanelHeader eyebrow="District Quick-Summary" icon={MapPin} title={district.name} onClose={onClose} />
      
      <div className="grid grid-cols-2 gap-4">
        <GeoPanelStatCard 
          label="Total Incidents" 
          value={district.totalIncidents.toLocaleString()} 
          subtext={<span className={district.trend > 0 ? 'text-severity-critical font-medium' : 'text-severity-low font-medium'}>{district.trend > 0 ? `▲ +${district.trend}%` : `▼ ${district.trend}%`} vs last wk</span>}
        />
        <GeoPanelStatCard 
          label="Risk Score" 
          value={<span className={riskColor}>{district.riskScore}<span className="text-[14px] text-text-secondary ml-1 font-medium">/100</span></span>}
          subtext={district.riskScore >= 75 && <span className="text-severity-critical font-medium">Critical Threshold</span>}
        />
      </div>

      {district.priorityEntities.length > 0 && (
        <div className="flex flex-col">
          <p className="text-[12px] uppercase font-semibold text-text-secondary tracking-wider mb-2">Priority Entities</p>
          <div className="flex flex-col">
            {district.priorityEntities.slice(0,3).map(e => (
              <GeoPanelDataRow key={e.id} label={e.name}>
                 <StatusDot status={e.status} />
              </GeoPanelDataRow>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col">
        <p className="text-[12px] uppercase font-semibold text-text-secondary tracking-wider mb-2">Top Risk Drivers</p>
        <div className="flex flex-col">
          {district.riskDrivers.map(r => (
            <GeoPanelBar key={r.label} label={r.label} value={r.value} color={r.color} />
          ))}
        </div>
      </div>

      <div className="flex flex-col">
        <p className="text-[11px] uppercase font-semibold text-text-secondary tracking-wider mb-2">Incident Trend (72h)</p>
        <div className="h-24 bg-bg-surface-2/75 rounded-lg p-3 border border-border-subtle">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={trendBars} barSize={8}>
              <Bar dataKey="v" fill="#3E4B5A"
                label={false}
                // @ts-ignore
                shape={(props: any) => {
                  const isPeak = props.index >= trendBars.length - 3
                  return <rect {...props} fill={isPeak ? '#F472B6' : '#2D3947'} rx={2} />
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <GeoPanelFooterButton onClick={() => navigate(`/map/district/${district.id}`)}>
        View Regional Dashboard →
      </GeoPanelFooterButton>
    </GeoPanel>
  )
}

// ── Zone Inspector panel ──────────────────────────────────────────────────────
function ZoneInspector({ district, onClose }: { district: District; onClose: () => void }) {
  const riskColor = district.riskScore >= 75 ? 'text-severity-critical' : 'text-severity-high'
  return (
    <GeoPanel>
      <GeoPanelHeader eyebrow="Zone Inspector" icon={AlertTriangle} title={district.name.toUpperCase()} onClose={onClose} />

        <GeoPanelStatCard 
          label="Zone Risk Score"
          value={<span className={riskColor}>{district.riskScore}<span className="text-[14px] text-text-secondary ml-1 font-medium">/100</span></span>}
          subtext={district.riskScore >= 75 && <span className="text-severity-critical font-medium">Critical Risk</span>}
        />

      <div className="flex flex-col">
        <p className="text-[12px] uppercase font-semibold text-text-secondary tracking-wider mb-2">Top Risk Drivers</p>
        <div className="flex flex-col">
          {district.riskDrivers.map(r => (
            <GeoPanelBar key={r.label} label={r.label} value={r.value} color={r.color} />
          ))}
        </div>
      </div>

      <GeoPanelCallout>
        High volume of sentiment volatility detected in Sector 4 combined with recent infrastructure alerts indicating potential node failures.
      </GeoPanelCallout>

      <GeoPanelFooterButton>
        View Detailed Telemetry
      </GeoPanelFooterButton>
    </GeoPanel>
  )
}

// ── Intelligence Preview panel ────────────────────────────────────────────────
function IntelligencePreview({ onClose }: { onClose: () => void }) {
  return (
    <GeoPanel>
      <GeoPanelHeader eyebrow="Intelligence Preview" icon={Activity} title="Network Overview" onClose={onClose} />

      <div className="flex flex-col">
        <GeoPanelDataRow label="Network Status" value={<span className="text-severity-low">● Active</span>} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <GeoPanelStatCard label="Active Nodes" value="42" />
        <GeoPanelStatCard label="Total Edges" value="845" />
      </div>

      <div className="flex flex-col">
        <p className="text-[12px] uppercase font-semibold text-text-secondary tracking-wider mb-2">Active Relationships</p>
        <div className="flex flex-col">
          {[{label:'Cross-District Traffic',level:'high' as const,v:72},{label:'Data Exfiltration Risk',level:'elevated' as const,v:58}].map(r => (
            <div key={r.label} className="flex flex-col gap-1.5 py-2 border-b border-border-subtle last:border-0">
              <div className="flex justify-between items-center text-[13px]">
                <span className="font-medium text-text-secondary">{r.label}</span>
                <span className={`font-semibold ${r.level === 'high' ? 'text-severity-critical' : 'text-severity-high'}`}>{r.level === 'high' ? 'High' : 'Elevated'}</span>
              </div>
              <div className="h-[6px] w-full bg-bg-surface-2/75 rounded-full overflow-hidden border border-border-default/50">
                <div className={`h-full rounded-full ${r.level === 'high' ? 'bg-severity-critical/80' : 'bg-severity-high/80'}`} style={{ width: `${r.v}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-[12px] uppercase font-semibold text-text-secondary tracking-wider">Anomaly Detection</p>
        {[
          {icon:AlertTriangle,title:'Spike in Hub-02 Activity',desc:'Unusual values of encrypted payload detected radiating from shared sector.',color:'text-severity-high'},
          {icon:Info,title:'New Sub-Network Identifier',desc:'3 nascent nodes detected connecting to BLE-B1 perimeter layer.',color:'text-brand-500'},
        ].map(a => (
          <GeoPanelCardItem key={a.title} icon={a.icon} title={a.title} desc={a.desc} iconColor={a.color} />
        ))}
      </div>

      <GeoPanelFooterButton>
        Open Full Workspace →
      </GeoPanelFooterButton>
    </GeoPanel>
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
