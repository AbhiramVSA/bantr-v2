import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.base import role_permissions
from app.models.permission import Permission
from app.models.role import Role
from app.models.user import User


async def get_permission_by_name(db: AsyncSession, name: str) -> Permission | None:
    result = await db.execute(select(Permission).where(Permission.name == name))
    return result.scalars().first()


async def create_permission(
    db: AsyncSession, *, name: str, description: str | None = None
) -> Permission:
    permission = Permission(name=name, description=description)
    db.add(permission)
    await db.flush()
    await db.refresh(permission)
    return permission


async def get_user_permission_names(db: AsyncSession, user_id: uuid.UUID) -> set[str]:
    result = await db.execute(
        select(Permission.name)
        .join(role_permissions, Permission.id == role_permissions.c.permission_id)
        .join(Role, Role.id == role_permissions.c.role_id)
        .join(User, User.role_id == Role.id)
        .where(User.id == user_id)
    )
    return set(result.scalars().all())
