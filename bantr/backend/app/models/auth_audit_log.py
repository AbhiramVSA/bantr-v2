import uuid

from sqlalchemy import ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class AuthAuditLog(Base):
    __tablename__ = "auth_audit_logs"

    user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    event: Mapped[str] = mapped_column(String(50), index=True)
    ip_address: Mapped[str | None] = mapped_column(String(45))
    user_agent: Mapped[str | None] = mapped_column(String(512))
    detail: Mapped[str | None] = mapped_column(String(500))

    __table_args__ = (
        Index("ix_audit_user_event", "user_id", "event"),
        Index("ix_audit_created", "created_at"),
    )
