import asyncio
import logging
import uuid

from openai import AsyncOpenAI
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.errors import AppError
from app.crud.chat_message import create_chat_message, get_recent_chat_messages
from app.crud.debate import get_debate_by_id
from app.crud.debate_embedding import search_similar_embeddings
from app.models.chat_message import ChatMessage
from app.services.embedding_service import embed_query

logger = logging.getLogger(__name__)

OPENAI_TIMEOUT_SECONDS = 60
OPENAI_RETRIES = 2

CHAT_SYSTEM_PROMPT = """You are a helpful debate coach.
You have access to snippets from the user's past debates.
Give concise, actionable coaching and reference debate evidence when relevant."""


async def handle_chat_message(
    db: AsyncSession, user_id: uuid.UUID, message: str
) -> tuple[ChatMessage, list[dict]]:
    query_embedding = await embed_query(message)
    similar = await search_similar_embeddings(db, user_id, query_embedding, limit=5)

    context_parts = []
    debate_ids_seen: dict[str, str] = {}
    for emb in similar:
        debate = await get_debate_by_id(db, emb.debate_id)
        if not debate:
            continue
        debate_id_str = str(debate.id)
        if debate_id_str not in debate_ids_seen:
            debate_ids_seen[debate_id_str] = debate.title
        context_parts.append(f"[From debate: {debate.title}]\n{emb.chunk_text}")

    context_text = (
        "\n\n---\n\n".join(context_parts)
        if context_parts
        else "No relevant debate history found."
    )

    recent = await get_recent_chat_messages(db, user_id, limit=10)
    history_messages = [{"role": msg.role, "content": msg.content} for msg in recent]

    messages = [
        {"role": "system", "content": CHAT_SYSTEM_PROMPT},
        {"role": "system", "content": f"Relevant context:\n\n{context_text}"},
        *history_messages,
        {"role": "user", "content": message},
    ]

    client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
    response = None
    for attempt in range(OPENAI_RETRIES):
        try:
            response = await asyncio.wait_for(
                client.chat.completions.create(
                    model=settings.OPENAI_CHAT_MODEL,
                    messages=messages,
                ),
                timeout=OPENAI_TIMEOUT_SECONDS,
            )
            break
        except Exception:
            logger.exception("OpenAI chat call failed on attempt %s", attempt + 1)
            if attempt == OPENAI_RETRIES - 1:
                raise AppError(
                    "CHAT_FAILED",
                    "Failed to generate chat response",
                    status_code=502,
                )

    assistant_content = response.choices[0].message.content if response else None
    if not assistant_content:
        raise AppError(
            "CHAT_INVALID",
            "OpenAI returned empty chat response",
            status_code=502,
        )

    context_ids = list(debate_ids_seen.keys()) if debate_ids_seen else None
    await create_chat_message(
        db,
        user_id=user_id,
        role="user",
        content=message,
        context_debate_ids=context_ids,
    )
    assistant_msg = await create_chat_message(
        db,
        user_id=user_id,
        role="assistant",
        content=assistant_content,
        context_debate_ids=context_ids,
    )

    context_debates = [
        {"id": did, "title": title} for did, title in debate_ids_seen.items()
    ]
    return assistant_msg, context_debates
