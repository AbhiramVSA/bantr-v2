import uuid
from typing import Any

from sqlalchemy import CheckConstraint, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class DebateAnalysis(Base):
    __tablename__ = "debate_analyses"

    debate_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("debates.id", ondelete="CASCADE"), unique=True, index=True
    )
    argument_strength: Mapped[dict[str, Any]] = mapped_column(JSONB)
    logical_fallacies: Mapped[list[dict[str, Any]]] = mapped_column(JSONB)
    persuasiveness: Mapped[dict[str, Any]] = mapped_column(JSONB)
    key_moments: Mapped[list[dict[str, Any]]] = mapped_column(JSONB)
    improvement_areas: Mapped[list[dict[str, Any]]] = mapped_column(JSONB)
    overall_summary: Mapped[str] = mapped_column(Text)
    winner: Mapped[str | None] = mapped_column(String(10))

    debate: Mapped["Debate"] = relationship(back_populates="analysis")

    __table_args__ = (
        CheckConstraint(
            "winner IS NULL OR winner IN ('user', 'agent', 'draw')",
            name="ck_debate_analyses_winner_valid",
        ),
    )
