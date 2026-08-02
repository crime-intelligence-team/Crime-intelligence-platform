/**
 * Typed endpoint functions for the crime intelligence backend (all under
 * /api/v1). One object per API domain, matching the backend routers.
 *
 * Phase 2 (auth) wires setAccessToken/setStepUpToken from AuthContext.
 * Phase 3 rewrites the pages to consume these instead of the mock layer.
 */

import type {
  AccessExceptionRequestCreate,
  AccessExceptionRequestResponse,
  Alert,
  AuditLogEntry,
  CaseCreate,
  CaseDetail,
  CaseSummary,
  ConfidenceReviewDecision,
  ConfidenceReviewResponse,
  ConfidenceReviewSubmit,
  CurrentUserResponse,
  DashboardResponse,
  DistrictDetail,
  DistrictQuickSummary,
  DistrictSummary,
  EntityDetail,
  EntitySummary,
  EntityType,
  ExportRequest,
  ExportResponse,
  LoginRequest,
  LoginResponse,
  MergeRequest,
  MergeResponse,
  MfaConfirmRequest,
  MfaDisableRequest,
  MfaEnrollRequest,
  MfaEnrollResponse,
  MfaStatusResponse,
  MfaVerifyRequest,
  MfaVerifyResponse,
  NoteCreate,
  NoteSummary,
  PaginatedResponse,
  PriorityEntity,
  RedactionPolicyCreate,
  RedactionPolicyResponse,
  RelationshipOut,
  SearchResponse,
  StepUpRequest,
  StepUpResponse,
  ZoneRiskOut,
} from '@cip/shared-types'

import { get, post } from './client'

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const authApi = {
  login: (payload: LoginRequest) => post<LoginResponse>('/auth/login', payload),
  verifyMfa: (payload: MfaVerifyRequest) => post<MfaVerifyResponse>('/auth/mfa/verify', payload),
  stepUp: (payload: StepUpRequest) => post<StepUpResponse>('/auth/step-up', payload),
  logout: () => post<{ status: string }>('/auth/logout'),
  me: () => get<CurrentUserResponse>('/auth/me'),
  enrollMfa: (payload: MfaEnrollRequest) => post<MfaEnrollResponse>('/auth/mfa/enroll', payload),
  confirmMfa: (payload: MfaConfirmRequest) => post<MfaStatusResponse>('/auth/mfa/confirm', payload),
  disableMfa: (payload: MfaDisableRequest) => post<MfaStatusResponse>('/auth/mfa/disable', payload),
}

// ─── Map / Districts / Zones ──────────────────────────────────────────────────
export const mapApi = {
  districts: (page = 1, pageSize = 100) =>
    get<PaginatedResponse<DistrictSummary>>('/districts', { page, page_size: pageSize }),
  district: (id: string) => get<DistrictDetail>(`/districts/${id}`),
  districtSummary: (id: string) => get<DistrictQuickSummary>(`/districts/${id}/summary`),
  zones: (districtId: string, page = 1, pageSize = 100) =>
    get<PaginatedResponse<ZoneRiskOut>>('/zones', { district_id: districtId, page, page_size: pageSize }),
  zone: (id: string) => get<ZoneRiskOut>(`/zones/${id}`),
  runZoneScoring: (districtId: string) =>
    post<PaginatedResponse<ZoneRiskOut>>(`/zones/${districtId}/run-scoring`),
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
export const dashboardApi = {
  byRegion: (regionId: string) => get<DashboardResponse>(`/dashboard/${regionId}`),
}

// ─── Network / Entities ───────────────────────────────────────────────────────
export const networkApi = {
  search: (q: string, type?: EntityType, page = 1, pageSize = 50) =>
    get<PaginatedResponse<EntitySummary>>('/entities/search', { q, type, page, page_size: pageSize }),
  entity: (id: string) => get<EntityDetail>(`/entities/${id}`),
  entityRelationships: (id: string, page = 1, pageSize = 50) =>
    get<PaginatedResponse<RelationshipOut>>(`/entities/${id}/relationships`, { page, page_size: pageSize }),
  relationship: (id: string) => get<RelationshipOut>(`/relationships/${id}`),
}

// ─── Cases ────────────────────────────────────────────────────────────────────
export const casesApi = {
  list: (page = 1, pageSize = 50, status?: string) =>
    get<PaginatedResponse<CaseSummary>>('/cases', { page, page_size: pageSize, status }),
  create: (payload: CaseCreate) => post<CaseDetail>('/cases', payload),
  byId: (id: string) => get<CaseDetail>(`/cases/${id}`),
  notes: (caseId: string, page = 1, pageSize = 50) =>
    get<PaginatedResponse<NoteSummary>>(`/cases/${caseId}/notes`, { page, page_size: pageSize }),
  addNote: (caseId: string, payload: NoteCreate) => post<NoteSummary>(`/cases/${caseId}/notes`, payload),
  export: (caseId: string, payload?: ExportRequest) => post<ExportResponse>(`/cases/${caseId}/export`, payload),
}

// ─── Alerts ───────────────────────────────────────────────────────────────────
export const alertsApi = {
  list: (page = 1, pageSize = 50) =>
    get<PaginatedResponse<Alert>>('/alerts', { page, page_size: pageSize }),
  priorityEntities: (page = 1, pageSize = 50) =>
    get<PaginatedResponse<PriorityEntity>>('/priority-entities', { page, page_size: pageSize }),
}

// ─── Governance / Admin ───────────────────────────────────────────────────────
export const redactionsApi = {
  policies: () => get<PaginatedResponse<RedactionPolicyResponse>>('/redactions/policies'),
  createPolicy: (payload: RedactionPolicyCreate) =>
    post<RedactionPolicyResponse>('/redactions/policies', payload),
  deactivatePolicy: (id: string) =>
    post<RedactionPolicyResponse>(`/redactions/policies/${id}/deactivate`),
}

export const accessExceptionsApi = {
  list: () => get<AccessExceptionRequestResponse[]>('/access-exceptions/requests'),
  create: (payload: AccessExceptionRequestCreate) =>
    post<AccessExceptionRequestResponse>('/access-exceptions/requests', payload),
  approve: (id: string) =>
    post<AccessExceptionRequestResponse>(`/access-exceptions/requests/${id}/approve`),
  deny: (id: string) =>
    post<AccessExceptionRequestResponse>(`/access-exceptions/requests/${id}/deny`),
  revoke: (id: string) =>
    post<AccessExceptionRequestResponse>(`/access-exceptions/requests/${id}/revoke`),
}

export const entityResolutionApi = {
  merge: (payload: MergeRequest) => post<MergeResponse>('/entity-resolution/merge', payload),
  reverseMerge: (eventId: string) =>
    post<MergeResponse>(`/entity-resolution/merge/${eventId}/reverse`),
}

export const adminApi = {
  submitConfidenceReview: (payload: ConfidenceReviewSubmit) =>
    post<ConfidenceReviewResponse>('/admin/confidence-review', payload),
  decideConfidenceReview: (id: string, payload: ConfidenceReviewDecision) =>
    post<ConfidenceReviewResponse>(`/admin/confidence-review/${id}/decision`, payload),
  audit: (params: { page?: number; page_size?: number; action?: string; actor_id?: string; q?: string } = {}) =>
    get<PaginatedResponse<AuditLogEntry>>('/admin/audit', params),
}

// ─── Global Search ────────────────────────────────────────────────────────────
export const searchApi = {
  global: (q: string, types?: string[], page = 1, pageSize = 20) =>
    get<SearchResponse>('/search', { q, types: types?.length ? types.join(',') : undefined, page, page_size: pageSize }),
}
