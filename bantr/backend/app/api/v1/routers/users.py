import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_permissions
from app.core.errors import AppError, NotFoundError
from app.crud.user import get_user_by_id, list_users
from app.models.user import User
from app.schemas.user import UserRead

router = APIRouter()


@router.get("", response_model=list[UserRead])
async def get_users(
    skip: int = 0,
    limit: int = 20,
    user: User = require_permissions("users:read"),
    db: AsyncSession = Depends(get_db),
):
    users = await list_users(db, skip=skip, limit=limit)
    return [
        UserRead(
            id=u.id,
            email=u.email,
            username=u.username,
            is_active=u.is_active,
            role_name=u.role.name if u.role else None,
            created_at=u.created_at,
        )
        for u in users
    ]


@router.get("/{user_id}", response_model=UserRead)
async def get_user(
    user_id: uuid.UUID,
    user: User = require_permissions("users:read"),
    db: AsyncSession = Depends(get_db),
):
    target = await get_user_by_id(db, user_id)
    if not target:
        raise NotFoundError("USER_NOT_FOUND", "User not found")
    return UserRead(
        id=target.id,
        email=target.email,
        username=target.username,
        is_active=target.is_active,
        role_name=target.role.name if target.role else None,
        created_at=target.created_at,
    )


@router.delete("/{user_id}")
async def delete_user(
    user_id: uuid.UUID,
    user: User = require_permissions("users:delete"),
    db: AsyncSession = Depends(get_db),
):
    if user_id == user.id:
        raise AppError("SELF_DELETE", "Cannot delete your own account", status_code=400)
    target = await get_user_by_id(db, user_id)
    if not target:
        raise NotFoundError("USER_NOT_FOUND", "User not found")
    await db.delete(target)
    await db.flush()
    return {"status": "deleted", "user_id": str(user_id)}
