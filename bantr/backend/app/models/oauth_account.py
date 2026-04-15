import uuid

from sqlalchemy import ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class OAuthAccount(Base):
    __tablename__ = "oauth_accounts"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    provider: Mapped[str] = mapped_column(String(30))
    provider_user_id: Mapped[str] = mapped_column(String(100))
    provider_email: Mapped[str] = mapped_column(String(320))

    user: Mapped["User"] = relationship(back_populates="oauth_accounts")

    __table_args__ = (
        UniqueConstraint("provider", "provider_user_id", name="uq_provider_account"),
        Index("ix_oauth_provider_email", "provider", "provider_email"),
    )
