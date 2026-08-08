/**
 * Map / district / zone shapes (mirrors app/schemas/map.py).
 */
import type { ClassificationLevel, Confidence } from './common'

export interface DistrictSummary {
  id: string
  name: string
  code: string
  classification: ClassificationLevel
  geometry: Record<string, unknown> | null
}

export interface DistrictDetail extends DistrictSummary {
  population: number | null
}

export interface DistrictQuickSummary {
  district_id: string
  open_cases: number
  active_alerts: number
  priority_entities: number
  classification: ClassificationLevel
}

export interface ZoneTopFactor {
  name: string
  weight: number
  description: string
}

export interface ZoneRiskOut {
  id: string
  district_id: string
  name: string
  score: number
  confidence: Confidence
  top_factors: ZoneTopFactor[]
  run_timestamp: string
  recommended_interpretation: string
  analyst_review_status: string | null
  classification: ClassificationLevel
  score_id: string | null
  geometry: Record<string, unknown> | null
}
