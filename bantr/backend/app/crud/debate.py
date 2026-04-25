import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.debate import Debate


async def create_debate(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    title: str,
    topic: str,
    agent_prompt: str,
    agent_voice_id: str,
    livekit_room_name: str,
) -> Debate:
    debate = Debate(
        user_id=user_id,
        title=title,
        topic=topic,
        agent_prompt=agent_prompt,
        agent_voice_id=agent_voice_id,
        livekit_room_name=livekit_room_name,
    )
    db.add(debate)
    await db.flush()
    await db.refresh(debate)
    return debate


async def get_debate_by_id(db: AsyncSession, debate_id: uuid.UUID) -> Debate | None:
    result = await db.execute(select(Debate).where(Debate.id == debate_id))
    return result.scalars().first()


async def get_debate_by_id_for_update(db: AsyncSession, debate_id: uuid.UUID) -> Debate | None:
    result = await db.execute(select(Debate).where(Debate.id == debate_id).with_for_update())
    return result.scalars().first()


async def get_user_debate(
    db: AsyncSession, debate_id: uuid.UUID, user_id: uuid.UUID
) -> Debate | None:
    result = await db.execute(
        select(Debate).where(Debate.id == debate_id, Debate.user_id == user_id)
    )
    return result.scalars().first()


async def get_user_debate_for_update(
    db: AsyncSession, debate_id: uuid.UUID, user_id: uuid.UUID
) -> Debate | None:
    result = await db.execute(
        select(Debate).where(Debate.id == debate_id, Debate.user_id == user_id).with_for_update()
    )
    return result.scalars().first()


async def list_user_debates(
    db: AsyncSession,
    user_id: uuid.UUID,
    *,
    status: str | None = None,
    skip: int = 0,
    limit: int = 20,
) -> list[Debate]:
    stmt = select(Debate).where(Debate.user_id == user_id)
    if status:
        stmt = stmt.where(Debate.status == status)
    stmt = stmt.order_by(Debate.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(stmt)
    return list(result.scalars().all())
