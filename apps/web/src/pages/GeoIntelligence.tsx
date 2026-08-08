import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { MapContainer, TileLayer, CircleMarker, Polygon, Tooltip } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { X, AlertTriangle, MapPin, RefreshCw, ExternalLink, Navigation } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { ErrorBoundary } from '../components/ui/ErrorBoundary'
import { SkeletonMap } from '../components/ui/Skeletons'
import { useApi } from '../hooks/useApi'
import { mapApi } from '../services/endpoints'
import type { DistrictQuickSummary, DistrictSummary, ZoneRiskOut } from '@cip/shared-types'

type MapMode = 'default' | 'zone'

// ── Geometry helpers ───────────────────────────────────────────────────────────
/** GeoJSON geometry (Polygon/MultiPolygon) → [lat, lng] centroid. */
function centroidOf(geometry: Record<string, unknown> | null | undefined): [number, number] | null {
  if (!geometry || typeof geometry !== 'object') return null
  const type = geometry['type']
  const coords = geometry['coordinates'] as unknown
  let rings: unknown[][] = []
  if (type === 'Polygon') rings = (coords as unknown[][]) ?? []
  else if (type === 'MultiPolygon') {
    for (const poly of (coords as unknown[][][]) ?? []) rings = rings.concat(poly)
  } else return null
  let sumLat = 0
  let sumLng = 0
  let n = 0
  for (const ring of rings) {
    for (const pt of ring as unknown[][]) {
      sumLng += (pt[0] as number) ?? 0
      sumLat += (pt[1] as number) ?? 0
      n++
    }
  }
  if (n === 0) return null
  return [sumLat / n, sumLng / n]
}

/** GeoJSON Polygon geometry -> Leaflet [lat, lng] ring for the outer
 * boundary (holes, if any, are ignored — every zone polygon this
 * codebase seeds/tests with is a single simple ring). */
function polygonLatLngs(geometry: Record<string, unknown> | null | undefined): [number, number][] | null {
  if (!geometry || typeof geometry !== 'object') return null
  if (geometry['type'] !== 'Polygon') return null
  const rings = geometry['coordinates'] as unknown as number[][][] | undefined
  const outer = rings?.[0]
  if (!outer || outer.length === 0) return null
  return outer.map(([lng, lat]) => [lat, lng] as [number, number])
}

// ── Color helpers ──────────────────────────────────────────────────────────────
const classificationColor: Record<string, string> = {
  open_operational: '#22c55e',
  restricted_operational: '#f59e0b',
  protected: '#ef4444',
  sealed: '#64748b',
}
const classificationLabel: Record<string, string> = {
  open_operational: 'Open Operational',
  restricted_operational: 'Restricted Operational',
  protected: 'Protected',
  sealed: 'Sealed',
}
const scoreColor = (score: number) => (score >= 75 ? '#ef4444' : score >= 50 ? '#f59e0b' : '#22c55e')

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

function GeoPanelDataRow({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div className="min-h-[40px] flex items-center justify-between border-b border-border-subtle last:border-0 py-2">
      <span className="text-[13px] font-medium text-text-secondary">{label}</span>
      {value && <span className="text-[13px] font-semibold text-text-primary">{value}</span>}
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

function GeoPanelCallout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-bg-surface-2/75 rounded-md p-4 border-l-[3px] border-l-brand-500">
      <p className="text-[13px] text-text-secondary leading-relaxed">{children}</p>
    </div>
  )
}

