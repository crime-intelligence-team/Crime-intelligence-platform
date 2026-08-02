from datetime import datetime, timedelta, timezone

import pyotp
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.permissions import get_officer_permissions
from app.core.security import create_access_token, decode_access_token, verify_password
from app.models.entities import Officer
from app.models.governance import AuditLogEntry
from app.schemas.auth import (
    CurrentUserResponse,
    LoginResponse,
    MfaEnrollResponse,
    MfaStatusResponse,
    MfaVerifyResponse,
    StepUpRequest,
    StepUpResponse,
)


def _write_audit_log(
    db: Session,
    actor_id,
    action: str,
    resource_type: str | None = None,
    resource_id: str | None = None,
    ip_address: str | None = None,
    detail: str | None = None,
) -> None:
    entry = AuditLogEntry(
        actor_id=actor_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        ip_address=ip_address,
        detail=detail,
    )
    db.add(entry)
    db.commit()


def authenticate_officer(
    db: Session,
    username_or_official_id: str,
    password: str,
    ip_address: str | None = None,
) -> Officer:
    officer = (
        db.query(Officer)
        .filter(
            (Officer.username == username_or_official_id)
            | (Officer.official_id == username_or_official_id)
        )
        .first()
    )

    if officer is None:
        _write_audit_log(
            db, actor_id=None, action="login_failed",
            detail=f"Unknown user: {username_or_official_id}",
            ip_address=ip_address,
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "error": {
                    "code": "invalid_credentials",
                    "message": "Invalid username/official ID or password",
                    "details": None,
                }
            },
        )

    if not verify_password(password, officer.hashed_password):
        _write_audit_log(
            db, actor_id=officer.id, action="login_failed",
            detail="Invalid password",
            ip_address=ip_address,
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "error": {
                    "code": "invalid_credentials",
                    "message": "Invalid username/official ID or password",
                    "details": None,
                }
            },
        )

    if not officer.is_active:
        _write_audit_log(
            db, actor_id=officer.id, action="login_failed",
            detail="Inactive account",
            ip_address=ip_address,
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "error": {
                    "code": "inactive_user",
                    "message": "Account is deactivated",
                    "details": None,
                }
            },
        )

    return officer


def login(
    db: Session,
    username_or_official_id: str,
    password: str,
    ip_address: str | None = None,
) -> LoginResponse:
    officer = authenticate_officer(db, username_or_official_id, password, ip_address)

    if officer.mfa_enabled:
        challenge_token = create_access_token(
            data={"sub": str(officer.id), "purpose": "mfa_challenge"},
            expires_minutes=5,
        )
        _write_audit_log(
            db, actor_id=officer.id, action="mfa_challenge_issued",
            ip_address=ip_address,
        )
        return LoginResponse(mfa_required=True, mfa_challenge_token=challenge_token)

    officer.last_login_at = datetime.now(timezone.utc)
    db.commit()

    _write_audit_log(
        db, actor_id=officer.id, action="login",
        ip_address=ip_address,
    )

    now_ts = datetime.now(timezone.utc).timestamp()
    access_token = create_access_token(
        data={"sub": str(officer.id), "purpose": "access", "session_start": now_ts}
    )
    return LoginResponse(mfa_required=False, access_token=access_token)


