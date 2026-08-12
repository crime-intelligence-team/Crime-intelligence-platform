/**
 * Sensitive-tag admin shapes (mirrors app/schemas/sensitive_tags.py).
 */
import type { ClassificationLevel } from './common'

export interface SensitiveTagUpdate {
  is_protected_subject: boolean
  reason: string
}

export interface SensitiveSubjectOut {
  id: string
  full_name: string
  classification: ClassificationLevel
  is_protected_subject: boolean
}
