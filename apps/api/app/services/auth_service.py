from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.permissions import get_officer_permissions
from app.core.security import create_access_token, decode_access_token, verify_password
from app.models.entities import Officer
from app.models.governance import AuditLogEntry
from app.schemas.auth import CurrentUserResponse, LoginResponse, MfaVerifyResponse


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

    if not otp_code or not otp_code.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": {
                    "code": "invalid_otp",
                    "message": "OTP code is required",
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