// ── District Quick Summary panel ──────────────────────────────────────────────
function DistrictQuickSummary({ district, summary, loading, onClose }: {
  district: DistrictSummary
  summary: DistrictQuickSummary | null
  loading: boolean
  onClose: () => void
}) {
  const navigate = useNavigate()
  const color = classificationColor[district.classification] ?? '#64748b'
  return (
    <GeoPanel>
      <GeoPanelHeader eyebrow="District Quick-Summary" icon={MapPin} title={district.name} onClose={onClose} />

      <GeoPanelDataRow label="Code" value={<span className="font-mono text-[12px]">{district.code}</span>} />
      <GeoPanelDataRow
        label="Classification"
        value={<span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full" style={{ background: color }} />{classificationLabel[district.classification] ?? district.classification}</span>}
      />

      <div className="grid grid-cols-3 gap-4">
        <GeoPanelStatCard label="Open Cases" value={loading ? '…' : (summary?.open_cases ?? 0)} />
        <GeoPanelStatCard label="Active Alerts" value={loading ? '…' : (summary?.active_alerts ?? 0)} />
        <GeoPanelStatCard label="Priority Entities" value={loading ? '…' : (summary?.priority_entities ?? 0)} />
      </div>

      {summary?.active_alerts === 0 && (
        <GeoPanelCallout>
          No active alerts reported for this district in the current window.
        </GeoPanelCallout>
      )}

      <Button variant="primary" size="md" onClick={() => navigate(`/map/district/${district.id}`)}>
        View Regional Dashboard <ExternalLink className="w-3.5 h-3.5" />
      </Button>
    </GeoPanel>
  )
}

// ── Zone Inspector panel ──────────────────────────────────────────────────────
function ZoneInspector({ district, zones, onClose, onRunScoring, scoring }: {
  district: DistrictSummary
  zones: ZoneRiskOut[]
  onClose: () => void
  onRunScoring: () => void
  scoring: boolean
}) {
  const [selectedZone, setSelectedZone] = useState<ZoneRiskOut | null>(zones[0] ?? null)
  const zone = selectedZone
  const scoreColorClass = (s: number) => (s >= 75 ? 'text-severity-critical' : s >= 50 ? 'text-severity-high' : 'text-severity-low')
  return (
    <GeoPanel>
      <GeoPanelHeader eyebrow="Zone Inspector" icon={AlertTriangle} title={district.name.toUpperCase()} onClose={onClose} />

      {zones.length === 0 ? (
        <GeoPanelCallout>
          No zone risk assessments have been generated for this district yet. Run scoring to generate them.
        </GeoPanelCallout>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {zones.map(z => (
              <button
                key={z.id}
                onClick={() => setSelectedZone(z)}
                className={`px-3 py-1.5 rounded-md border text-[11px] font-semibold transition-colors ${
                  zone?.id === z.id
                    ? 'bg-brand-500/15 border-brand-500/40 text-brand-500'
                    : 'bg-bg-surface-2/75 border-border-subtle text-text-secondary hover:text-text-primary'
                }`}
              >
                {z.name}
              </button>
            ))}
          </div>

          {zone && (
            <>
              <GeoPanelStatCard
                label="Zone Risk Score"
                value={<span className={scoreColorClass(zone.score)}>{zone.score}<span className="text-[14px] text-text-secondary ml-1 font-medium">/100</span></span>}
                subtext={
                  <span className="flex items-center gap-2 text-[12px]">
                    <span className={`font-semibold uppercase ${scoreColorClass(zone.score)}`}>
                      {zone.score >= 75 ? 'Critical' : zone.score >= 50 ? 'Elevated' : 'Low'}
                    </span>
                    <span className="text-text-secondary">· {zone.confidence.band}</span>
                  </span>
                }
              />

              <div className="flex flex-col">
                <p className="text-[12px] uppercase font-semibold text-text-secondary tracking-wider mb-2">Top Risk Factors</p>
                <div className="flex flex-col">
                  {zone.top_factors.map(f => (
                    <GeoPanelBar key={f.name} label={f.name} value={Math.round(f.weight * 100)} color={zone.score >= 75 ? 'red' : 'amber'} />
                  ))}
                </div>
              </div>

              <GeoPanelCallout>{zone.recommended_interpretation}</GeoPanelCallout>

              <GeoPanelDataRow label="Reviewed" value={zone.analyst_review_status ?? '—'} />
              <GeoPanelDataRow label="Scored At" value={<span className="font-mono text-[11px]">{new Date(zone.run_timestamp).toLocaleString()}</span>} />
            </>
          )}
        </>
      )}

      <Button variant="secondary" size="md" onClick={onRunScoring} disabled={scoring}>
        <RefreshCw className={`w-3.5 h-3.5 ${scoring ? 'animate-spin' : ''}`} />
        {scoring ? 'Running Scoring…' : 'Run Zone Scoring'}
      </Button>
    </GeoPanel>
  )
}

// ── Zone data loading ─────────────────────────────────────────────────────────
function useAllZones(districts: DistrictSummary[]) {
  const [zones, setZones] = useState<ZoneRiskOut[]>([])
  const [loading, setLoading] = useState(false)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (districts.length === 0) { setZones([]); return }
    let cancelled = false
    setLoading(true)
    Promise.all(districts.map(d => mapApi.zones(d.id).then(r => r.items)))
      .then(groups => { if (!cancelled) { setZones(groups.flat()); setLoading(false) } })
      .catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [districts, tick])

  const refetch = useCallback(() => setTick(t => t + 1), [])
  return { zones, loading, refetch }
}

