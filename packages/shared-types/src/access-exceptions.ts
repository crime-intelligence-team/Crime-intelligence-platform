/**
 * Access exception shapes (mirrors app/schemas/access_exceptions.py).
 */

export interface AccessExceptionRequestCreate {
  case_reference: string
  operational_reason: string
  requested_duration_hours: string
}

export interface AccessExceptionRequestResponse {
  id: string
  case_reference: string
  operational_reason: string
  requested_duration_hours: string
  status: string
  requested_by_id: string
  reviewed_by_id: string | null
  reviewed_at: string | null
  expires_at: string | null
  effective: boolean
  created_at: string | null
}
