import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.debate_embedding import DebateEmbedding


async def create_embeddings_batch(
    db: AsyncSession,
    embeddings: list[DebateEmbedding],
) -> None:
    db.add_all(embeddings)
    await db.flush()


async def search_similar_embeddings(
    db: AsyncSession,
    user_id: uuid.UUID,
    query_embedding: list[float],
    limit: int = 5,
) -> list[DebateEmbedding]:
    stmt = (
        select(DebateEmbedding)
        .where(DebateEmbedding.user_id == user_id)
        .order_by(DebateEmbedding.embedding.cosine_distance(query_embedding))
        .limit(limit)
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())
