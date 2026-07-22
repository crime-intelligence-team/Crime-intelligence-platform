/**
 * API Service Layer
 *
 * Provides typed fetch wrappers for all data domains.
 * Falls back to mock data when the API is unavailable (404/network error).
 * When the real API is ready, set VITE_API_BASE_URL in .env.
 */

const BASE = import.meta.env.VITE_API_BASE_URL ?? ''

// ─── Generic fetch with mock fallback ─────────────────────────────────────────
async function apiFetch<T>(path: string, fallback: () => T): Promise<T> {
  if (!BASE) return fallback()
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { 'Content-Type': 'application/json' },
    })
    if (!res.ok) return fallback()
    return (await res.json()) as T
  } catch {
    return fallback()
  }
}

// ─── Import mocks (used as fallbacks) ─────────────────────────────────────────
import { mockCases }              from '../data/cases'
import { karnatakaDistricts, heatmapPoints, geoNetworkNodes, geoNetworkEdges } from '../data/districts'
import { entityRegistry, cytoscapeNodes, cytoscapeEdges } from '../data/networkGraph'
import { auditLog, securityDirectives, nodeIntegrity, clearanceLevels, policyDirectives } from '../data/governance'
import { correlationMatrix, temporalData, outliers, sectorData, incidentTrend72h } from '../data/analytics'
import type {
  Case, District, HeatmapPoint, GeoNetworkNode, GeoNetworkEdge,
  NetworkNode, CytoscapeNode, CytoscapeEdge,
  AuditEntry, SecurityDirective, NodeIntegrity, ClearanceLevelItem, PolicyDirective,
  CorrelationCell, TemporalDataPoint, StatisticalOutlier, SectorDistribution,
} from '../types'

// ─── Cases API ────────────────────────────────────────────────────────────────
export const casesApi = {
  list:  ()          => apiFetch<Case[]>('/api/cases', () => mockCases),
  byId:  (id: string)=> apiFetch<Case>(`/api/cases/${id}`, () => mockCases.find(c => c.id === id) ?? mockCases[0]),
}

// ─── Geo / Districts API ──────────────────────────────────────────────────────
export const geoApi = {
  districts:       () => apiFetch<District[]>('/api/geo/districts', () => karnatakaDistricts),
  districtById:    (id: string) => apiFetch<District>(`/api/geo/districts/${id}`, () => karnatakaDistricts.find(d => d.id === id) ?? karnatakaDistricts[0]),
  heatmap:         () => apiFetch<HeatmapPoint[]>('/api/geo/heatmap', () => heatmapPoints),
  networkNodes:    () => apiFetch<GeoNetworkNode[]>('/api/geo/network/nodes', () => geoNetworkNodes),
  networkEdges:    () => apiFetch<GeoNetworkEdge[]>('/api/geo/network/edges', () => geoNetworkEdges),
}

// ─── Network / Graph API ──────────────────────────────────────────────────────
export const networkApi = {
  entityRegistry:  () => apiFetch<NetworkNode[]>('/api/network/entities', () => entityRegistry),
  graphNodes:      () => apiFetch<CytoscapeNode[]>('/api/network/nodes', () => cytoscapeNodes),
  graphEdges:      () => apiFetch<CytoscapeEdge[]>('/api/network/edges', () => cytoscapeEdges),
}

// ─── Governance API ───────────────────────────────────────────────────────────
export const governanceApi = {
  auditLog:        () => apiFetch<AuditEntry[]>('/api/governance/audit', () => auditLog),
  directives:      () => apiFetch<SecurityDirective[]>('/api/governance/directives', () => securityDirectives),
  nodeIntegrity:   () => apiFetch<NodeIntegrity[]>('/api/governance/nodes', () => nodeIntegrity),
  clearanceLevels: () => apiFetch<ClearanceLevelItem[]>('/api/governance/clearance', () => clearanceLevels),
  policies:        () => apiFetch<PolicyDirective[]>('/api/governance/policies', () => policyDirectives),
}

// ─── Analytics API ────────────────────────────────────────────────────────────
export const analyticsApi = {
  correlationMatrix: () => apiFetch<CorrelationCell[]>('/api/analytics/correlation', () => correlationMatrix),
  temporalData:      () => apiFetch<TemporalDataPoint[]>('/api/analytics/temporal', () => temporalData),
  outliers:          () => apiFetch<StatisticalOutlier[]>('/api/analytics/outliers', () => outliers),
  sectorData:        () => apiFetch<SectorDistribution[]>('/api/analytics/sectors', () => sectorData),
  incidentTrend:     () => apiFetch<{ h: string; v: number }[]>('/api/analytics/trend72h', () => incidentTrend72h),
}
