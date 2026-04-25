import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.debate import Debate
    from app.models.oauth_account import OAuthAccount
    from app.models.refresh_token import RefreshToken
    from app.models.role import Role


class User(Base):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    hashed_password: Mapped[str | None] = mapped_column(String(256))
    is_active: Mapped[bool] = mapped_column(default=True)
    role_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("roles.id"), index=True)

    role: Mapped["Role | None"] = relationship(back_populates="users", lazy="joined")
    oauth_accounts: Mapped[list["OAuthAccount"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    refresh_tokens: Mapped[list["RefreshToken"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    debates: Mapped[list["Debate"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
