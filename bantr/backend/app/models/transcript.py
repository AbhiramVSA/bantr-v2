import uuid
from typing import Any

from sqlalchemy import ForeignKey, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Transcript(Base):
    __tablename__ = "transcripts"

    debate_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("debates.id", ondelete="CASCADE"), unique=True, index=True
    )
    full_text: Mapped[str] = mapped_column(Text)
    speaker_segments: Mapped[list[dict[str, Any]]] = mapped_column(JSONB)

    debate: Mapped["Debate"] = relationship(back_populates="transcript")
