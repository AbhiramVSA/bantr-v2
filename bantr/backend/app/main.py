import logging
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from asyncpg import UniqueViolationError
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware

from app.api.deps import get_db
from app.api.v1.api import api_router
from app.core.config import settings
from app.core.errors import AppError
from app.core.logging import setup_logging
from app.db.session import AsyncSessionLocal, engine
from app.services.rbac_service import ensure_default_roles_and_permissions

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging()
    # Warm DB pool
    async with engine.begin() as conn:
        await conn.execute(text("SELECT 1"))
    logger.info("Database pool warmed")
    # Seed roles/permissions/admins
    async with AsyncSessionLocal() as session:
        await ensure_default_roles_and_permissions(session)
        await session.commit()
    logger.info("Default roles and permissions seeded")
    yield
    await engine.dispose()
    logger.info("App shutdown complete")


app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan,
)

# -- Logfire instrumentation (module level, NOT inside lifespan) --
if settings.LOGFIRE_TOKEN:
    import logfire

    logfire.configure(
        token=settings.LOGFIRE_TOKEN, environment=settings.LOGFIRE_ENVIRONMENT
    )
    logfire.instrument_fastapi(app)
    logfire.instrument_asyncpg()


# -- Exception handlers --


@app.exception_handler(AppError)
async def app_error_handler(request: Request, exc: AppError):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": exc.code,
                "message": exc.message,
                "details": exc.details,
            }
        },
    )


@app.exception_handler(IntegrityError)
async def db_integrity_handler(request: Request, exc: IntegrityError):
    if isinstance(exc.orig.__cause__, UniqueViolationError):
        return JSONResponse(
            status_code=409,
            content={
                "error": {
                    "code": "CONFLICT",
                    "message": "Resource already exists",
                    "details": {},
                }
            },
        )
    logger.exception("Non-unique IntegrityError")
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": "INTERNAL_ERROR",
                "message": "An unexpected error occurred",
                "details": {},
            }
        },
    )


@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "Invalid request",
                "details": exc.errors(),
            }
        },
    )


@app.exception_handler(Exception)
async def unhandled_error_handler(request: Request, exc: Exception):
    logger.exception("Unhandled exception")
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": "INTERNAL_ERROR",
                "message": "An unexpected error occurred",
                "details": {},
            }
        },
    )


# -- Middleware (order matters — last added = outermost) --

# Rate limiting
from app.api.v1.routers.auth import limiter

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)


# Request body size limiter — checks Content-Length AND streaming body size
# to prevent bypass via chunked transfer encoding.
@app.middleware("http")
async def limit_request_body(request: Request, call_next):
    max_size = settings.MAX_REQUEST_BODY_SIZE
    reject = JSONResponse(
        status_code=413,
        content={
            "error": {
                "code": "PAYLOAD_TOO_LARGE",
                "message": "Request body exceeds size limit",
                "details": {},
            }
        },
    )
    bad_cl = JSONResponse(
        status_code=400,
        content={
            "error": {
                "code": "BAD_REQUEST",
                "message": "Invalid Content-Length header",
                "details": {},
            }
        },
    )
    cl = request.headers.get("content-length")
    if cl:
        try:
            if int(cl) > max_size:
                return reject
        except ValueError:
            return bad_cl

    if request.method in ("POST", "PUT", "PATCH") and not cl:
        total = 0
        chunks: list[bytes] = []
        async for chunk in request.stream():
            total += len(chunk)
            if total > max_size:
                return reject
            chunks.append(chunk)
        # Stash the read body so downstream can re-read it
        request._body = b"".join(chunks)

    return await call_next(request)


# Security headers
@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "0"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    if settings.MODE == "production":
        response.headers["Strict-Transport-Security"] = (
            "max-age=31536000; includeSubDomains"
        )
    return response


# Session middleware (required by Authlib for OAuth state)
app.add_middleware(SessionMiddleware, secret_key=settings.SECRET_KEY)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -- Router --
app.include_router(api_router, prefix=settings.API_V1_STR)


# -- Health probes --


@app.get("/health/live")
async def liveness():
    return {"status": "alive"}


@app.get("/health/ready")
async def readiness(db: AsyncSession = Depends(get_db)):
    try:
        await db.execute(text("SELECT 1"))
        return {"status": "ready", "checks": {"database": "ok"}}
    except Exception:
        return JSONResponse(
            status_code=503,
            content={"status": "not_ready", "checks": {"database": "failed"}},
        )


@app.get("/health/integrations")
async def integration_readiness():
    checks: dict[str, str] = {}

    checks["livekit_env"] = (
        "ok"
        if settings.LIVEKIT_URL and settings.LIVEKIT_API_KEY and settings.LIVEKIT_API_SECRET
        else "missing_config"
    )
    checks["openai_env"] = "ok" if settings.OPENAI_API_KEY else "missing_config"

    try:
        from livekit.api import LiveKitAPI

        api = LiveKitAPI(
            url=settings.LIVEKIT_URL,
            api_key=settings.LIVEKIT_API_KEY,
            api_secret=settings.LIVEKIT_API_SECRET,
        )
        await api.aclose()
        checks["livekit_client"] = "ok"
    except Exception:
        checks["livekit_client"] = "failed"

    try:
        from openai import AsyncOpenAI

        _client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        checks["openai_client"] = "ok"
    except Exception:
        checks["openai_client"] = "failed"

    healthy = all(
        value == "ok"
        for key, value in checks.items()
        if key in {"livekit_env", "openai_env", "livekit_client", "openai_client"}
    )
    if not healthy:
        return JSONResponse(
            status_code=503,
            content={"status": "not_ready", "checks": checks},
        )
    return {"status": "ready", "checks": checks}
