/**
 * Retention-eligibility policy shapes (mirrors apps/api/app/schemas/
 * retention.py — see RetentionPolicy's model docstring for the flag-only
 * design: this never deletes or archives anything, it only surfaces a
 * candidate list for human review).
 */

export interface RetentionPolicyCreate {
  entity_type: string
  retention_days: number
  reason: string
}

export interface RetentionPolicyResponse {
  id: string
  entity_type: string
  retention_days: number
  reason: string
  active: boolean
  candidate_count: number
  created_by_id: string
  created_at: string | null
}

export interface RetentionCandidate {
  id: string
  label: string
  age_days: number
}
