import uuid

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.chat_message import ChatMessage


async def create_chat_message(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    role: str,
    content: str,
    context_debate_ids: list[str] | None = None,
) -> ChatMessage:
    message = ChatMessage(
        user_id=user_id,
        role=role,
        content=content,
        context_debate_ids=context_debate_ids,
    )
    db.add(message)
    await db.flush()
    await db.refresh(message)
    return message


async def list_chat_messages(
    db: AsyncSession,
    user_id: uuid.UUID,
    *,
    skip: int = 0,
    limit: int = 50,
) -> list[ChatMessage]:
    result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.user_id == user_id)
        .order_by(ChatMessage.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    return list(result.scalars().all())


async def get_recent_chat_messages(
    db: AsyncSession,
    user_id: uuid.UUID,
    limit: int = 10,
) -> list[ChatMessage]:
    result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.user_id == user_id)
        .order_by(ChatMessage.created_at.desc())
        .limit(limit)
    )
    return list(reversed(result.scalars().all()))


async def delete_user_chat_history(db: AsyncSession, user_id: uuid.UUID) -> None:
    await db.execute(delete(ChatMessage).where(ChatMessage.user_id == user_id))
    await db.flush()
