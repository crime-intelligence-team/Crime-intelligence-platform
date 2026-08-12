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
  AttachmentSummary,
  AuditLogEntry,
  CaseCreate,
  CaseDetail,
  CaseSummary,
  CaseTeamMemberOut,
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
  OfficerManagerUpdate,
  OfficerSummary,
  PaginatedResponse,
  PathOut,
  PriorityEntity,
  RedactionPolicyCreate,
  RedactionPolicyResponse,
  RelationshipOut,
  SearchResponse,
  StepUpRequest,
  StepUpResponse,
  ZoneRiskOut,
} from '@cip/shared-types'

import { get, post, patch, del, postForm, downloadFile } from './client'

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
  paths: (entityId: string, targetId: string, maxHops = 4, limit = 10) =>
    get<PathOut[]>(`/entities/${entityId}/paths/${targetId}`, { max_hops: maxHops, limit }),
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
  updateStatus: (caseId: string, status: string) =>
    patch<CaseDetail>(`/cases/${caseId}/status`, { status }),
  team: (caseId: string) => get<CaseTeamMemberOut[]>(`/cases/${caseId}/team`),
  addTeamMember: (caseId: string, officerId: string) =>
    post<CaseTeamMemberOut>(`/cases/${caseId}/team`, { officer_id: officerId }),
  removeTeamMember: (caseId: string, officerId: string) =>
    del<CaseTeamMemberOut>(`/cases/${caseId}/team/${officerId}`),
  attachments: (caseId: string) => get<AttachmentSummary[]>(`/cases/${caseId}/attachments`),
  uploadAttachment: (caseId: string, file: File, classification?: string) => {
    const form = new FormData()
    form.append('file', file)
    if (classification) form.append('classification', classification)
    return postForm<AttachmentSummary>(`/cases/${caseId}/attachments`, form)
  },
  downloadAttachment: (caseId: string, attachmentId: string) =>
    downloadFile(`/cases/${caseId}/attachments/${attachmentId}/download`),
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
  audit: (
    params: {
      page?: number
      page_size?: number
      action?: string
      actor_id?: string
      module?: string
      success?: boolean
      date_from?: string
      date_to?: string
      q?: string
    } = {},
  ) => get<PaginatedResponse<AuditLogEntry>>('/admin/audit', params),
}

// ─── Officers ─────────────────────────────────────────────────────────────────
export const officersApi = {
  list: () => get<OfficerSummary[]>('/officers'),
  setManager: (officerId: string, payload: OfficerManagerUpdate) =>
    patch<OfficerSummary>(`/officers/${officerId}/manager`, payload),
}

// ─── Global Search ────────────────────────────────────────────────────────────
export const searchApi = {
  global: (q: string, types?: string[], page = 1, pageSize = 20) =>
    get<SearchResponse>('/search', { q, types: types?.length ? types.join(',') : undefined, page, page_size: pageSize }),
}
