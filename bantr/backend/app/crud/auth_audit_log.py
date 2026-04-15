import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.auth_audit_log import AuthAuditLog


async def create_audit_log(
    db: AsyncSession,
    *,
    user_id: uuid.UUID | None,
    event: str,
    ip_address: str | None = None,
    user_agent: str | None = None,
    detail: str | None = None,
) -> AuthAuditLog:
    log = AuthAuditLog(
        user_id=user_id,
        event=event,
        ip_address=ip_address,
        user_agent=user_agent,
        detail=detail,
    )
    db.add(log)
    await db.flush()
    return log
