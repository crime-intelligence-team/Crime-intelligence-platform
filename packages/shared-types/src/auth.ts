/**
 * Auth request/response shapes (mirrors app/schemas/auth.py).
 */

export interface LoginRequest {
  username_or_official_id: string
  password: string
}

export interface LoginResponse {
  mfa_required: boolean
  mfa_challenge_token: string | null
  access_token: string | null
  token_type: string
}

export interface MfaVerifyRequest {
  mfa_challenge_token: string
  otp_code: string
}

export interface MfaVerifyResponse {
  access_token: string
  token_type: string
}

export interface MfaStatusResponse {
  mfa_required: boolean
}

export interface StepUpRequest {
  password: string
  otp_code?: string | null
}

export interface StepUpResponse {
  step_up_token: string
  expires_at: string
  token_type: string
}

export interface CurrentUserResponse {
  id: string
  username: string
  full_name: string
  role: string
  permissions: string[]
  jurisdiction_scope: string[]
}

export interface MfaEnrollRequest {
  password: string
}

export interface MfaEnrollResponse {
  totp_secret: string
  otpauth_url: string
}

export interface MfaConfirmRequest {
  otp_code: string
}

export interface MfaDisableRequest {
  password: string
}
