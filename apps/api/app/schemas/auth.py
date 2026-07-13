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


class CurrentUserResponse(BaseModel):
    id: str
    username: str
    full_name: str
    role: str
    permissions: list[str]
    jurisdiction_scope: list[str]  # district ids/codes this user can act within
