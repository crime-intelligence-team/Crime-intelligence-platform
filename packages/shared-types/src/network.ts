/**
 * Network / entity shapes (mirrors app/schemas/network.py).
 */
import type { ClassificationLevel, Confidence, RedactedField } from './common'

export type EntityType = 'person' | 'organization' | 'vehicle' | 'device' | 'address'

export interface EntitySummary {
  id: string
  type: EntityType
  label: string
  classification: ClassificationLevel
}

export interface EntityDetail extends Omit<EntitySummary, 'label'> {
  label: string | RedactedField
  aliases: string[] | RedactedField | null
  date_of_birth: string | RedactedField | null
  is_protected_subject: RedactedField | number | null
  org_type: string | RedactedField | null
  registration_number: string | RedactedField | null
  make: string | RedactedField | null
  model: string | RedactedField | null
  color: string | RedactedField | null
  phone_number: string | RedactedField | null
  imei: string | RedactedField | null
  device_type: string | RedactedField | null
  raw_text: string | RedactedField | null
  district_id: string | null
}

export interface RelationshipOut {
  id: string
  mirror_id: string | null
  type: string
  source_entity: EntitySummary
  target_entity: EntitySummary
  confidence: Confidence
  classification: ClassificationLevel
  verification_status: string
  effective_from: string | null
  effective_to: string | null
  case_id: string | null
}
