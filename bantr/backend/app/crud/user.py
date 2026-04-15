import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.models.user import User


async def get_user_by_id(
    db: AsyncSession, user_id: uuid.UUID
) -> User | None:
    result = await db.execute(
        select(User).options(joinedload(User.role)).where(User.id == user_id)
    )
    return result.scalars().first()


async def get_user_by_email(
    db: AsyncSession, email: str
) -> User | None:
    result = await db.execute(
        select(User).options(joinedload(User.role)).where(User.email == email)
    )
    return result.scalars().first()


async def get_user_by_username(
    db: AsyncSession, username: str
) -> User | None:
    result = await db.execute(select(User).where(User.username == username))
    return result.scalars().first()


async def create_user(
    db: AsyncSession,
    *,
    email: str,
    username: str,
    hashed_password: str | None = None,
    role_id: uuid.UUID | None = None,
) -> User:
    user = User(
        email=email,
        username=username,
        hashed_password=hashed_password,
        role_id=role_id,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user


async def list_users(
    db: AsyncSession, skip: int = 0, limit: int = 20
) -> list[User]:
    result = await db.execute(
        select(User).options(joinedload(User.role)).offset(skip).limit(limit)
    )
    return list(result.scalars().unique().all())
