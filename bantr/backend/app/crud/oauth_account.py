import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.oauth_account import OAuthAccount


async def get_oauth_account(
    db: AsyncSession, *, provider: str, provider_user_id: str
) -> OAuthAccount | None:
    result = await db.execute(
        select(OAuthAccount).where(
            OAuthAccount.provider == provider,
            OAuthAccount.provider_user_id == provider_user_id,
        )
    )
    return result.scalars().first()


async def get_oauth_account_by_email(
    db: AsyncSession, *, provider: str, provider_email: str
) -> OAuthAccount | None:
    result = await db.execute(
        select(OAuthAccount).where(
            OAuthAccount.provider == provider,
            OAuthAccount.provider_email == provider_email,
        )
    )
    return result.scalars().first()


async def create_oauth_account(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    provider: str,
    provider_user_id: str,
    provider_email: str,
) -> OAuthAccount:
    account = OAuthAccount(
        user_id=user_id,
        provider=provider,
        provider_user_id=provider_user_id,
        provider_email=provider_email,
    )
    db.add(account)
    await db.flush()
    await db.refresh(account)
    return account
