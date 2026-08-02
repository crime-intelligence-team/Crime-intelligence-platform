/**
 * Global search shapes (mirrors app/schemas/search.py). Each section is
 * present only when the caller holds the underlying permission and the
 * section was requested.
 */
import type { CaseSummary } from './cases'
import type { DistrictSummary } from './map'
import type { EntitySummary } from './network'

export interface SearchSection<T> {
  items: T[]
  total: number
}

export interface SearchResponse {
  query: string
  cases: SearchSection<CaseSummary> | null
  entities: SearchSection<EntitySummary> | null
  districts: SearchSection<DistrictSummary> | null
}
