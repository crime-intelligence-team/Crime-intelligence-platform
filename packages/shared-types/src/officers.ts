/**
 * Officer directory / hierarchy shapes (mirrors app/schemas/officers.py).
 */

export interface OfficerSummary {
  id: string
  official_id: string
  full_name: string
  role: string
  unit: string | null
  manager_id: string | null
}

export interface OfficerManagerUpdate {
  manager_id: string | null
}
