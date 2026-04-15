import asyncio
import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone

import jwt
from passlib.context import CryptContext

from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def create_access_token(user_id: str, role_name: str, permissions: list[str]) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "role": role_name,
        "permissions": permissions,
        "iss": settings.JWT_ISSUER,
        "aud": settings.JWT_AUDIENCE,
        "iat": now,
        "nbf": now,
        "exp": now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        "type": "access",
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> dict:
    return jwt.decode(
        token,
        settings.SECRET_KEY,
        algorithms=[settings.JWT_ALGORITHM],
        issuer=settings.JWT_ISSUER,
        audience=settings.JWT_AUDIENCE,
        options={"require": ["sub", "exp", "iss", "aud", "iat", "nbf", "type"]},
    )


def create_refresh_token() -> str:
    return secrets.token_urlsafe(64)


def hash_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode()).hexdigest()


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


async def hash_password_async(password: str) -> str:
    return await asyncio.to_thread(pwd_context.hash, password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


async def verify_password_async(plain_password: str, hashed_password: str) -> bool:
    return await asyncio.to_thread(pwd_context.verify, plain_password, hashed_password)


def generate_csrf_token() -> str:
    return secrets.token_urlsafe(32)


def validate_csrf_token(cookie_token: str, header_token: str) -> bool:
    return hmac.compare_digest(cookie_token, header_token)
