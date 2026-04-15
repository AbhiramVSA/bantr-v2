import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.crud.permission import create_permission, get_permission_by_name
from app.crud.role import create_role, get_role_by_name
from app.crud.user import get_user_by_email
from app.models.base import role_permissions
from app.models.permission import Permission
from app.models.role import Role

logger = logging.getLogger(__name__)

DEFAULT_ROLES_PERMISSIONS = {
    "admin": ["users:read", "users:write", "users:delete", "roles:manage"],
    "user": ["users:read"],
}


async def ensure_default_roles_and_permissions(db: AsyncSession) -> None:
    """Create default roles and permissions if they don't exist."""
    # 1. Ensure all permissions exist
    all_perm_names: set[str] = set()
    for perms in DEFAULT_ROLES_PERMISSIONS.values():
        all_perm_names.update(perms)

    permissions_by_name: dict[str, Permission] = {}
    for perm_name in all_perm_names:
        perm = await get_permission_by_name(db, perm_name)
        if not perm:
            perm = await create_permission(db, name=perm_name)
            logger.info("Created permission: %s", perm_name)
        permissions_by_name[perm_name] = perm

    # 2. Ensure all roles exist with correct permissions
    for role_name, perm_names in DEFAULT_ROLES_PERMISSIONS.items():
        role = await get_role_by_name(db, role_name)
        if not role:
            role = await create_role(
                db, name=role_name, description=f"Default {role_name} role"
            )
            logger.info("Created role: %s", role_name)

        # Query existing permissions for this role
        existing_result = await db.execute(
            select(Permission.name)
            .join(role_permissions, Permission.id == role_permissions.c.permission_id)
            .where(role_permissions.c.role_id == role.id)
        )
        existing = set(existing_result.scalars().all())

        for perm_name in perm_names:
            if perm_name not in existing:
                await db.execute(
                    role_permissions.insert().values(
                        role_id=role.id,
                        permission_id=permissions_by_name[perm_name].id,
                    )
                )
                logger.info("Linked permission '%s' to role '%s'", perm_name, role_name)

    # 3. Promote bootstrap admin emails
    if settings.bootstrap_admin_emails_list:
        admin_role = await get_role_by_name(db, "admin")
        if admin_role:
            for email in settings.bootstrap_admin_emails_list:
                user = await get_user_by_email(db, email)
                if user and user.role_id != admin_role.id:
                    user.role_id = admin_role.id
                    logger.info("Promoted %s to admin", email)

    await db.flush()
