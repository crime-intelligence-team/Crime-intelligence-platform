/**
 * API HTTP client for the crime intelligence backend.
 *
 * - Base URL from VITE_API_BASE_URL (defaults to the Vite-proxied /api/v1).
 * - Injects Authorization (Bearer access token) and X-Step-Up-Token headers.
 * - Unwraps the backend's {"error": {code, message, details}} envelope into
 *   an ApiError; leaves successful payloads untouched.
 * - Consumes the sliding-session X-Refresh-Token response header.
 *
 * Token storage is intentionally minimal here: Phase 2 (auth rewire) wires
 * these setters to AuthContext.
 */

import type { ErrorResponse } from '@cip/shared-types'

export const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api/v1'

const ACCESS_TOKEN_KEY = 'cip.access_token'

// The access token is persisted so a page reload restores the session; the
// step-up token is short-lived (5 min) and deliberately kept in memory only.
let accessToken: string | null =
  typeof localStorage !== 'undefined' ? localStorage.getItem(ACCESS_TOKEN_KEY) : null
let stepUpToken: string | null = null

/** Called when any request returns 401 (expired/invalid session). */
let onUnauthorized: (() => void) | null = null

export function setOnUnauthorized(handler: (() => void) | null): void {
  onUnauthorized = handler
}

export function setAccessToken(token: string | null): void {
  accessToken = token
  if (typeof localStorage !== 'undefined') {
    if (token) localStorage.setItem(ACCESS_TOKEN_KEY, token)
    else localStorage.removeItem(ACCESS_TOKEN_KEY)
  }
}
export function setStepUpToken(token: string | null): void {
  stepUpToken = token
}
export function getAccessToken(): string | null {
  return accessToken
}
export function getStepUpToken(): string | null {
  return stepUpToken
}

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details: unknown

  constructor(status: number, code: string, message: string, details: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown
}

/** Shared fetch + auth-header + error-envelope handling for both the JSON
 * (request) and binary (downloadFile) response paths. */
async function _authorizedFetch(path: string, options: RequestOptions): Promise<Response> {
  const headers = new Headers(options.headers)
  const isFormData = options.body instanceof FormData
  if (options.body !== undefined && !isFormData) {
    headers.set('Content-Type', 'application/json')
  }
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)
  if (stepUpToken) headers.set('X-Step-Up-Token', stepUpToken)

  let res: Response
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
      body: options.body === undefined ? undefined : isFormData ? (options.body as FormData) : JSON.stringify(options.body),
    })
  } catch (err) {
    throw new ApiError(0, 'network_error', 'Unable to reach the API server', String(err))
  }

  // Sliding session: the API reissues the access token on every <400 response.
  const refreshed = res.headers.get('X-Refresh-Token')
  if (refreshed) accessToken = refreshed

  if (!res.ok) {
    if (res.status === 401) onUnauthorized?.()
    let envelope: ErrorResponse | null = null
    try {
      envelope = (await res.json()) as ErrorResponse
    } catch {
      /* non-JSON error body */
    }
    if (envelope?.error) {
      throw new ApiError(
        res.status,
        envelope.error.code,
        envelope.error.message,
        envelope.error.details,
      )
    }
    throw new ApiError(res.status, 'http_error', `Request failed with status ${res.status}`, null)
  }

  return res
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const res = await _authorizedFetch(path, options)
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

/** Streams a binary response (e.g. attachment download) as a Blob, paired
 * with the filename from Content-Disposition when the server sends one. */
export async function downloadFile(
  path: string,
): Promise<{ blob: Blob; filename: string | null }> {
  const res = await _authorizedFetch(path, {})
  const disposition = res.headers.get('Content-Disposition') ?? ''
  const match = /filename="?([^";]+)"?/.exec(disposition)
  return { blob: await res.blob(), filename: match ? match[1] : null }
}

export function get<T>(
  path: string,
  params?: Record<string, string | number | boolean | undefined | null>,
): Promise<T> {
  const qs = params
    ? new URLSearchParams(
        Object.entries(params).flatMap(([k, v]) =>
          // Drop null/undefined only; empty strings are meaningful (e.g.
          // /entities/search?q= returns the full set when q is required).
          v === null || v === undefined ? [] : [[k, String(v)]],
        ),
      ).toString()
    : ''
  return request<T>(qs ? `${path}?${qs}` : path)
}

export function post<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, { method: 'POST', body })
}

export function patch<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, { method: 'PATCH', body })
}

export function del<T>(path: string): Promise<T> {
  return request<T>(path, { method: 'DELETE' })
}

export function postForm<T>(path: string, form: FormData): Promise<T> {
  return request<T>(path, { method: 'POST', body: form })
}