// ── Main GeoIntelligence page ─────────────────────────────────────────────────
export default function GeoIntelligence() {
  const [searchParams, setSearchParams] = useSearchParams()
  const mode = (searchParams.get('mode') ?? 'default') as MapMode
  const setMode = (m: string) => setSearchParams(m === 'default' ? {} : { mode: m })

  const [selectedDistrict, setSelectedDistrict] = useState<DistrictSummary | null>(null)
  const [selectedZoneDistrict, setSelectedZoneDistrict] = useState<DistrictSummary | null>(null)
  const [scoring, setScoring] = useState(false)

  const { data: districtPage, loading: districtLoading } = useApi(() => mapApi.districts())
  const districts = districtPage?.items ?? []

  const { zones, refetch: refetchZones } = useAllZones(districts)

  const { data: summary, loading: summaryLoading } = useApi(
    () => (selectedDistrict ? mapApi.districtSummary(selectedDistrict.id) : Promise.resolve(null)),
    [selectedDistrict?.id],
  )

  // Map centre derived from the loaded districts (centroids average).
  const centres = districts.map(d => centroidOf(d.geometry)).filter((c): c is [number, number] => c !== null)
  const mapCentre: [number, number] = centres.length > 0
    ? [centres.reduce((s, c) => s + c[0], 0) / centres.length, centres.reduce((s, c) => s + c[1], 0) / centres.length]
    : [28.6, 77.25]

  // District marker colour: default = classification, zone = worst zone score.
  const districtColor = (d: DistrictSummary) => {
    if (mode === 'zone') {
      const dz = zones.filter(z => z.district_id === d.id)
      const worst = dz.length > 0 ? Math.max(...dz.map(z => z.score)) : 0
      return dz.length > 0 ? scoreColor(worst) : '#334155'
    }
    return classificationColor[d.classification] ?? '#64748b'
  }

  async function handleRunScoring() {
    if (!selectedZoneDistrict) return
    setScoring(true)
    try {
      await mapApi.runZoneScoring(selectedZoneDistrict.id)
      refetchZones()
    } finally {
      setScoring(false)
    }
  }

  return (
    <div className="relative h-full flex flex-col">
      {/* Tab bar */}
      <div className="shrink-0 flex items-center border-b border-surface-border bg-surface-raised px-4 gap-1">
        {['default', 'zone'].map(m => (
          <button key={m} onClick={() => setMode(m)}
            className={`px-4 py-2.5 text-xs font-medium capitalize transition-colors border-b-2 -mb-px ${mode === m ? 'border-accent-blue text-accent-blue' : 'border-transparent text-sentinel-400 hover:text-sentinel-200'}`}>
            {m === 'default' ? 'Default' : 'Zone Mode'}
          </button>
        ))}

        {/* Zone legend */}
        {mode === 'zone' && (
          <div className="ml-auto flex items-center gap-3 text-[10px] text-sentinel-300">
            <div className="flex items-center gap-1.5">
              <div className="w-20 h-2 rounded" style={{ background: 'linear-gradient(to right,#22c55e,#f59e0b,#f97316,#ef4444)' }} />
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
              center={mapCentre}
              zoom={9}
              style={{ height: '100%', width: '100%' }}
              zoomControl={false}
            >
              <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />

              {/* Zone choropleth: real zone polygons colored by risk score.
                  Zones with no geometry (or unscored) contribute nothing here —
                  the district dot below remains the click target regardless. */}
              {mode === 'zone' && zones.map(z => {
                const latlngs = polygonLatLngs(z.geometry)
                if (!latlngs) return null
                const color = scoreColor(z.score)
                return (
                  <Polygon
                    key={z.id}
                    positions={latlngs}
                    pathOptions={{ color, fillColor: color, fillOpacity: 0.45, weight: 1.5 }}
                    eventHandlers={{
                      click: () => {
                        const d = districts.find(dd => dd.id === z.district_id)
                        if (d) { setSelectedZoneDistrict(d); setSelectedDistrict(null) }
                      },
                    }}
                  >
                    <Tooltip direction="center" sticky opacity={1}>
                      <span>{z.name} — {z.score}/100</span>
                    </Tooltip>
                  </Polygon>
                )
              })}

              {districts.map(d => {
                const c = centroidOf(d.geometry)
                if (!c) return null
                const color = districtColor(d)
                const dz = zones.filter(z => z.district_id === d.id)
                const tooltipLabel = mode === 'zone' && dz.length > 0
                  ? dz.map(z => `${z.name} — ${z.score}/100`).join('\n')
                  : d.name
                return (
                  <CircleMarker
                    key={d.id}
                    center={c}
                    radius={mode === 'zone' ? 10 : 8}
                    fillColor={color}
                    color={color}
                    weight={2}
                    fillOpacity={0.85}
                    opacity={0.9}
                    eventHandlers={{
                      click: () => {
                        if (mode === 'zone') { setSelectedZoneDistrict(d); setSelectedDistrict(null) }
                        else { setSelectedDistrict(d); setSelectedZoneDistrict(null) }
                      },
                    }}
                  >
                    <Tooltip direction="top" offset={[0, -8]} permanent={false} className="sentinel-tooltip" opacity={1}>
                      <span className="whitespace-pre-line">{tooltipLabel}</span>
                    </Tooltip>
                  </CircleMarker>
                )
              })}
            </MapContainer>
          </ErrorBoundary>
        )}

        {/* Right panels */}
        {mode === 'default' && selectedDistrict && (
          <DistrictQuickSummary
            district={selectedDistrict}
            summary={summary ?? null}
            loading={summaryLoading}
            onClose={() => setSelectedDistrict(null)}
          />
        )}
        {mode === 'zone' && selectedZoneDistrict && (
          <ZoneInspector
            district={selectedZoneDistrict}
            zones={zones.filter(z => z.district_id === selectedZoneDistrict.id)}
            onClose={() => setSelectedZoneDistrict(null)}
            onRunScoring={handleRunScoring}
            scoring={scoring}
          />
        )}
        {/* Zone click helper */}
        {mode === 'zone' && !selectedZoneDistrict && (
          <div className="absolute bottom-6 right-4 z-[500] flex items-center gap-2 bg-surface-card/80 border border-surface-border rounded-lg px-3 py-2 text-[11px] text-sentinel-400 backdrop-blur-sm">
            <Navigation className="w-3.5 h-3.5" /> Click a district to inspect zone scoring
          </div>
        )}
      </div>
    </div>
  )
}
