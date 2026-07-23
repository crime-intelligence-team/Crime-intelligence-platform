from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.middleware import SlidingSessionMiddleware
from app.routers import admin, auth, cases, dashboard, map as map_router, network

app = FastAPI(
    title="Crime Intelligence Platform API",
    version="0.1.0",
    description="Backend for the state crime intelligence platform. See docs/api-contract.md.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(SlidingSessionMiddleware)


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """
    Normalizes every error to the {"error": {code, message, details}} shape
    from the §8 contract, even for exceptions raised without that shape.
    """
    if isinstance(exc.detail, dict) and "error" in exc.detail:
        payload = exc.detail
    else:
        payload = {"error": {"code": "http_error", "message": str(exc.detail), "details": None}}
    return JSONResponse(status_code=exc.status_code, content=payload)


app.include_router(auth.router)
app.include_router(map_router.router)
app.include_router(dashboard.router)
app.include_router(network.router)
app.include_router(cases.router)
app.include_router(admin.router)


@app.get("/health")
def health():
    return {"status": "ok", "environment": settings.ENVIRONMENT}
