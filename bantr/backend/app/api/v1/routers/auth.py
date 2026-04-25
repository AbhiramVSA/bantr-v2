import logging

from authlib.integrations.base_client.errors import MismatchingStateError
from fastapi import APIRouter, Depends, Request, Response
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.responses import RedirectResponse

from app.api.deps import get_current_user, get_db, validate_csrf
from app.core.config import settings
from app.core.errors import AuthError
from app.core.oauth import oauth
from app.crud.permission import get_user_permission_names
from app.models.user import User
from app.schemas.auth import LoginRequest, RegisterRequest, UserProfile
from app.services.auth_service import (
    authenticate_user,
    find_or_create_oauth_user,
    issue_user_tokens,
    logout_user_session,
    refresh_user_session,
    register_user,
)

logger = logging.getLogger(__name__)

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)


@router.get("/google/login")
@limiter.limit(settings.AUTH_RATE_LIMIT)
async def google_login(request: Request):
    redirect_uri = settings.GOOGLE_REDIRECT_URI
    return await oauth.google.authorize_redirect(request, redirect_uri)


@router.get("/google/callback")
async def google_callback(request: Request, db: AsyncSession = Depends(get_db)):
    try:
        token = await oauth.google.authorize_access_token(request)
    except MismatchingStateError:
        logger.warning("OAuth callback failed due to mismatching state")
        return RedirectResponse(
            url=f"{settings.FRONTEND_URL}?error=oauth_state_mismatch",
            status_code=302,
        )
    except Exception:
        logger.exception("OAuth callback failed")
        return RedirectResponse(
            url=f"{settings.FRONTEND_URL}?error=oauth_failed",
            status_code=302,
        )

    user_info = token.get("userinfo")
    if not user_info:
        try:
            user_info = await oauth.google.parse_id_token(token, nonce=None)
        except Exception:
            logger.warning("Failed to parse id_token from OAuth response")
            return RedirectResponse(
                url=f"{settings.FRONTEND_URL}?error=oauth_failed",
                status_code=302,
            )

    if not user_info or not user_info.get("email"):
        return RedirectResponse(
            url=f"{settings.FRONTEND_URL}?error=oauth_no_email",
            status_code=302,
        )

    try:
        user = await find_or_create_oauth_user(
            db,
            provider="google",
            provider_user_id=user_info["sub"],
            email=user_info["email"],
            email_verified=user_info.get("email_verified", False),
        )
    except AuthError:
        return RedirectResponse(
            url=f"{settings.FRONTEND_URL}?error=oauth_link_failed",
            status_code=302,
        )
    except IntegrityError:
        return RedirectResponse(
            url=f"{settings.FRONTEND_URL}?error=oauth_conflict",
            status_code=302,
        )

    redirect = RedirectResponse(url=settings.FRONTEND_URL, status_code=302)
    await issue_user_tokens(db, user, request, redirect, event="login_oauth")
    await db.commit()
    return redirect


@router.post("/register")
@limiter.limit(settings.AUTH_RATE_LIMIT)
async def register(
    request: Request,
    body: RegisterRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    user = await register_user(db, email=body.email, username=body.username, password=body.password)
    await issue_user_tokens(db, user, request, response, event="register")
    await db.commit()
    return {"status": "registered", "user_id": str(user.id)}


@router.post("/login")
@limiter.limit(settings.AUTH_RATE_LIMIT)
async def login(
    request: Request,
    body: LoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    user = await authenticate_user(db, request, email=body.email, password=body.password)
    await issue_user_tokens(db, user, request, response, event="login_password")
    await db.commit()
    return {"status": "ok", "user_id": str(user.id)}


@router.get("/me", response_model=UserProfile)
async def get_me(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    permissions = await get_user_permission_names(db, user.id)
    role_name = user.role.name if user.role else None
    return UserProfile(
        id=user.id,
        email=user.email,
        username=user.username,
        role=role_name,
        permissions=permissions,
    )


@router.post("/refresh", dependencies=[Depends(validate_csrf)])
@limiter.limit("10/minute")
async def refresh_token(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    user = await refresh_user_session(db, request, response)
    await db.commit()
    return {"status": "ok", "user_id": str(user.id)}


@router.post("/logout", dependencies=[Depends(validate_csrf)])
async def logout(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    await logout_user_session(db, request, response)
    await db.commit()
    return {"status": "logged_out"}
