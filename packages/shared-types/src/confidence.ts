/**
 * Confidence review shapes (mirrors app/schemas/confidence.py).
 */

export interface ConfidenceReviewSubmit {
  target_type: string
  target_id: string
  action: string
  proposed_score?: number | null
}

export interface ConfidenceReviewDecision {
  decision: string
}

export interface ConfidenceReviewResponse {
  id: string
  target_type: string
  target_id: string
  action: string
  original_score: number | null
  proposed_score: number | null
  review_status: string
  submitted_by_id: string
  reviewed_by_id: string | null
  reviewed_at: string | null
  created_at: string | null
}
