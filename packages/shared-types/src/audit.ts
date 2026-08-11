/**
 * Audit log shapes (mirrors app/schemas/audit.py). Read-only — the log is
 * append-only; the API exposes no write path.
 */
export interface AuditLogEntry {
  id: string
  actor_id: string | null
  actor_name: string | null
  actor_role: string | null
  actor_district_id: string | null
  actor_district_name: string | null
  action: string
  module: string | null
  success: boolean
  resource_type: string | null
  resource_id: string | null
  ip_address: string | null
  device_identity: string | null
  detail: string | null
  created_at: string | null
}