def verify_mfa(
    db: Session,
    challenge_token: str,
    otp_code: str,
    ip_address: str | None = None,
) -> MfaVerifyResponse:
    payload = decode_access_token(challenge_token)
    if payload is None or payload.get("purpose") != "mfa_challenge":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "error": {
                    "code": "invalid_challenge",
                    "message": "Invalid or expired MFA challenge token",
                    "details": None,
                }
            },
        )

    officer_id = payload["sub"]
    officer = db.query(Officer).filter(Officer.id == officer_id).first()
    if officer is None or not officer.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "error": {
                    "code": "inactive_user",
                    "message": "User not found or inactive",
                    "details": None,
                }
            },
        )

    if officer.mfa_enabled:
        # Real TOTP (RFC 6238, pyotp; ±1 step clock-drift window). The
        # migration backfilled mfa_enabled=0 for rows without a secret, so
        # "enabled but no secret" cannot occur via any data path — reject
        # defensively rather than ever accepting a code-less login.
        if not officer.totp_secret:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={
                    "error": {
                        "code": "mfa_not_enrolled",
                        "message": "MFA is enabled but no TOTP secret is enrolled",
                        "details": None,
                    }
                },
            )
        if not otp_code or not otp_code.strip() or not pyotp.TOTP(
            officer.totp_secret
        ).verify(otp_code.strip(), valid_window=1):
            _write_audit_log(
                db, actor_id=officer.id, action="mfa_verification_failed",
                ip_address=ip_address,
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={
                    "error": {
                        "code": "invalid_otp",
                        "message": "Invalid or expired OTP code",
                        "details": None,
                    }
                },
            )

    officer.last_login_at = datetime.now(timezone.utc)
    db.commit()

    now_ts = datetime.now(timezone.utc).timestamp()
    access_token = create_access_token(
        data={"sub": officer_id, "purpose": "access", "session_start": now_ts}
    )

    _write_audit_log(
        db, actor_id=officer.id, action="mfa_verified",
        ip_address=ip_address,
    )
    return MfaVerifyResponse(access_token=access_token)


def logout(
    db: Session,
    officer: Officer,
    ip_address: str | None = None,
) -> None:
    """
    Stateless JWT logout: no server-side token blacklist or session table.
    The client must discard the token. This endpoint only confirms the token
    was valid (via get_current_officer dependency) and records the audit
    event. Real server-side revocation would require a token allowlist or
    blocklist — implement that only if the brief explicitly requires it.
    """
    _write_audit_log(
        db, actor_id=officer.id, action="logout",
        ip_address=ip_address,
    )


def get_current_user_data(officer: Officer) -> CurrentUserResponse:
    permissions = get_officer_permissions(officer)
    jurisdiction = []
    if officer.home_district_id:
        jurisdiction.append(str(officer.home_district_id))

    return CurrentUserResponse(
        id=str(officer.id),
        username=officer.username,
        full_name=officer.full_name,
        role=officer.role.value,
        permissions=permissions,
        jurisdiction_scope=jurisdiction,
    )


def issue_step_up_assertion(
    db: Session,
    officer: Officer,
    password: str,
    otp_code: str | None = None,
    ip_address: str | None = None,
) -> StepUpResponse:
    """Fresh re-authentication for sensitive actions (Phase 6 component 1).

    The officer must already hold a live session (the router gates on
    get_current_officer) — step-up is a re-assertion on top of a session,
    never a login bypass. The password is re-verified against the officer's
    own hash; when MFA is enrolled (mfa_enabled AND totp_secret), otp_code
    is required and verified as a real TOTP code (RFC 6238, pyotp).

    The returned assertion is purpose=step_up, expires absolutely after
    STEP_UP_EXPIRE_MINUTES (the sliding-session middleware only reissues
    purpose=access tokens, so it is never refreshed), and is bound to this
    officer's sub — require_step_up_auth rejects it on any other session.
    """
    if not verify_password(password, officer.hashed_password):
        _write_audit_log(
            db, actor_id=officer.id, action="step_up_failed",
            detail="Invalid password", ip_address=ip_address,
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "error": {
                    "code": "invalid_credentials",
                    "message": "Invalid password",
                    "details": None,
                }
            },
        )

    if officer.mfa_enabled:
        if not officer.totp_secret or not otp_code or not otp_code.strip() or not pyotp.TOTP(
            officer.totp_secret
        ).verify(otp_code.strip(), valid_window=1):
            _write_audit_log(
                db, actor_id=officer.id, action="step_up_failed",
                detail="Invalid or missing OTP code", ip_address=ip_address,
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "error": {
                        "code": "invalid_otp",
                        "message": "A valid OTP code is required for step-up when MFA is enrolled",
                        "details": None,
                    }
                },
            )

    now = datetime.now(timezone.utc)
    token = create_access_token(
        data={"sub": str(officer.id), "purpose": "step_up"},
        expires_minutes=settings.STEP_UP_EXPIRE_MINUTES,
    )
    _write_audit_log(
        db, actor_id=officer.id, action="step_up",
        ip_address=ip_address,
    )
    return StepUpResponse(
        step_up_token=token,
        expires_at=(
            now + timedelta(minutes=settings.STEP_UP_EXPIRE_MINUTES)
        ).isoformat(),
    )


