import uuid
from datetime import datetime

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.refresh_token import RefreshToken


async def get_refresh_token_by_hash(
    db: AsyncSession, token_hash: str, *, for_update: bool = False
) -> RefreshToken | None:
    stmt = select(RefreshToken).where(RefreshToken.token_hash == token_hash)
    if for_update:
        stmt = stmt.with_for_update()
    result = await db.execute(stmt)
    return result.scalars().first()


async def create_refresh_token(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    token_hash: str,
    expires_at: datetime,
    absolute_expiry: datetime,
    ip: str | None = None,
    user_agent: str | None = None,
) -> RefreshToken:
    token = RefreshToken(
        user_id=user_id,
        token_hash=token_hash,
        expires_at=expires_at,
        absolute_expiry=absolute_expiry,
        created_by_ip=ip,
        created_by_ua=user_agent,
    )
    db.add(token)
    await db.flush()
    await db.refresh(token)
    return token


async def revoke_active_tokens_for_user(
    db: AsyncSession, user_id: uuid.UUID
) -> None:
    await db.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user_id, RefreshToken.is_revoked == False)
        .values(is_revoked=True, updated_at=func.now())
    )
    await db.flush()
