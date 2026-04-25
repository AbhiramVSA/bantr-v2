import uuid
from typing import TYPE_CHECKING

from pgvector.sqlalchemy import Vector
from sqlalchemy import CheckConstraint, ForeignKey, Index, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.debate import Debate


class DebateEmbedding(Base):
    __tablename__ = "debate_embeddings"

    debate_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("debates.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    chunk_index: Mapped[int]
    chunk_text: Mapped[str] = mapped_column(Text)
    embedding: Mapped[list[float]] = mapped_column(Vector(1536))
    speaker: Mapped[str] = mapped_column(String(10))

    debate: Mapped["Debate"] = relationship(back_populates="embeddings")

    __table_args__ = (
        Index(
            "ix_debate_embeddings_embedding_hnsw",
            "embedding",
            postgresql_using="hnsw",
            postgresql_with={"m": 16, "ef_construction": 64},
            postgresql_ops={"embedding": "vector_cosine_ops"},
        ),
        UniqueConstraint(
            "debate_id",
            "chunk_index",
            name="uq_debate_embeddings_debate_chunk",
        ),
        CheckConstraint(
            "speaker IN ('user', 'agent')",
            name="ck_debate_embeddings_speaker_valid",
        ),
    )
