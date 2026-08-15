/**
 * Entity resolution shapes (mirrors app/schemas/entity_resolution.py).
 */

export interface MergeRequest {
  primary_entity_id: string
  absorbed_entity_id: string
  entity_type?: string
}

export interface MergeResponse {
  id: string
  primary_entity_id: string
  absorbed_entity_id: string
  entity_type: string
  status: string
}
