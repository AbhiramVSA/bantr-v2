from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.role import Role


async def get_role_by_name(db: AsyncSession, name: str) -> Role | None:
    result = await db.execute(select(Role).where(Role.name == name))
    return result.scalars().first()


async def list_roles(db: AsyncSession) -> list[Role]:
    result = await db.execute(select(Role))
    return list(result.scalars().all())


async def create_role(
    db: AsyncSession, *, name: str, description: str | None = None
) -> Role:
    role = Role(name=name, description=description)
    db.add(role)
    await db.flush()
    await db.refresh(role)
    return role
