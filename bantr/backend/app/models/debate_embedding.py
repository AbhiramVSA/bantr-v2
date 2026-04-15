import uuid

from pgvector.sqlalchemy import Vector
from sqlalchemy import ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


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
    )
