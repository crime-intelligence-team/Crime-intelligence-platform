from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from app.core.security import create_access_token, decode_access_token


class SlidingSessionMiddleware(BaseHTTPMiddleware):
    """
    Reissues the access token on every authenticated response via the
    X-Refresh-Token header. The client must replace its stored token with
    this value before the next request. This keeps the iat claim fresh so
    the SESSION_INACTIVITY_EXPIRE_MINUTES check in get_current_officer
    measures real inactivity rather than time-since-original-login.
    """

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)

        if response.status_code < 400:
            auth_header = request.headers.get("Authorization")
            if auth_header and auth_header.startswith("Bearer "):
                token = auth_header.removeprefix("Bearer ")
                payload = decode_access_token(token)
                if payload and payload.get("purpose") == "access":
                    new_token = create_access_token(
                        data={
                            "sub": payload["sub"],
                            "purpose": "access",
                            "session_start": payload.get("session_start"),
                        }
                    )
                    response.headers["X-Refresh-Token"] = new_token

        return response
