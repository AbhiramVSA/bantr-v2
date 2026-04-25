import logging
from datetime import datetime, timedelta, timezone

from fastapi import Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.errors import AuthError, ConflictError
from app.core.security import (
    create_access_token,
    create_refresh_token,
    generate_csrf_token,
    hash_password_async,
    hash_token,
    verify_password_async,
)
from app.crud.auth_audit_log import create_audit_log
from app.crud.oauth_account import create_oauth_account, get_oauth_account
from app.crud.permission import get_user_permission_names
from app.crud.refresh_token import (
    create_refresh_token as create_refresh_token_record,
)
from app.crud.refresh_token import (
    get_refresh_token_by_hash,
    revoke_active_tokens_for_user,
)
from app.crud.role import get_role_by_name
from app.crud.user import create_user, get_user_by_email, get_user_by_id, get_user_by_username
from app.models.user import User

logger = logging.getLogger(__name__)


async def build_unique_username(db: AsyncSession, base_username: str) -> str:
    """Generate a unique username by appending incrementing numbers."""
    candidate = base_username
    counter = 0
    while True:
        existing = await get_user_by_username(db, candidate)
        if not existing:
            return candidate
        counter += 1
        candidate = f"{base_username}{counter}"


async def _get_role_name(db: AsyncSession, user: User) -> str:
    """Get role name from user, fetching if needed."""
    if user.role is not None:
        return user.role.name
    if user.role_id is not None:
        from sqlalchemy import select

        from app.models.role import Role

        result = await db.execute(select(Role).where(Role.id == user.role_id))
        role = result.scalars().first()
        if role:
            return role.name
    raise AuthError("ROLE_NOT_FOUND", "User has no assigned role")


async def find_or_create_oauth_user(
    db: AsyncSession,
    *,
    provider: str,
    provider_user_id: str,
    email: str,
    email_verified: bool,
) -> User:
    """Find existing OAuth user or create a new one."""
    # 1. Check for existing OAuth account
    oauth = await get_oauth_account(db, provider=provider, provider_user_id=provider_user_id)
    if oauth:
        user = await get_user_by_id(db, oauth.user_id)
        if not user:
            raise AuthError("USER_NOT_FOUND", "OAuth-linked user no longer exists")
        if not user.is_active:
            raise AuthError("USER_INACTIVE", "Account is deactivated")
        return user

    # 2. Check for existing user by email
    user = await get_user_by_email(db, email)
    if user:
        if not user.is_active:
            raise AuthError("USER_INACTIVE", "Account is deactivated")
        if not email_verified:
            raise AuthError(
                "EMAIL_NOT_VERIFIED",
                "Cannot link unverified OAuth email to existing account",
            )
        # Link OAuth account to existing user
        await create_oauth_account(
            db,
            user_id=user.id,
            provider=provider,
            provider_user_id=provider_user_id,
            provider_email=email,
        )
        # Nullify password to prevent pre-registration attack
        user.hashed_password = None
        await db.flush()
        return user

    # 3. Create new user with "user" role
    username = await build_unique_username(db, email.split("@")[0])
    role = await get_role_by_name(db, "user")
    if not role:
        raise AuthError("ROLE_NOT_FOUND", "Default user role not found")

    user = await create_user(
        db,
        email=email,
        username=username,
        role_id=role.id,
    )
    await create_oauth_account(
        db,
        user_id=user.id,
        provider=provider,
        provider_user_id=provider_user_id,
        provider_email=email,
    )
    # Re-fetch to get role joinedload
    user = await get_user_by_id(db, user.id)
    if not user:
        raise AuthError("USER_NOT_FOUND", "Created user could not be reloaded")
    return user


async def register_user(
    db: AsyncSession,
    *,
    email: str,
    username: str,
    password: str,
) -> User:
    """Register a new user with email and password."""
    if await get_user_by_email(db, email):
        raise ConflictError("EMAIL_EXISTS", "Email already registered")
    if await get_user_by_username(db, username):
        raise ConflictError("USERNAME_EXISTS", "Username already taken")

    role = await get_role_by_name(db, "user")
    if not role:
        raise AuthError("ROLE_NOT_FOUND", "Default user role not found")

    user = await create_user(
        db,
        email=email,
        username=username,
        hashed_password=await hash_password_async(password),
        role_id=role.id,
    )
    # Re-fetch to get role joinedload
    user = await get_user_by_id(db, user.id)
    if not user:
        raise AuthError("USER_NOT_FOUND", "Created user could not be reloaded")
    return user