def enroll_mfa(
    db: Session,
    officer: Officer,
    password: str,
    ip_address: str | None = None,
) -> MfaEnrollResponse:
    """Start TOTP enrollment: the password is re-verified (the caller already
    holds a session), then a fresh base32 secret is generated and stored. The
    secret + otpauth_url are the ONLY exposure of the secret — the frontend
    renders the QR itself. mfa_enabled flips only on successful confirm, so
    an abandoned enrollment never locks anyone out."""
    if not verify_password(password, officer.hashed_password):
        _write_audit_log(
            db, actor_id=officer.id, action="mfa_enroll_failed",
            detail="Invalid password", ip_address=ip_address,
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "error": {
                    "code": "invalid_credentials",
                    "message": "Invalid password",
                    "details": None,
                }
            },
        )

    secret = pyotp.random_base32()
    officer.totp_secret = secret
    officer.totp_enrolled_at = None  # enrollment completes only at confirm
    db.commit()
    _write_audit_log(
        db, actor_id=officer.id, action="mfa_enroll_initiated",
        ip_address=ip_address,
    )
    return MfaEnrollResponse(
        totp_secret=secret,
        otpauth_url=pyotp.TOTP(secret).provisioning_uri(
            name=officer.username, issuer_name="CIP"
        ),
    )


def confirm_mfa(
    db: Session,
    officer: Officer,
    otp_code: str,
    ip_address: str | None = None,
) -> MfaVerifyResponse:
    """Complete enrollment: the current TOTP code must verify against the
    stored secret (the officer has the app seeded with it). Only then does
    mfa_enabled flip to 1, locking future logins behind real TOTP."""
    if not officer.totp_secret:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": {
                    "code": "mfa_not_enrolled",
                    "message": "No pending TOTP enrollment — call /mfa/enroll first",
                    "details": None,
                }
            },
        )
    if not otp_code or not otp_code.strip() or not pyotp.TOTP(
        officer.totp_secret
    ).verify(otp_code.strip(), valid_window=1):
        _write_audit_log(
            db, actor_id=officer.id, action="mfa_confirm_failed",
            ip_address=ip_address,
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "error": {
                    "code": "invalid_otp",
                    "message": "OTP code did not verify — check the clock on the authenticator app",
                    "details": None,
                }
            },
        )

    officer.mfa_enabled = 1
    officer.totp_enrolled_at = datetime.now(timezone.utc)
    db.commit()
    _write_audit_log(
        db, actor_id=officer.id, action="mfa_enrolled",
        ip_address=ip_address,
    )
    return MfaStatusResponse(mfa_required=True)


def disable_mfa(
    db: Session,
    officer: Officer,
    password: str,
    ip_address: str | None = None,
) -> MfaVerifyResponse:
    """Disable MFA. The router gates on require_step_up_auth (fresh step-up
    assertion) and the password is re-verified again — removing the second
    factor is itself a proven, audited act. Only clears TOTP state; never
    touches credentials."""
    if not verify_password(password, officer.hashed_password):
        _write_audit_log(
            db, actor_id=officer.id, action="mfa_disable_failed",
            detail="Invalid password", ip_address=ip_address,
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "error": {
                    "code": "invalid_credentials",
                    "message": "Invalid password",
                    "details": None,
                }
            },
        )

    officer.totp_secret = None
    officer.totp_enrolled_at = None
    officer.mfa_enabled = 0
    db.commit()
    _write_audit_log(
        db, actor_id=officer.id, action="mfa_disabled",
        ip_address=ip_address,
    )
    return MfaStatusResponse(mfa_required=False)
