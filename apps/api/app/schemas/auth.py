from pydantic import BaseModel


class LoginRequest(BaseModel):
    username_or_official_id: str
    password: str


class LoginResponse(BaseModel):
    mfa_required: bool
    mfa_challenge_token: str | None = None
    access_token: str | None = None
    token_type: str = "bearer"


class MfaVerifyRequest(BaseModel):
    mfa_challenge_token: str
    otp_code: str


class MfaVerifyResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class MfaStatusResponse(BaseModel):
    mfa_required: bool


class StepUpRequest(BaseModel):
    """Fresh re-authentication for sensitive actions (brief 7.1, 7.11):
    the password is re-verified against the session officer's hash;
    otp_code is required when the officer has MFA enabled, validated with
    the same (currently provider-fake) check login MFA uses — parity is
    the property, real OTP verification is deferred with the provider."""

    password: str
    otp_code: str | None = None


class StepUpResponse(BaseModel):
    """Short-lived step-up assertion, bound to the session officer.
    purpose=step_up tokens are never reissued by the sliding-session
    middleware (it only refreshes purpose=access), so the assertion
    expires absolutely and requires fresh re-auth every time."""

    step_up_token: str
    expires_at: str
    token_type: str = "step-up"


class CurrentUserResponse(BaseModel):
    id: str
    username: str
    full_name: str
    role: str
    permissions: list[str]
    jurisdiction_scope: list[str]  # district ids/codes this user can act within


class MfaEnrollRequest(BaseModel):
    """Start TOTP enrollment: re-authenticates with the password, then the
    returned secret + otpauth_url are shown ONCE (the frontend renders the
    QR from the URL). Enrollment completes only at confirm."""

    password: str


class MfaEnrollResponse(BaseModel):
    totp_secret: str
    otpauth_url: str


class MfaConfirmRequest(BaseModel):
    otp_code: str


class MfaDisableRequest(BaseModel):
    """Disable requires the step-up assertion (X-Step-Up-Token) AND the
    password again — disabling the second factor must itself be proven."""

    password: str
