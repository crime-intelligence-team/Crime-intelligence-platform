/**
 * Shared enums and response primitives (mirrors app/schemas/common.py).
 */

export type ClassificationLevel =
  | 'open_operational'
  | 'restricted_operational'
  | 'protected'
  | 'sealed'

export type ConfidenceBand = 'unconfirmed' | 'probable' | 'verified'

export interface Confidence {
  score: number
  band: ConfidenceBand
}

/** Redacted fields return this shape instead of being omitted (contract rule). */
export interface RedactedField {
  redacted: true
  reason: 'policy' | 'no_access' | 'manual'
}

export type MaybeRedacted<T> = T | RedactedField

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}

export interface ErrorDetail {
  code: string
  message: string
  details: unknown
}

export interface ErrorResponse {
  error: ErrorDetail
}
