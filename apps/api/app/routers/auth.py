from fastapi import APIRouter, Depends, Request

from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import (
    get_current_officer,
    require_step_up_auth,
)
from app.models.entities import Officer
from app.schemas.auth import (
    CurrentUserResponse,
    LoginRequest,
    LoginResponse,
    MfaConfirmRequest,
    MfaDisableRequest,
    MfaEnrollRequest,
    MfaEnrollResponse,
    MfaStatusResponse,
    MfaVerifyRequest,
    MfaVerifyResponse,
    StepUpRequest,
    StepUpResponse,
)
from app.services import auth_service

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)):
    ip_address = request.client.host if request.client else None
    return auth_service.login(
        db=db,
        username_or_official_id=payload.username_or_official_id,
        password=payload.password,
        ip_address=ip_address,
    )


@router.post("/mfa/verify", response_model=MfaVerifyResponse)
def mfa_verify(payload: MfaVerifyRequest, request: Request, db: Session = Depends(get_db)):
    ip_address = request.client.host if request.client else None
    return auth_service.verify_mfa(
        db=db,
        challenge_token=payload.mfa_challenge_token,
        otp_code=payload.otp_code,
        ip_address=ip_address,
    )


@router.post("/step-up", response_model=StepUpResponse)
def step_up(
    payload: StepUpRequest,
    request: Request,
    officer: Officer = Depends(get_current_officer),
    db: Session = Depends(get_db),
):
    """Fresh re-authentication for sensitive actions (Phase 6 component 1).
    Requires a live session (this is re-assertion, not a login path) and
    re-verifies the password; returns a short-lived purpose=step_up
    assertion consumed via the X-Step-Up-Token header by
    require_step_up_auth (export today, access-exception decisions next)."""
    ip_address = request.client.host if request.client else None
    return auth_service.issue_step_up_assertion(
        db=db,
        officer=officer,
        password=payload.password,
        otp_code=payload.otp_code,
        ip_address=ip_address,
    )


@router.post("/logout")
def logout(
    request: Request,
    officer: Officer = Depends(get_current_officer),
    db: Session = Depends(get_db),
):
    ip_address = request.client.host if request.client else None
    auth_service.logout(db=db, officer=officer, ip_address=ip_address)
    return {"status": "logged_out"}


@router.get("/me", response_model=CurrentUserResponse)
def read_current_user(officer: Officer = Depends(get_current_officer)):
    return auth_service.get_current_user_data(officer)


@router.post("/mfa/enroll", response_model=MfaEnrollResponse)
def mfa_enroll(
    payload: MfaEnrollRequest,
    request: Request,
    officer: Officer = Depends(get_current_officer),
    db: Session = Depends(get_db),
):
    """Begin TOTP enrollment: password re-auth, returns the base32 secret and
    otpauth_url (shown once; the frontend renders the QR). Completes only at
    /mfa/confirm — abandoned enrollments never lock the officer out."""
    ip_address = request.client.host if request.client else None
    return auth_service.enroll_mfa(
        db=db, officer=officer, password=payload.password, ip_address=ip_address,
    )


@router.post("/mfa/confirm", response_model=MfaStatusResponse)
def mfa_confirm(
    payload: MfaConfirmRequest,
    request: Request,
    officer: Officer = Depends(get_current_officer),
    db: Session = Depends(get_db),
):
    """Complete enrollment: the provided TOTP code must verify against the
    stored secret; only then is mfa_enabled flipped to 1."""
    ip_address = request.client.host if request.client else None
    return auth_service.confirm_mfa(
        db=db, officer=officer, otp_code=payload.otp_code, ip_address=ip_address,
    )


@router.post("/mfa/disable", response_model=MfaStatusResponse)
def mfa_disable(
    payload: MfaDisableRequest,
    request: Request,
    officer: Officer = Depends(get_current_officer),
    db: Session = Depends(get_db),
    _: None = Depends(require_step_up_auth),
):
    """Disable MFA: gated behind a fresh step-up assertion (X-Step-Up-Token)
    plus a password re-check; clears the TOTP secret and flag."""
    ip_address = request.client.host if request.client else None
    return auth_service.disable_mfa(
        db=db, officer=officer, password=payload.password, ip_address=ip_address,
    )
