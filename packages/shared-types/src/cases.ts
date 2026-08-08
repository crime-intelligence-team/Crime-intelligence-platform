/**
 * Case workspace shapes (mirrors app/schemas/cases.py).
 */
import type { ClassificationLevel, RedactedField } from './common'

export interface CaseCreate {
  case_number: string
  title: string
  summary?: string | null
  district_id: string
  address_id?: string | null
  status?: string
  classification?: ClassificationLevel
}

export interface CaseSummary {
  id: string
  case_number: string
  title: string
  status: string
  classification: ClassificationLevel
  district_id: string | null
  created_at: string | null
}

export interface CaseDetail extends CaseSummary {
  summary: RedactedField | string | null
  lead_officer_id: string | null
  address_id: string | null
  zone_id: string | null
}

export interface CaseTeamMemberOut {
  officer_id: string
  official_id: string
  full_name: string
  role: string
  unit: string | null
  is_lead: boolean
  added_at: string | null
}

export interface AttachmentSummary {
  id: string
  case_id: string
  filename: string
  content_type: string
  size_bytes: number
  classification: ClassificationLevel
  uploaded_by_id: string
  created_at: string | null
}

export interface NoteCreate {
  body: string
  visibility?: string
  finding_state?: string | null
  classification?: ClassificationLevel
}

export interface NoteSummary {
  id: string
  case_id: string
  author_id: string
  body: RedactedField | string
  visibility: string
  finding_state: string | null
  classification: ClassificationLevel
  created_at: string | null
}

export interface ExportRequest {
  redact_note_ids?: string[] | null
}

export interface ExportOfficer {
  official_id: string
  full_name: string
  role: string
}

export interface ExportResponse {
  export_id: string
  initiated_at: string
  initiated_by: ExportOfficer
  classification: ClassificationLevel
  case: CaseDetail
  notes: NoteSummary[]
}

export interface RedactionPolicyCreate {
  entity_type: string
  field: string
  min_classification: ClassificationLevel
  reason: string
}

export interface RedactionPolicyResponse {
  id: string
  entity_type: string
  field: string
  min_classification: ClassificationLevel
  decision: string
  reason: string
  active: boolean
  created_by_id: string
  created_at: string | null
}
