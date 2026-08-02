/**
 * Dashboard shapes (mirrors app/schemas/dashboard.py).
 */
import type { ClassificationLevel, Confidence } from './common'

export interface KpiStrip {
  total_incidents: number
  active_gangs: number
  open_cases: number
  high_priority_entities: number
}

export interface TrendPoint {
  date: string
  value: number
}

export interface TrendSeries {
  window: string
  points: TrendPoint[]
}

export interface Hotspot {
  location_id: string
  label: string
  incident_count: number
  movement: string | null
}

export interface PriorityEntity {
  id: string
  type: string
  label: string
  classification: ClassificationLevel
  confidence: Confidence | null
}

export interface Alert {
  id: string
  type: string
  summary: string
  classification: ClassificationLevel
  created_at: string
  entity_type: string | null
  entity_id: string | null
  district_id: string | null
}

export interface DashboardResponse {
  region_id: string
  kpis: KpiStrip
  trends: TrendSeries[]
  hotspots: Hotspot[]
  priority_entities: PriorityEntity[]
  alerts: Alert[]
}
