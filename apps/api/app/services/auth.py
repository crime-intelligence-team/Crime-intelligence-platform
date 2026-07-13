import uuid

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import create_access_token, decode_access_token, verify_password
from app.models.entities import Officer, Role
from app.models.governance import AuditLogEntry
from app.schemas.auth import CurrentUserResponse, LoginResponse, MfaVerifyResponse


ROLE_PERMISSIONS: dict[Role, list[str]] = {
    Role.DISTRICT_OFFICER: [
        "case:read", "case:write", "entity:read", "entity:write",
        "search:basic", "map:view", "note:create", "note:read",
    ],
    Role.DETECTIVE: [
        "case:read", "case:write", "entity:read", "entity:write",
        "search:basic", "search:advanced", "map:view", "note:create",
        "note:read", "export:case", "relationship:view",
    ],
    Role.ANALYST: [
        "case:read", "entity:read", "search:basic", "search:advanced",
        "map:view", "relationship:view", "dashboard:view",
        "export:analysis", "risk:view",
    ],
    Role.SUPERVISOR: [
        "case:read", "case:write", "entity:read", "entity:write",
        "search:basic", "search:advanced", "map:view", "note:create",
        "note:read", "export:case", "export:analysis", "relationship:view",
        "dashboard:view", "risk:view", "officer:view", "audit:view",
        "exception:approve",
    ],
    Role.ADMINISTRATOR: [
        "case:read", "case:write", "entity:read", "entity:write",
        "search:basic", "search:advanced", "map:view", "note:create",
        "note:read", "export:case", "export:analysis", "relationship:view",
        "dashboard:view", "risk:view", "officer:view", "officer:manage",
        "audit:view", "exception:approve", "system:configure",
        "classification:override",
    ],
}


def _log_audit(
    db: Session,
    actor_id: uuid.UUID | None,
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


def authenticate_user(
    db: Session,
    username_or_official_id: str,
    password: str,
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
    officer = authenticate_user(db, username_or_official_id, password)

    if officer.mfa_enabled:
        challenge_token = create_access_token(
            data={"sub": str(officer.id), "purpose": "mfa_challenge"},
            expires_minutes=5,
        )
        _log_audit(
            db=db,
            actor_id=officer.id,
            action="mfa_challenge_issued",
            ip_address=ip_address,
            detail="MFA challenge issued",
        )
        return LoginResponse(mfa_required=True, mfa_challenge_token=challenge_token)

    access_token = create_access_token(data={"sub": str(officer.id)})
    _log_audit(
        db=db,
        actor_id=officer.id,
        action="login",
        ip_address=ip_address,
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

    access_token = create_access_token(data={"sub": officer_id})
    _log_audit(
        db=db,
        actor_id=officer.id,
        action="mfa_verified",
        ip_address=ip_address,
    )
    return MfaVerifyResponse(access_token=access_token)


def logout(
    db: Session,
    officer: Officer,
    ip_address: str | None = None,
) -> None:
    _log_audit(
        db=db,
        actor_id=officer.id,
        action="logout",
        ip_address=ip_address,
    )


def get_current_user_data(officer: Officer) -> CurrentUserResponse:
    permissions = ROLE_PERMISSIONS.get(officer.role, [])
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