async def authenticate_user(
    db: AsyncSession,
    request: Request,
    *,
    email: str,
    password: str,
) -> User:
    """Authenticate a user with email and password."""
    ip = request.client.host if request.client else None
    ua = request.headers.get("user-agent")

    user = await get_user_by_email(db, email)
    if not user or not user.hashed_password:
        await create_audit_log(
            db,
            user_id=None,
            event="login_failed",
            ip_address=ip,
            user_agent=ua,
            detail=f"Unknown email: {email}",
        )
        await db.commit()
        raise AuthError("INVALID_CREDENTIALS", "Invalid email or password")
    if not await verify_password_async(password, user.hashed_password):
        await create_audit_log(
            db,
            user_id=user.id,
            event="login_failed",
            ip_address=ip,
            user_agent=ua,
            detail="Wrong password",
        )
        await db.commit()
        raise AuthError("INVALID_CREDENTIALS", "Invalid email or password")
    if not user.is_active:
        await create_audit_log(
            db,
            user_id=user.id,
            event="login_failed",
            ip_address=ip,
            user_agent=ua,
            detail="Account deactivated",
        )
        await db.commit()
        raise AuthError("USER_INACTIVE", "Account is deactivated")
    return user


async def issue_user_tokens(
    db: AsyncSession,
    user: User,
    request: Request,
    response: Response,
    *,
    event: str,
) -> None:
    """Issue access + refresh tokens and set cookies."""
    role_name = await _get_role_name(db, user)
    permissions = await get_user_permission_names(db, user.id)

    access_token = create_access_token(str(user.id), role_name, list(permissions))
    raw_refresh = create_refresh_token()
    csrf_token = generate_csrf_token()

    now = datetime.now(timezone.utc)
    await create_refresh_token_record(
        db,
        user_id=user.id,
        token_hash=hash_token(raw_refresh),
        expires_at=now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        absolute_expiry=now + timedelta(days=settings.ABSOLUTE_SESSION_EXPIRE_DAYS),
        ip=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    set_auth_cookies(response, access_token, raw_refresh, csrf_token)

    await create_audit_log(
        db,
        user_id=user.id,
        event=event,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )


async def refresh_user_session(
    db: AsyncSession,
    request: Request,
    response: Response,
) -> User:
    """Refresh tokens using the refresh cookie."""
    raw_refresh = request.cookies.get("refresh_token")
    if not raw_refresh:
        raise AuthError("MISSING_TOKEN", "Refresh token not found")

    token_hash = hash_token(raw_refresh)
    token_record = await get_refresh_token_by_hash(db, token_hash, for_update=True)
    if not token_record:
        raise AuthError("INVALID_TOKEN", "Refresh token not recognised")

    now = datetime.now(timezone.utc)

    if token_record.is_revoked:
        # Possible token reuse — revoke all tokens for this user
        await revoke_active_tokens_for_user(db, token_record.user_id)
        await create_audit_log(
            db,
            user_id=token_record.user_id,
            event="token_reuse_detected",
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
        )
        await db.commit()
        raise AuthError("TOKEN_REUSED", "Refresh token reuse detected")

    if token_record.expires_at < now:
        raise AuthError("TOKEN_EXPIRED", "Refresh token has expired")

    if token_record.absolute_expiry < now:
        raise AuthError("SESSION_EXPIRED", "Session has expired, please log in again")

    # Revoke current token
    token_record.is_revoked = True
    await db.flush()

    user = await get_user_by_id(db, token_record.user_id)
    if not user or not user.is_active:
        raise AuthError("USER_INACTIVE", "Account is deactivated")

    await issue_user_tokens(db, user, request, response, event="token_refresh")
    return user


async def logout_user_session(
    db: AsyncSession,
    request: Request,
    response: Response,
) -> None:
    """Log out the current session."""
    token_record = None
    raw_refresh = request.cookies.get("refresh_token")
    if raw_refresh:
        token_hash = hash_token(raw_refresh)
        token_record = await get_refresh_token_by_hash(db, token_hash)
        if token_record:
            token_record.is_revoked = True
            await db.flush()

    clear_auth_cookies(response)

    await create_audit_log(
        db,
        user_id=token_record.user_id if token_record else None,
        event="logout",
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )


def set_auth_cookies(
    response: Response,
    access_token: str,
    refresh_token: str,
    csrf_token: str,
) -> None:
    """Set authentication cookies on the response."""
    secure = settings.MODE != "development"

    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=secure,
        samesite="lax",
        path="/",
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=secure,
        samesite="strict",
        path="/api/v1/auth",
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400,
    )
    response.set_cookie(
        key="csrf_token",
        value=csrf_token,
        httponly=False,
        secure=secure,
        samesite="lax",
        path="/",
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


def clear_auth_cookies(response: Response) -> None:
    """Remove authentication cookies."""
    response.delete_cookie(key="access_token", path="/")
    response.delete_cookie(key="refresh_token", path="/api/v1/auth")
    response.delete_cookie(key="csrf_token", path="/")
