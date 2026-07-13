from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.entities import Officer, Role

bearer_scheme = HTTPBearer(auto_error=False)


def get_current_officer(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> Officer:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": {"code": "unauthenticated", "message": "Missing bearer token", "details": None}},
        )
    payload = decode_access_token(credentials.credentials)
    if payload is None or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": {"code": "invalid_token", "message": "Token invalid or expired", "details": None}},
        )
    officer = db.query(Officer).filter(Officer.id == payload["sub"]).first()
    if officer is None or not officer.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": {"code": "inactive_user", "message": "User not found or inactive", "details": None}},
        )
    return officer


def require_roles(*allowed_roles: Role):
    """
    RBAC layer. Independent of what the frontend shows/hides — every protected
    route declares its own allowed roles and the API rejects regardless of UI state.
    """

    def dependency(officer: Officer = Depends(get_current_officer)) -> Officer:
        if officer.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error": {
                        "code": "role_not_permitted",
                        "message": f"Role '{officer.role}' is not permitted to access this resource",
                        "details": {"required_roles": [r.value for r in allowed_roles]},
                    }
                },
            )
        return officer

    return dependency


def require_step_up_auth(officer: Officer = Depends(get_current_officer)) -> Officer:
    """
    Placeholder hook for step-up auth required on export / policy override /
    cross-district exception approval (brief 7.1). Phase 1 wires the real
    re-auth challenge here; Phase 0 just marks the seam.
    """
    # TODO(Phase 1): verify a recent step-up assertion, not just the base session.
    return officer
