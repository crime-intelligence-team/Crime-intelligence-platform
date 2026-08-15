/**
 * Provenance data-source registry shapes (mirrors app/schemas/data_sources.py).
 */

export interface DataSourceCreate {
  name: string
  source_type: string
  owner: string
  cadence: string
  description?: string | null
}

export interface DataSourceResponse {
  id: string
  name: string
  source_type: string
  owner: string
  cadence: string
  description: string | null
  active: boolean
  record_count: number
  created_by_id: string
  created_at: string | null
}
