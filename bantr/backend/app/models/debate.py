import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Debate(Base):
    __tablename__ = "debates"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    title: Mapped[str] = mapped_column(String(200))
    topic: Mapped[str] = mapped_column(Text)
    agent_prompt: Mapped[str] = mapped_column(Text)
    agent_voice_id: Mapped[str] = mapped_column(String(100))
    status: Mapped[str] = mapped_column(String(20), default="pending")
    livekit_room_name: Mapped[str] = mapped_column(String(100), unique=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    user: Mapped["User"] = relationship(back_populates="debates")
    transcript: Mapped["Transcript | None"] = relationship(
        back_populates="debate", cascade="all, delete-orphan", uselist=False
    )
    analysis: Mapped["DebateAnalysis | None"] = relationship(
        back_populates="debate", cascade="all, delete-orphan", uselist=False
    )
    embeddings: Mapped[list["DebateEmbedding"]] = relationship(
        back_populates="debate", cascade="all, delete-orphan"
    )

    __table_args__ = (
        CheckConstraint(
            "status IN ('pending', 'starting', 'active', 'ending', 'completed', 'failed')",
            name="ck_debates_status_valid",
        ),
    )
