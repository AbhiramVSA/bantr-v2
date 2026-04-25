import hmac
import uuid
from urllib.parse import urlparse

import jwt
from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AuthError, ForbiddenError
from app.core.security import decode_access_token
from app.crud.permission import get_user_permission_names
from app.crud.user import get_user_by_id
from app.db.session import get_db
from app.models.user import User


async def get_current_user(request: Request, db: AsyncSession = Depends(get_db)) -> User:
    token = request.cookies.get("access_token")
    if not token:
        raise AuthError("NOT_AUTHENTICATED", "No access token provided")
    try:
        payload = decode_access_token(token)
    except jwt.ExpiredSignatureError:
        raise AuthError("TOKEN_EXPIRED", "Access token has expired")
    except jwt.InvalidTokenError:
        raise AuthError("TOKEN_INVALID", "Access token is invalid")

    if payload.get("type") != "access":
        raise AuthError("TOKEN_INVALID", "Not an access token")

    user = await get_user_by_id(db, uuid.UUID(payload["sub"]))
    if not user:
        raise AuthError("USER_NOT_FOUND", "User no longer exists")
    if not user.is_active:
        raise AuthError("USER_INACTIVE", "Account is deactivated")
    return user


def require_permissions(*required: str):
    async def check(
        user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
    ) -> User:
        user_perms = await get_user_permission_names(db, user.id)
        missing = set(required) - user_perms
        if missing:
            raise ForbiddenError("INSUFFICIENT_PERMISSIONS", f"Missing permissions: {missing}")
        return user

    return Depends(check)


async def validate_csrf(request: Request) -> None:
    if request.method in ("GET", "HEAD", "OPTIONS"):
        return

    # Allow same-origin unsafe requests (e.g. Swagger UI on the API origin).
    # CSRF risk applies to cross-origin requests; same-origin requests are not forgeable
    # by third-party sites.
    origin = request.headers.get("origin")
    referer = request.headers.get("referer")
    request_origin = f"{request.url.scheme}://{request.url.netloc}"

    def _matches_request_origin(value: str | None) -> bool:
        if not value:
            return False
        parsed = urlparse(value)
        source = f"{parsed.scheme}://{parsed.netloc}" if parsed.scheme and parsed.netloc else ""
        return source == request_origin

    if _matches_request_origin(origin) or _matches_request_origin(referer):
        return

    cookie_token = request.cookies.get("csrf_token")
    header_token = request.headers.get("X-CSRF-Token")
    if not cookie_token or not header_token:
        raise AuthError("CSRF_MISSING", "CSRF token required")
    if not hmac.compare_digest(cookie_token, header_token):
        raise AuthError("CSRF_INVALID", "CSRF token mismatch")
